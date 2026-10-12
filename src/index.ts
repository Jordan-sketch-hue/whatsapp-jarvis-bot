import "dotenv/config";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { createClient as createDeepgramClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { Conversation, type Lead } from "./conversation.js";
import { synthesizeToBuffer } from "./tts.js";
import { initiateCall, buildTwiml } from "./call.js";
import { logCall, updateCall } from "./db.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/stream" });

// In-memory sessions keyed by callSid
const sessions = new Map<string, {
  ws: WebSocket;
  conv: Conversation;
  streamSid?: string;
  transcript: string[];
  startTime: number;
}>();

// Temp buffer: phone → lead info until WebSocket connects with callSid
const leadBuffer = new Map<string, Lead>();

// ── Admin: trigger outbound call ──────────────────────────────────────
app.post("/call", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "Unauthorized" });

  const { to, name, business } = req.body as { to: string; name?: string; business?: string };
  if (!to) return res.status(400).json({ error: "to is required" });

  try {
    const callSid = await initiateCall(to);
    leadBuffer.set(to, { phone: to, name, business });
    await logCall({ call_sid: callSid, to_number: to, lead_name: name, lead_business: business, outcome: "no_answer", booked_followup: false });
    res.json({ callSid, status: "initiated" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── TwiML: connect call to WebSocket stream ───────────────────────────
app.all("/twiml", (_req, res) => {
  res.type("text/xml").send(buildTwiml(process.env.PUBLIC_URL!));
});

// ── Call status callback ──────────────────────────────────────────────
app.post("/call-status", async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  console.log("[STATUS]", CallSid, CallStatus, `${CallDuration ?? 0}s`);
  const session = sessions.get(CallSid);

  const outcome =
    CallStatus === "completed" ? "answered" :
    CallStatus === "no-answer" ? "no_answer" :
    CallStatus === "busy"      ? "no_answer" : "error";

  await updateCall(CallSid, {
    outcome,
    duration_seconds: CallDuration ? parseInt(CallDuration) : 0,
    transcript: session?.transcript.join("\n"),
    booked_followup: session?.conv.isBooked() ?? false,
  });

  sessions.delete(CallSid);
  res.sendStatus(200);
});

// ── Health ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", sessions: sessions.size }));

// ── WebSocket: Twilio Media Streams ──────────────────────────────────
wss.on("connection", (ws) => {
  let callSid: string | null = null;
  let conv: Conversation | null = null;
  let streamSid: string | null = null;
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
  dgLive.on(LiveTranscriptionEvents.Open, () => {
    dgReady = true;
    console.log("[DG] Deepgram ready");
  });

  dgLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
    const alt = data.channel?.alternatives?.[0];
    if (!alt?.transcript || !data.is_final) return;

    const text = alt.transcript.trim();
    if (!text || !conv || !streamSid) return;

    console.log("[DG] User said:", text);
    transcriptLines.push(`User: ${text}`);

    try {
      const reply = await conv.respond(text);
      if (!reply) return;
      console.log("[MARCUS] Replying:", reply.slice(0, 80));
      transcriptLines.push(`Marcus: ${reply}`);

      const audio = await synthesizeToBuffer(reply);
      sendAudio(ws, streamSid!, audio);

      if (conv.ended) {
        setTimeout(() => ws.close(), 3000);
      }
    } catch (err: any) {
      console.error("[pipeline] error:", err.message);
    }
  });

  dgLive.on(LiveTranscriptionEvents.Error, (err) => {
    console.error("[DG] error:", err);
  });

  ws.on("message", async (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.event === "start") {
      callSid = msg.start.callSid;
      streamSid = msg.start.streamSid;
      console.log("[WS] Stream started. CallSid:", callSid);

      // Pick up lead info
      const lead = leadBuffer.get(msg.start.customParameters?.to ?? "") ?? { phone: callSid ?? "" };
      conv = new Conversation(lead);
      sessions.set(callSid!, { ws, conv, streamSid: streamSid!, transcript: transcriptLines, startTime: Date.now() });

      // Send opening greeting immediately
      const greeting = conv.getGreeting();
      transcriptLines.push(`Marcus: ${greeting}`);
      try {
        const audio = await synthesizeToBuffer(greeting);
        sendAudio(ws, streamSid!, audio);
      } catch (e: any) {
        console.error("[TTS] greeting error:", e.message);
      }
    }

    if (msg.event === "media" && dgReady) {
      const chunk = Buffer.from(msg.media.payload, "base64");
      dgLive.send(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer);
    }

    if (msg.event === "stop") {
      console.log("[WS] Stream stopped. CallSid:", callSid);
      dgLive.requestClose();
    }
  });

  ws.on("close", () => {
    dgLive.requestClose();
  });

  ws.on("error", (err) => {
    console.error("[WS] error:", err.message);
  });
});

function sendAudio(ws: WebSocket, streamSid: string, audio: Buffer) {
  if (ws.readyState !== WebSocket.OPEN) return;
  const CHUNK = 160; // 20ms at 8kHz mulaw
  for (let i = 0; i < audio.length; i += CHUNK) {
    ws.send(JSON.stringify({
      event: "media",
      streamSid,
      media: { payload: audio.slice(i, i + CHUNK).toString("base64") },
    }));
  }
}

const PORT = parseInt(process.env.PORT ?? "3000");
server.listen(PORT, () => console.log(`Marcus AI Sales Bot running on port ${PORT}`));
