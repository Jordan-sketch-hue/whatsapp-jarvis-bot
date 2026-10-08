import "dotenv/config";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { Conversation } from "./conversation";
import { synthesizeSpeech } from "./tts";
import { createAzureSTT } from "./stt";
import { logCall } from "./db";
import { initiateCall, buildTwiml, buildVoicemailTwiml } from "./call";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/stream" });

interface Session {
  conv: Conversation;
  callSid: string;
  ws: WebSocket;
  streamSid: string;
  stt: ReturnType<typeof createAzureSTT>;
  speaking: boolean;
  startTime: number;
}

const sessions = new Map<string, Session>();

/** Send TTS audio back to Twilio in 160-byte mulaw chunks */
async function sendAudio(ws: WebSocket, streamSid: string, text: string) {
  const audio = await synthesizeSpeech(text);
  const chunkSize = 160;
  for (let i = 0; i < audio.length; i += chunkSize) {
    const chunk = audio.slice(i, i + chunkSize);
    ws.send(JSON.stringify({
      event: "media",
      streamSid,
      media: { payload: chunk.toString("base64") },
    }));
    await new Promise(r => setTimeout(r, 20));
  }
}

wss.on("connection", (ws) => {
  let session: Session | null = null;

  ws.on("message", async (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.event === "start") {
      const callSid = msg.start.callSid;
      const streamSid = msg.start.streamSid;
      const conv = new Conversation();

      const stt = createAzureSTT(async (text, isFinal) => {
        if (!isFinal || !session || session.speaking) return;
        session.speaking = true;
        try {
          const { text: reply, ended } = await conv.respond(text);
          await sendAudio(ws, streamSid, reply);
          if (ended) {
            await logCall({
              callSid,
              toNumber: "",
              outcome: "answered",
              transcript: conv.getTranscript(),
              bookedFollowup: conv.isBooked(),
              durationSeconds: Math.floor((Date.now() - session!.startTime) / 1000),
            });
            ws.close();
          }
        } finally {
          session!.speaking = false;
        }
      });

      session = { conv, callSid, ws, streamSid, stt, speaking: false, startTime: Date.now() };
      sessions.set(callSid, session);

      // Send opening greeting
      const greeting = conv.getGreeting();
      await sendAudio(ws, streamSid, greeting);
    }

    if (msg.event === "media" && session) {
      const audio = Buffer.from(msg.media.payload, "base64");
      session.stt.pushAudio(audio);
    }

    if (msg.event === "stop" && session) {
      session.stt.stop();
      sessions.delete(session.callSid);
    }
  });

  ws.on("close", () => {
    if (session) {
      session.stt.stop();
      sessions.delete(session.callSid);
    }
  });
});

// ── REST endpoints ──────────────────────────────────────

/** Initiate outbound call — requires x-admin-key header */
app.post("/call", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { to, leadName, business } = req.body;
  if (!to) return res.status(400).json({ error: "to is required" });

  try {
    const call = await initiateCall(to, process.env.PUBLIC_URL!);
    res.json({ callSid: call.sid, status: call.status });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** TwiML — Twilio calls this when the call connects */
app.post("/twiml", (req, res) => {
  res.type("text/xml").send(buildTwiml(process.env.PUBLIC_URL!));
});

/** AMD callback — handle voicemail detection */
app.post("/amd-status", async (req, res) => {
  const { CallSid, AnsweredBy } = req.body;
  if (AnsweredBy === "machine_end_beep" || AnsweredBy === "machine_end_silence") {
    await logCall({ callSid: CallSid, toNumber: "", outcome: "voicemail", transcript: "", bookedFollowup: false, durationSeconds: 0 });
  }
  res.type("text/xml").send(AnsweredBy?.startsWith("machine") ? buildVoicemailTwiml() : buildTwiml(process.env.PUBLIC_URL!));
});

/** Call status callback */
app.post("/call-status", async (req, res) => {
  const { CallSid, CallStatus, To, CallDuration } = req.body;
  if (CallStatus === "no-answer" || CallStatus === "busy" || CallStatus === "failed") {
    await logCall({ callSid: CallSid, toNumber: To, outcome: "no_answer", transcript: "", bookedFollowup: false, durationSeconds: parseInt(CallDuration || "0") });
  }
  res.sendStatus(200);
});

/** Health check */
app.get("/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`AI Sales Bot running on port ${PORT}`));
