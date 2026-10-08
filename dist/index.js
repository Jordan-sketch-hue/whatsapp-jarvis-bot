"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const conversation_1 = require("./conversation");
const db_1 = require("./db");
const call_1 = require("./call");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
const server = (0, http_1.createServer)(app);
const sessions = new Map();
// ─── Schema init ─────────────────────────────────────────────────────────────
(0, db_1.ensureSchema)().then(() => console.log("[DB] Schema ready")).catch(e => console.error("[DB] Schema error:", e.message));
// ─── Azure TTS endpoint ───────────────────────────────────────────────────────
app.get("/tts", async (req, res) => {
    const text = req.query.text || "";
    if (!text) {
        res.status(400).send("text required");
        return;
    }
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || "eastus";
    if (!key) {
        res.status(500).send("Azure key not set");
        return;
    }
    const ssml = `<speak version='1.0' xml:lang='en-US'>
  <voice name='en-US-DavisNeural'>
    <prosody rate='-5%' pitch='0%'>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</prosody>
  </voice>
</speak>`;
    try {
        const ttsRes = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
            method: "POST",
            headers: {
                "Ocp-Apim-Subscription-Key": key,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
                "User-Agent": "marcus-sales-bot",
            },
            body: ssml,
        });
        if (!ttsRes.ok) {
            console.error("[TTS] Azure error:", ttsRes.status, await ttsRes.text());
            res.status(502).send("TTS error");
            return;
        }
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-cache");
        const buf = await ttsRes.arrayBuffer();
        res.send(Buffer.from(buf));
    }
    catch (e) {
        console.error("[TTS] Fetch error:", e.message);
        res.status(500).send("TTS error");
    }
});
// ─── Outbound call trigger ────────────────────────────────────────────────────
app.post("/call", async (req, res) => {
    if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
        return res.status(401).json({ error: "unauthorized" });
    const { to, company_name, industry } = req.body;
    if (!to)
        return res.status(400).json({ error: "to is required" });
    const onDNC = await (0, db_1.isDNC)(to);
    if (onDNC)
        return res.status(403).json({ error: "number on DNC list" });
    try {
        const call_sid = await (0, call_1.initiateCall)(to);
        sessions.set(`pending_${to}`, new conversation_1.Conversation(await (0, db_1.getProspect)(to) ?? { company_name, industry }));
        await (0, db_1.markCalled)(to);
        res.json({ call_sid, status: "queued" });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ─── TwiML entry ─────────────────────────────────────────────────────────────
app.post("/twiml", async (req, res) => {
    const callSid = req.body.CallSid || "unknown";
    const to = req.body.To || "";
    console.log("[TWIML] CallSid:", callSid);
    const pending = sessions.get(`pending_${to}`);
    const conv = pending ?? new conversation_1.Conversation();
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
        conv = new conversation_1.Conversation();
        sessions.set(callSid, conv);
    }
    conv.silenceStreak = 0;
    try {
        const { text: reply, ended } = await conv.respond(speechResult);
        console.log("[GATHER] Stage:", conv.getStage(), "| Reply:", reply.slice(0, 80), "| ended:", ended);
        if (ended) {
            await finalizeCall(callSid, req.body.To || "", conv, 0);
            sessions.delete(callSid);
            res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${process.env.PUBLIC_URL}/tts?text=${encodeURIComponent(reply)}</Play>
  <Hangup/>
</Response>`);
        }
        else {
            res.type("text/xml").send(buildGather(reply));
        }
    }
    catch (e) {
        console.error("[GATHER] Error:", e.message);
        res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Sorry about that, one moment.</Say><Hangup/></Response>`);
    }
});
// ─── No input ─────────────────────────────────────────────────────────────────
app.post("/no-input", async (req, res) => {
    const callSid = req.body.CallSid;
    const conv = sessions.get(callSid);
    if (!conv) {
        res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
        return;
    }
    conv.silenceStreak = (conv.silenceStreak ?? 0) + 1;
    if (conv.silenceStreak < 3) {
        const nudge = conv.silenceStreak === 1
            ? "Sorry, I didn't catch that — could you say that again?"
            : "Still there? Take your time, I'm listening.";
        res.type("text/xml").send(buildGather(nudge));
        return;
    }
    await finalizeCall(callSid, req.body.To || "", conv, 0);
    sessions.delete(callSid);
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${process.env.PUBLIC_URL}/tts?text=${encodeURIComponent("No problem — feel free to reach us at J Supreme Tech anytime. Have a great day!")}</Play>
  <Hangup/>
</Response>`);
});
// ─── Call status callback ─────────────────────────────────────────────────────
app.post("/call-status", async (req, res) => {
    const { CallSid, CallStatus, To, CallDuration } = req.body;
    console.log("[STATUS]", CallSid, CallStatus, `${CallDuration}s`);
    const duration = parseInt(CallDuration || "0");
    if (["no-answer", "busy", "failed"].includes(CallStatus)) {
        await (0, db_1.logCall)({
            call_sid: CallSid,
            to_number: To,
            outcome: CallStatus === "no-answer" ? "no_answer" : CallStatus,
            transcript: "",
            booked_followup: false,
            duration_seconds: duration,
        });
    }
    else if (CallStatus === "completed") {
        const conv = sessions.get(CallSid);
        if (conv) {
            await finalizeCall(CallSid, To, conv, duration);
            sessions.delete(CallSid);
        }
    }
    res.sendStatus(200);
});
// ─── Finalize: score + log + notify ──────────────────────────────────────────
async function finalizeCall(callSid, toNumber, conv, duration) {
    try {
        const transcript = conv.getTranscript();
        const mockup = conv.getMockupData();
        const stage = conv.getStage();
        const booked = conv.isBooked();
        const scores = await conv.scoreCall().catch(() => undefined);
        const nextAction = mockup.requested
            ? `Send free mockup to ${mockup.wa_number ?? toNumber} within 24h. Colors: ${mockup.brand_colors ?? "TBD"}. Style: ${mockup.style_pref ?? "TBD"}.`
            : booked
                ? "Follow up within 24h to confirm proposal or trial start."
                : "No commitment — retry in 3 days if not DNC.";
        await (0, db_1.logCall)({
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
        await notifyJordan({ callSid, toNumber, stage, booked, scores, mockup, nextAction, transcript });
        console.log("[FINAL] Logged & notified. Stage:", stage, "| Mockup:", mockup.requested, "| Scores:", scores);
    }
    catch (e) {
        console.error("[FINAL] Error:", e.message);
    }
}
async function notifyJordan(data) {
    const webhookUrl = process.env.WHATSAPP_NOTIFY_URL;
    if (!webhookUrl)
        return;
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
    }
    catch (e) {
        console.error("[NOTIFY] WhatsApp notify failed:", e.message);
    }
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildGather(say) {
    const base = process.env.PUBLIC_URL;
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${base}/gather" method="POST"
          speechTimeout="auto" speechModel="phone_call"
          language="en-US" timeout="10">
    <Play>${base}/tts?text=${encodeURIComponent(say)}</Play>
  </Gather>
  <Redirect method="POST">${base}/no-input</Redirect>
</Response>`;
}
app.get("/health", (_, res) => res.json({ status: "ok", sessions: sessions.size, time: new Date().toISOString() }));
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Marcus AI Sales Bot running on port ${PORT}`));
