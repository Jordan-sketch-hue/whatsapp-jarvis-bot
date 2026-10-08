import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Conversation } from "./conversation";
import { logCall, isDNC, getProspect, markCalled, ensureSchema } from "./db";
import { initiateCall } from "./call";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const server = createServer(app);

const sessions = new Map<string, Conversation>();

// ─── Schema init ─────────────────────────────────────────────────────────────
ensureSchema().then(() => console.log("[DB] Schema ready")).catch(e => console.error("[DB] Schema error:", e.message));

// ─── Outbound call trigger ────────────────────────────────────────────────────
app.post("/call", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "unauthorized" });

  const { to, company_name, industry } = req.body;
  if (!to) return res.status(400).json({ error: "to is required" });

  // DNC check before dialing
  const onDNC = await isDNC(to);
  if (onDNC) return res.status(403).json({ error: "number on DNC list" });

  try {
    const call_sid = await initiateCall(to);
    // Store prospect context so /twiml can load it
    sessions.set(`pending_${to}`, new Conversation(
      await getProspect(to) ?? { company_name, industry }
    ));
    await markCalled(to);
    res.json({ call_sid, status: "queued" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── TwiML entry ─────────────────────────────────────────────────────────────
app.post("/twiml", async (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  const to = req.body.To || "";
  console.log("[TWIML] CallSid:", callSid);

  // Pick up pending prospect context if available
  const pending = sessions.get(`pending_${to}`);
  const conv = pending ?? new Conversation();
  sessions.delete(`pending_${to}`);
  sessions.set(callSid, conv);

  const greeting = conv.getGreeting();
  console.log("[TWIML] Greeting:", greeting.slice(0, 80));
  res.type("text/xml").send(buildGather(greeting));
});

// ─── Handle speech input ─────────────────────────────────────────────────────
app.post("/gather", async (req, res) => {
  const callSid = req.body.CallSid;
  const speechResult = req.body.SpeechResult || "";
  console.log("[GATHER] CallSid:", callSid, "| Speech:", speechResult.slice(0, 80));

  let conv = sessions.get(callSid);
  if (!conv) {
    conv = new Conversation();
    sessions.set(callSid, conv);
  }

  try {
    const { text: reply, ended } = await conv.respond(speechResult);
    console.log("[GATHER] Stage:", conv.getStage(), "| Reply:", reply.slice(0, 80), "| ended:", ended);

    if (ended) {
      await finalizeCall(callSid, req.body.To || "", conv, 0);
      sessions.delete(callSid);
      res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">${escapeXml(reply)}</Say>
  <Hangup/>
</Response>`);
    } else {
      res.type("text/xml").send(buildGather(reply));
    }
  } catch (e: any) {
    console.error("[GATHER] Error:", e.message);
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Sorry about that, one moment.</Say><Hangup/></Response>`);
  }
});

// ─── No input ─────────────────────────────────────────────────────────────────
app.post("/no-input", async (req, res) => {
  const callSid = req.body.CallSid;
  const conv = sessions.get(callSid);
  if (conv) await finalizeCall(callSid, req.body.To || "", conv, 0);
  sessions.delete(callSid);
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew-Neural">No problem — feel free to reach us at J Supreme Tech anytime. Have a great day!</Say>
  <Hangup/>
</Response>`);
});

// ─── Call status callback ─────────────────────────────────────────────────────
app.post("/call-status", async (req, res) => {
  const { CallSid, CallStatus, To, CallDuration } = req.body;
  console.log("[STATUS]", CallSid, CallStatus, `${CallDuration}s`);

  const duration = parseInt(CallDuration || "0");

  if (["no-answer", "busy", "failed"].includes(CallStatus)) {
    await logCall({
      call_sid: CallSid,
      to_number: To,
      outcome: CallStatus === "no-answer" ? "no_answer" : CallStatus as any,
      transcript: "",
      booked_followup: false,
      duration_seconds: duration,
    });
  } else if (CallStatus === "completed") {
    const conv = sessions.get(CallSid);
    if (conv) {
      await finalizeCall(CallSid, To, conv, duration);
      sessions.delete(CallSid);
    }
  }

  res.sendStatus(200);
});

// ─── Finalize: score + log + notify ──────────────────────────────────────────
async function finalizeCall(callSid: string, toNumber: string, conv: Conversation, duration: number) {
  try {
    const transcript = conv.getTranscript();
    const mockup = conv.getMockupData();
    const stage = conv.getStage();
    const booked = conv.isBooked();

    // Score asynchronously — don't block
    const scores = await conv.scoreCall().catch(() => undefined);

    const nextAction = mockup.requested
      ? `Send free mockup to ${mockup.wa_number ?? toNumber} within 24h. Colors: ${mockup.brand_colors ?? "TBD"}. Style: ${mockup.style_pref ?? "TBD"}.`
      : booked
      ? "Follow up within 24h to confirm proposal or trial start."
      : "No commitment — retry in 3 days if not DNC.";

    await logCall({
      call_sid: callSid,
      to_number: toNumber,
      duration_seconds: duration,
      outcome: "answered",
      transcript,
      booked_followup: booked,
      stage_reached: stage,
      scores,
      mockup_requested: mockup.requested,
      mockup_wa_number: mockup.wa_number,
      mockup_colors: mockup.brand_colors,
      mockup_style: mockup.style_pref,
      next_action: nextAction,
    });

    // Notify Jordan via WhatsApp
    await notifyJordan({ callSid, toNumber, stage, booked, scores, mockup, nextAction, transcript });

    console.log("[FINAL] Logged & notified. Stage:", stage, "| Mockup:", mockup.requested, "| Scores:", scores);
  } catch (e: any) {
    console.error("[FINAL] Error:", e.message);
  }
}

async function notifyJordan(data: {
  callSid: string;
  toNumber: string;
  stage: string;
  booked: boolean;
  scores?: any;
  mockup: any;
  nextAction: string;
  transcript: string;
}) {
  const webhookUrl = process.env.WHATSAPP_NOTIFY_URL;
  if (!webhookUrl) return;

  const scoreStr = data.scores
    ? `Interest:${data.scores.interest} | Useful:${data.scores.usefulness} | Resourceful:${data.scores.resourcefulness} | Resonance:${data.scores.emotional_resonance} | Success:${data.scores.success}`
    : "Scores: pending";

  const message = [
    `*Marcus Call Ended*`,
    `Number: ${data.toNumber}`,
    `Stage reached: ${data.stage}`,
    `Booked: ${data.booked ? "YES" : "NO"}`,
    `Mockup requested: ${data.mockup.requested ? "YES" : "NO"}`,
    data.mockup.requested ? `Mockup WA: ${data.mockup.wa_number ?? "not captured"} | Colors: ${data.mockup.brand_colors ?? "-"} | Style: ${data.mockup.style_pref ?? "-"}` : "",
    scoreStr,
    `Next: ${data.nextAction}`,
  ].filter(Boolean).join("\n");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  } catch (e: any) {
    console.error("[NOTIFY] WhatsApp notify failed:", e.message);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildGather(say: string) {
  const base = process.env.PUBLIC_URL;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${base}/gather" method="POST"
          speechTimeout="auto" speechModel="phone_call"
          language="en-US" timeout="8">
    <Say voice="Polly.Matthew-Neural">${escapeXml(say)}</Say>
  </Gather>
  <Redirect method="POST">${base}/no-input</Redirect>
</Response>`;
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

app.get("/health", (_, res) => res.json({ status: "ok", sessions: sessions.size, time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Marcus AI Sales Bot running on port ${PORT}`));
