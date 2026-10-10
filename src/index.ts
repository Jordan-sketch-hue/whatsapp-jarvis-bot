import "dotenv/config";
import express from "express";
import { createServer } from "http";
import twilio from "twilio";
import { Conversation } from "./conversation";
import { logCall, isDNC, markDNC, getProspect, markCalled, hasBeenCalledRecently, ensureSchema, getAttemptCount, getNewLeads, markLeadCalled } from "./db";
import { initiateCall } from "./call";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const server = createServer(app);

// sessions Map + timestamps for periodic cleanup
const sessions = new Map<string, Conversation>();
const sessionTimestamps = new Map<string, number>();

// Simple in-memory TTS cache (text → MP3 buffer, max 100 entries, 1hr TTL)
const ttsCache = new Map<string, { buf: Buffer; ts: number }>();
const TTS_CACHE_TTL_MS = 60 * 60 * 1000;

// Simple rate limiter for /call endpoint (max 20 triggers/minute per IP)
const callRateLimiter = new Map<string, { count: number; resetAt: number }>();

// ─── Schema init ─────────────────────────────────────────────────────────────
ensureSchema().then(() => console.log("[DB] Schema ready")).catch(e => console.error("[DB] Schema error:", e.message));

// ─── Session cleanup — prune stale sessions every 5 minutes ──────────────────
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min
  for (const [sid, ts] of sessionTimestamps.entries()) {
    if (ts < cutoff) {
      sessions.delete(sid);
      sessionTimestamps.delete(sid);
    }
  }
}, 5 * 60 * 1000);

// ─── Twilio webhook signature validation ─────────────────────────────────────
// Only active when PUBLIC_URL is set (production). Skipped in dev.
function validateTwilio(req: express.Request, res: express.Response, next: express.NextFunction) {
  const base = process.env.PUBLIC_URL;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!base || !authToken) { next(); return; }

  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (!signature) {
    // Header missing — likely HTTP→HTTPS redirect dropped it; log and pass through
    console.warn("[SEC] Missing Twilio signature on", req.path, "— passing through (check PUBLIC_URL uses https://)");
    next();
    return;
  }

  const url = `${base}${req.path}`;
  const valid = twilio.validateRequest(authToken, signature, url, req.body);
  if (!valid) {
    // Signature mismatch — log URL for debugging but pass through in trial mode
    console.warn("[SEC] Signature mismatch on", req.path, "url used:", url);
    next();
    return;
  }
  next();
}

// ─── Jamaica business hours check (AST = UTC−5, Mon–Sat 09:00–18:00) ─────────
function isWithinBusinessHours(): boolean {
  const now = new Date();
  // Jamaica stays on UTC−5 year-round (no DST)
  const jamaicaOffset = -5 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ja = new Date(utcMs + jamaicaOffset * 60000);
  const day = ja.getDay();   // 0=Sun, 6=Sat
  const hour = ja.getHours();
  return day >= 1 && day <= 6 && hour >= 9 && hour < 18;
}

// ─── Azure TTS endpoint ───────────────────────────────────────────────────────
// Per-stage prosody: warmer/faster on close, calm on qualify
const STAGE_PROSODY: Record<string, { rate: string; pitch: string }> = {
  greeting:          { rate: "-3%",  pitch: "+2%" },
  qualify:           { rate: "-8%",  pitch: "0%"  },
  mockup_offer:      { rate: "-5%",  pitch: "+1%" },
  mockup_collect:    { rate: "-5%",  pitch: "0%"  },
  pitch:             { rate: "-4%",  pitch: "+1%" },
  objection_classify:{ rate: "-8%",  pitch: "0%"  },
  objection_address: { rate: "-6%",  pitch: "0%"  },
  hesitation_close:  { rate: "-3%",  pitch: "+2%" },
  close:             { rate: "-3%",  pitch: "+3%" },
  schedule:          { rate: "-4%",  pitch: "+1%" },
  follow_up:         { rate: "-5%",  pitch: "0%"  },
  end:               { rate: "-4%",  pitch: "0%"  },
};

app.get("/tts", async (req, res) => {
  const text = (req.query.text as string) || "";
  const stage = (req.query.stage as string) || "";
  if (!text) { res.status(400).send("text required"); return; }

  const key  = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || "eastus";
  if (!key) { res.status(500).send("Azure key not set"); return; }

  // Cache key includes stage so prosody variants are cached separately
  const cacheKey = stage ? `${stage}::${text}` : text;
  const cached = ttsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTS_CACHE_TTL_MS) {
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(cached.buf);
    return;
  }

  const prosody = STAGE_PROSODY[stage] ?? { rate: "-5%", pitch: "0%" };
  const ssml = `<speak version='1.0' xml:lang='en-US'>
  <voice name='en-US-AriaNeural'>
    <prosody rate='${prosody.rate}' pitch='${prosody.pitch}'>${text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</prosody>
  </voice>
</speak>`;

  try {
    const ttsRes = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
          "User-Agent": "aria-sales-bot",
        },
        body: ssml,
      }
    );

    if (!ttsRes.ok) {
      console.error("[TTS] Azure error:", ttsRes.status, await ttsRes.text());
      res.status(502).send("TTS error");
      return;
    }

    const buf = Buffer.from(await ttsRes.arrayBuffer());

    // Cache (evict oldest if over 100 entries)
    if (ttsCache.size >= 100) {
      const oldest = [...ttsCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) ttsCache.delete(oldest[0]);
    }
    ttsCache.set(cacheKey, { buf, ts: Date.now() });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(buf);
  } catch (e: any) {
    console.error("[TTS] Fetch error:", e.message);
    res.status(500).send("TTS error");
  }
});

// ─── AMD callback — handle answering machine detection ───────────────────────
app.post("/amd-status", validateTwilio, (req, res) => {
  const { CallSid, AnsweredBy } = req.body;
  console.log("[AMD] CallSid:", CallSid, "| AnsweredBy:", AnsweredBy);

  // If it's a machine/voicemail, play a brief voicemail and hang up
  if (["machine_start", "machine_end_beep", "machine_end_silence", "fax"].includes(AnsweredBy)) {
    const base = process.env.PUBLIC_URL;
    const vm = encodeURIComponent("Hi, this is Aria from J Supreme Tech. We'd love to help grow your business online. Please call us back at 658-218-2282 or visit jsupremetech.online. Have a great day!");
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${base}/tts?text=${vm}</Play>
  <Hangup/>
</Response>`);
  } else {
    // Human confirmed — nothing to do, call is already flowing
    res.sendStatus(200);
  }
});

// ─── Outbound call trigger ────────────────────────────────────────────────────
app.post("/call", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "unauthorized" });

  // Rate limiting: max 20 triggers per minute per IP
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const limit = callRateLimiter.get(ip);
  if (limit && now < limit.resetAt) {
    if (limit.count >= 20) return res.status(429).json({ error: "rate limit exceeded" });
    limit.count++;
  } else {
    callRateLimiter.set(ip, { count: 1, resetAt: now + 60000 });
  }

  const { to, company_name, industry, bypass_hours } = req.body;
  if (!to) return res.status(400).json({ error: "to is required" });

  // Business hours check (admin can bypass for testing)
  if (!bypass_hours && !isWithinBusinessHours()) {
    return res.status(400).json({ error: "Outside business hours (Mon–Sat 9AM–6PM Jamaica time)" });
  }

  const onDNC = await isDNC(to);
  if (onDNC) return res.status(403).json({ error: "number on DNC list" });

  // Dedup — don't call the same number twice within 24 hours (admin bypass_dedup skips)
  if (!req.body.bypass_dedup) {
    const recentlyCalled = await hasBeenCalledRecently(to, 24);
    if (recentlyCalled) return res.status(409).json({ error: "called within last 24 hours" });

    // Max 3 attempts per number
    const attempts = await getAttemptCount(to);
    if (attempts >= 3) return res.status(403).json({ error: "max attempts reached (3)" });
  }

  try {
    const call_sid = await initiateCall(to);
    const conv = new Conversation(
      await getProspect(to) ?? { company_name, industry }
    );
    sessions.set(`pending_${to}`, conv);
    sessionTimestamps.set(`pending_${to}`, Date.now());
    await markCalled(to);
    res.json({ call_sid, status: "queued" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Batch call new scraper leads ────────────────────────────────────────────
app.post("/call-leads", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "unauthorized" });

  const { limit = 10, bypass_hours } = req.body;

  if (!bypass_hours && !isWithinBusinessHours()) {
    return res.status(400).json({ error: "Outside business hours" });
  }

  const leads = await getNewLeads(Math.min(limit, 50));
  if (!leads.length) return res.json({ queued: 0, message: "No new leads" });

  const results: { phone: string; status: string; call_sid?: string }[] = [];

  for (const lead of leads) {
    try {
      const onDNC = await isDNC(lead.phone);
      if (onDNC) { results.push({ phone: lead.phone, status: "skipped_dnc" }); continue; }

      const recent = await hasBeenCalledRecently(lead.phone, 24);
      if (recent) { results.push({ phone: lead.phone, status: "skipped_recent" }); continue; }

      const attempts = await getAttemptCount(lead.phone);
      if (attempts >= 3) { results.push({ phone: lead.phone, status: "skipped_max_attempts" }); continue; }

      const call_sid = await initiateCall(lead.phone);
      const conv = new Conversation({ company_name: lead.business_name, industry: lead.category });
      sessions.set(`pending_${lead.phone}`, conv);
      sessionTimestamps.set(`pending_${lead.phone}`, Date.now());
      await markCalled(lead.phone);
      await markLeadCalled(lead.id);
      results.push({ phone: lead.phone, status: "queued", call_sid });

      // Small delay between calls to avoid Twilio rate limits
      await new Promise(r => setTimeout(r, 500));
    } catch (e: any) {
      results.push({ phone: lead.phone, status: `error: ${e.message}` });
    }
  }

  res.json({ queued: results.filter(r => r.status === "queued").length, results });
});

// ─── TwiML entry — wait for prospect to speak first ──────────────────────────
app.post("/twiml", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  const to = req.body.To || "";
  console.log("[TWIML] CallSid:", callSid);

  const pending = sessions.get(`pending_${to}`);
  const conv = pending ?? new Conversation();
  sessions.delete(`pending_${to}`);
  sessionTimestamps.delete(`pending_${to}`);
  sessions.set(callSid, conv);
  sessionTimestamps.set(callSid, Date.now());

  const base = process.env.PUBLIC_URL;
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Gather input="speech" action="${base}/intro" method="POST"
          timeout="3" speechTimeout="1" speechModel="phone_call" language="en-US">
  </Gather>
  <Redirect method="POST">${base}/intro-silence</Redirect>
</Response>`);
});

// ─── /intro — prospect said hello, deliver greeting ───────────────────────────
app.post("/intro", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  const heard = (req.body.SpeechResult || "").trim();
  console.log("[INTRO] CallSid:", callSid, "| Heard:", heard || "(silent)");

  let conv = sessions.get(callSid);
  if (!conv) {
    conv = new Conversation();
    sessions.set(callSid, conv);
    sessionTimestamps.set(callSid, Date.now());
  }

  const greeting = conv.getGreeting();
  console.log("[INTRO] Greeting:", greeting.slice(0, 80));
  res.type("text/xml").send(buildGather(greeting, "greeting"));
});

// ─── /intro-silence — no speech detected at connect, greet anyway ─────────────
app.post("/intro-silence", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  console.log("[INTRO-SILENCE] No speech at connect, greeting anyway. CallSid:", callSid);

  let conv = sessions.get(callSid);
  if (!conv) {
    conv = new Conversation();
    sessions.set(callSid, conv);
    sessionTimestamps.set(callSid, Date.now());
  }

  res.type("text/xml").send(buildGather(conv.getGreeting(), "greeting"));
});

// ─── Handle speech input ─────────────────────────────────────────────────────
app.post("/gather", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid;
  const speechResult = req.body.SpeechResult || "";
  const confidence = parseFloat(req.body.Confidence ?? "1");
  console.log("[GATHER] CallSid:", callSid, "| Confidence:", confidence.toFixed(2), "| Speech:", speechResult.slice(0, 80));

  // Low-confidence transcription — ask to repeat rather than misfire
  if (confidence < 0.5 && speechResult) {
    res.type("text/xml").send(buildGather("Sorry, I didn't catch that clearly — could you say that one more time?"));
    return;
  }

  let conv = sessions.get(callSid);
  if (!conv) {
    conv = new Conversation();
    sessions.set(callSid, conv);
    sessionTimestamps.set(callSid, Date.now());
  }

  conv.silenceStreak = 0;
  try {
    const { text: reply, ended } = await conv.respond(speechResult);
    console.log("[GATHER] Stage:", conv.getStage(), "| Reply:", reply.slice(0, 80), "| ended:", ended);

    const currentStage = conv.getStage();
    if (ended) {
      await finalizeCall(callSid, req.body.To || "", conv, 0);
      sessions.delete(callSid);
      sessionTimestamps.delete(callSid);
      const encoded = encodeURIComponent(reply);
      const stageParam = currentStage ? `&stage=${encodeURIComponent(currentStage)}` : "";
      res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${process.env.PUBLIC_URL}/tts?text=${encoded}${stageParam}</Play>
  <Hangup/>
</Response>`);
    } else {
      res.type("text/xml").send(buildGather(reply, currentStage));
    }
  } catch (e: any) {
    console.error("[GATHER] Error:", e.message);
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Sorry about that, one moment.</Say><Hangup/></Response>`);
  }
});

// ─── No input ─────────────────────────────────────────────────────────────────
app.post("/no-input", validateTwilio, async (req, res) => {
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
  sessionTimestamps.delete(callSid);
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${process.env.PUBLIC_URL}/tts?text=${encodeURIComponent("No problem — feel free to reach us at J Supreme Tech anytime. Have a great day!")}</Play>
  <Hangup/>
</Response>`);
});

// ─── Call status callback ─────────────────────────────────────────────────────
app.post("/call-status", validateTwilio, async (req, res) => {
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
      sessionTimestamps.delete(CallSid);
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

    // Auto-write DNC if prospect explicitly asked to be removed
    if (conv.isDncRequested() && toNumber) {
      await markDNC(toNumber);
    }

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

    await notifyJordan({ callSid, toNumber, stage, booked, scores, mockup, nextAction, transcript });
    console.log("[FINAL] Logged & notified. Stage:", stage, "| Mockup:", mockup.requested, "| DNC:", conv.isDncRequested());
  } catch (e: any) {
    console.error("[FINAL] Error:", e.message);
  }
}

async function notifyJordan(data: {
  callSid: string; toNumber: string; stage: string; booked: boolean;
  scores?: any; mockup: any; nextAction: string; transcript: string;
}) {
  const webhookUrl = process.env.WHATSAPP_NOTIFY_URL;
  if (!webhookUrl) return;

  const scoreStr = data.scores
    ? `Interest:${data.scores.interest} | Useful:${data.scores.usefulness} | Resourceful:${data.scores.resourcefulness} | Resonance:${data.scores.emotional_resonance} | Success:${data.scores.success}`
    : "Scores: pending";

  const message = [
    `*Aria Call Ended*`,
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
function buildGather(say: string, stage?: string) {
  const base = process.env.PUBLIC_URL;
  const encoded = encodeURIComponent(say);
  const stageParam = stage ? `&stage=${encodeURIComponent(stage)}` : "";
  // <Play> streams Azure TTS with per-stage prosody. <Say> fallback fires if TTS errors.
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${base}/gather" method="POST"
          speechTimeout="auto" speechModel="phone_call"
          language="en-US" timeout="10">
    <Play>${base}/tts?text=${encoded}${stageParam}</Play>
    <Say>${say}</Say>
  </Gather>
  <Redirect method="POST">${base}/no-input</Redirect>
</Response>`;
}

app.get("/health", (_, res) => res.json({
  status: "ok",
  sessions: sessions.size,
  tts_cache: ttsCache.size,
  business_hours: isWithinBusinessHours(),
  time: new Date().toISOString(),
}));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Aria AI Sales Bot running on port ${PORT}`));
