import "dotenv/config";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { createClient as createDeepgramClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { Conversation, type Lead } from "./conversation.js";
import { synthesizeToBuffer } from "./tts.js";
import { initiateCall, buildTwiml, buildVoicemailTwiml } from "./call.js";
import { logCall, updateCall } from "./db.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/stream" });

// In-memory call sessions keyed by callSid
const sessions = new Map<string, {
  ws: WebSocket;
  conv: Conversation;
  streamSid?: string;
  transcript: string[];
  startTime: number;
}>();

// ── Admin: trigger outbound call ──────────────────────────────────────
app.post("/call", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { to, name, business } = req.body as { to: string; name?: string; business?: string };
  if (!to) return res.status(400).json({ error: "to is required" });

  try {
    const callSid = await initiateCall(to);
    // Store lead info keyed by phone until WebSocket connects with callSid
    leadBuffer.set(to, { phone: to, name, business });
    await logCall({ call_sid: callSid, to_number: to, lead_name: name, lead_business: business, outcome: "no_answer", booked_followup: false });
    res.json({ callSid, status: "initiated" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Temp buffer: phone → lead info (until Twilio gives us callSid on WebSocket)
const leadBuffer = new Map<string, Lead>();

// ── TwiML webhook ─────────────────────────────────────────────────────
app.post("/twiml", (_req, res) => {
  res.type("text/xml").send(buildTwiml(process.env.PUBLIC_URL!));
});

// ── AMD (voicemail) callback ──────────────────────────────────────────
app.post("/amd-status", async (req, res) => {
  const { CallSid, AnsweredBy } = req.body;
  if (AnsweredBy === "machine_end_beep" || AnsweredBy === "machine_end_silence") {
    // Redirect call to play voicemail message
    const twilio = (await import("twilio")).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    await client.calls(CallSid).update({ twiml: buildVoicemailTwiml() });
    await updateCall(CallSid, { outcome: "voicemail" });
  }
  res.sendStatus(200);
});

// ── Call status callback ──────────────────────────────────────────────
app.post("/call-status", async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  const session = sessions.get(CallSid);

  const outcome =
    CallStatus === "completed" ? "answered" :
    CallStatus === "no-answer" ? "no_answer" :
    CallStatus === "busy" ? "no_answer" : "error";

  await updateCall(CallSid, {
    outcome,
    duration_seconds: CallDuration ? parseInt(CallDuration) : undefined,
    transcript: session?.transcript.join("\n"),
  });

  sessions.delete(CallSid);
  res.sendStatus(200);
});

// ── Health check ──────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── WebSocket: Twilio Media Streams ──────────────────────────────────
wss.on("connection", (ws) => {
  let callSid: string | null = null;
  let conv: Conversation | null = null;
  let streamSid: string | null = null;
  let isSpeaking = false;
  const transcriptLines: string[] = [];

  const deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY!);
  const dgLive = deepgram.listen.live({
    model: "nova-2",
    encoding: "mulaw",
    sample_rate: 8000,
    channels: 1,
    smart_format: true,
    interim_results: true,
    utterance_end_ms: 1200,
    vad_events: true,
  });

  let dgReady = false;
  dgLive.on(LiveTranscriptionEvents.Open, () => { dgReady = true; });

  dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
    const alt = data.channel?.alternatives?.[0];
    if (!alt?.transcript || !data.is_final) return;

    const text = alt.transcript.trim();
    if (!text || !conv || !streamSid) return;

    transcriptLines.push(`User: ${text}`);

    // Barge-in: stop speaking if user interrupts
    isSpeaking = false;

    try {
      const reply = await conv.respond(text);
      if (!reply) return;
      transcriptLines.push(`Marcus: ${reply}`);

      const audio = await synthesizeToBuffer(reply);
      sendAudio(ws, streamSid, audio);
      isSpeaking = true;

      if (conv.ended) {
        setTimeout(() => ws.close(), 3000);
      }
    } catch (err) {
      console.error("[pipeline] error:", err);
    }
  });

  ws.on("message", async (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.event === "start") {
      callSid = msg.start.callSid;
      streamSid = msg.start.streamSid;

      // Find lead info
      const lead: Lead = { phone: callSid ?? "" };
      conv = new Conversation(lead);

      sessions.set(callSid!, { ws, conv, streamSid: streamSid!, transcript: transcriptLines, startTime: Date.now() });

      // Send opening greeting
      const greeting = conv.getGreeting();
      transcriptLines.push(`Marcus: ${greeting}`);
      const audio = await synthesizeToBuffer(greeting);
      sendAudio(ws, streamSid!, audio);
    }

    if (msg.event === "media" && dgReady) {
      const chunk = Buffer.from(msg.media.payload, "base64");
      dgLive.send(chunk);
    }

    if (msg.event === "stop") {
      dgLive.requestClose();
    }
  });

  ws.on("close", () => {
    dgLive.requestClose();
  });
});

function sendAudio(ws: WebSocket, streamSid: string, audio: Buffer) {
  if (ws.readyState !== WebSocket.OPEN) return;
  // Twilio expects audio in 20ms chunks (160 bytes at 8kHz mulaw)
  const CHUNK = 160;
  for (let i = 0; i < audio.length; i += CHUNK) {
    const slice = audio.slice(i, i + CHUNK);
    ws.send(JSON.stringify({
      event: "media",
      streamSid,
      media: { payload: slice.toString("base64") },
    }));
  }
}

const PORT = parseInt(process.env.PORT ?? "3000");
server.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
