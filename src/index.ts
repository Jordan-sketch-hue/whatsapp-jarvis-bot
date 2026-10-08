import "dotenv/config";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { Conversation } from "./conversation";
import { synthesizeToBuffer } from "./tts";
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
  call_sid: string;
  ws: WebSocket;
  streamSid: string;
  stt: ReturnType<typeof createAzureSTT>;
  speaking: boolean;
  startTime: number;
}

const sessions = new Map<string, Session>();

async function sendAudio(ws: WebSocket, streamSid: string, text: string) {
  const audio = await synthesizeToBuffer(text);
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
  console.log("[WS] New connection from Twilio");
  let session: Session | null = null;

  ws.on("message", async (raw) => {
    console.log("[WS] raw event:", raw.toString().slice(0, 100));ws.on("message", async (raw) => {
    const msg = JSON.parse(raw.toString());

    if (msg.event === "start") {
      console.log("[WS] start event received, callSid:", msg.start?.callSid);
      const call_sid = msg.start.callSid;
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
              call_sid,
              to_number: "",
              outcome: "answered",
              transcript: conv.getTranscript(),
              booked_followup: conv.isBooked(),
              duration_seconds: Math.floor((Date.now() - session!.startTime) / 1000),
            });
            ws.close();
          }
        } finally {
          session!.speaking = false;
        }
      });

      session = { conv, call_sid, ws, streamSid, stt, speaking: false, startTime: Date.now() };
      sessions.set(call_sid, session);

      const greeting = conv.getGreeting();
      await sendAudio(ws, streamSid, greeting);
    }

    if (msg.event === "media" && session) {
      const audio = Buffer.from(msg.media.payload, "base64");
      session.stt.pushAudio(audio);
    }

    if (msg.event === "stop" && session) {
      session.stt.stop();
      sessions.delete(session.call_sid);
    }
  });

  ws.on("error", (err) => { console.error("[WS] error:", err.message); });
  ws.on("close", () => {
    if (session) {
      session.stt.stop();
      sessions.delete(session.call_sid);
    }
  });
});

app.post("/call", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: "to is required" });

  try {
    const call_sid = await initiateCall(to);
    res.json({ call_sid, status: "queued" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/twiml", (req, res) => {
  console.log("[TWIML] POST /twiml hit, CallSid:", req.body.CallSid);
  res.type("text/xml").send(buildTwiml(process.env.PUBLIC_URL!));
});

app.post("/amd-status", async (req, res) => {
  const { CallSid, AnsweredBy } = req.body;
  if (AnsweredBy === "machine_end_beep" || AnsweredBy === "machine_end_silence") {
    await logCall({ call_sid: CallSid, to_number: "", outcome: "voicemail", transcript: "", booked_followup: false, duration_seconds: 0 });
  }
  res.type("text/xml").send(AnsweredBy?.startsWith("machine") ? buildVoicemailTwiml() : buildTwiml(process.env.PUBLIC_URL!));
});

app.post("/call-status", async (req, res) => {
  const { CallSid, CallStatus, To, CallDuration } = req.body;
  if (CallStatus === "no-answer" || CallStatus === "busy" || CallStatus === "failed") {
    await logCall({ call_sid: CallSid, to_number: To, outcome: "no_answer", transcript: "", booked_followup: false, duration_seconds: parseInt(CallDuration || "0") });
  }
  res.sendStatus(200);
});

app.get("/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`AI Sales Bot running on port ${PORT}`));