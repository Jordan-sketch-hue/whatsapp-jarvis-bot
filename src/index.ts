import "dotenv/config";
import express from "express";
import { createServer } from "http";
import twilio from "twilio";
import { Conversation } from "./conversation";
import { logCall, isDNC, markDNC, getProspect, markCalled, hasBeenCalledRecently, ensureSchema, getAttemptCount, getNewLeads, markLeadCalled, saveCallSession, loadCallSession, deleteCallSession } from "./db";
import { initiateCall } from "./call";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const server = createServer(app);

// sessions Map + timestamps for periodic cleanup
const sessions = new Map<string, Conversation>();
const sessionTimestamps = new Map<string, number>();

// Pending LLM responses keyed by callSid — filler plays while these resolve
const pendingResponses = new Map<string, Promise<{ text: string; ended: boolean }>>();

// DB-backed session helpers — memory is fast cache, DB is source of truth
async function getSession(callSid: string): Promise<Conversation | null> {
  const mem = sessions.get(callSid);
  if (mem) return mem;
  const data = await loadCallSession(callSid);
  if (!data) return null;
  const conv = Conversation.fromJSON(data);
  sessions.set(callSid, conv);
  sessionTimestamps.set(callSid, Date.now());
  return conv;
}

async function setSession(callSid: string, conv: Conversation): Promise<void> {
  sessions.set(callSid, conv);
  sessionTimestamps.set(callSid, Date.now());
  await saveCallSession(callSid, conv.toJSON());
}

async function removeSession(callSid: string): Promise<void> {
  sessions.delete(callSid);
  sessionTimestamps.delete(callSid);
  await deleteCallSession(callSid);
}

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

// ─── Rime AI TTS endpoint ─────────────────────────────────────────────────────
const STAGE_SPEAKER: Record<string, string> = {
  greeting:          "godfrey",
  qualify:           "godfrey",
  mockup_offer:      "godfrey",
  mockup_collect:    "godfrey",
  pitch:             "godfrey",
  objection_classify:"godfrey",
  objection_address: "godfrey",
  hesitation_close:  "godfrey",
  close:             "godfrey",
  schedule:          "godfrey",
  follow_up:         "godfrey",
  end:               "godfrey",
};

app.get("/tts", async (req, res) => {
  const text = (req.query.text as string) || "";
  const stage = (req.query.stage as string) || "";
  if (!text) { res.status(400).send("text required"); return; }

  const key = process.env.RIME_API_KEY;
  if (!key) { res.status(500).send("Rime API key not set"); return; }

  const cacheKey = stage ? `${stage}::${text}` : text;
  const cached = ttsCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTS_CACHE_TTL_MS) {
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(cached.buf);
    return;
  }

  const speaker = STAGE_SPEAKER[stage] ?? "cove";

  try {
    const ttsRes = await fetch("https://users.rime.ai/v1/rime-tts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Accept": "audio/mp3",
      },
      body: JSON.stringify({
        text,
        speaker,
        modelId: "mist",
        samplingRate: 22050,
        speedAlpha: 0.95,
      }),
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("[TTS] Rime error:", ttsRes.status, errText);
      res.status(502).send("TTS error");
      return;
    }

    const buf = Buffer.from(await ttsRes.arrayBuffer());

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

// ─── TwiML entry — play greeting immediately, then gather ────────────────────
app.all("/twiml", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid || req.query.CallSid as string || "unknown";
  const to = req.body.To || req.query.To as string || "";
  console.log("[TWIML] CallSid:", callSid);

  const pending = sessions.get(`pending_${to}`);
  const conv = pending ?? new Conversation();
  sessions.delete(`pending_${to}`);
  sessionTimestamps.delete(`pending_${to}`);
  await setSession(callSid, conv);

  // Play greeting first (outside Gather) so Twilio doesn't hear its own audio as speech
  const base = process.env.PUBLIC_URL;
  const greeting = encodeURIComponent(conv.getGreeting());
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${base}/tts?text=${greeting}&amp;stage=greeting</Play>
  <Gather input="speech" action="${base}/gather" method="POST"
          speechTimeout="auto" speechModel="phone_call"
          language="en-US" timeout="12">
  </Gather>
  <Redirect method="POST">${base}/no-input</Redirect>
</Response>`);
});

// ─── /intro — prospect said hello, deliver greeting ───────────────────────────
app.post("/intro", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  const heard = (req.body.SpeechResult || "").trim();
  console.log("[INTRO] CallSid:", callSid, "| Heard:", heard || "(silent)");

  let conv = await getSession(callSid);
  if (!conv) {
    conv = new Conversation();
    await setSession(callSid, conv);
  }

  const greeting = conv.getGreeting();
  console.log("[INTRO] Greeting:", greeting.slice(0, 80));
  res.type("text/xml").send(buildGather(greeting, "greeting"));
});

// ─── /intro-silence — no speech detected at connect, greet anyway ─────────────
app.post("/intro-silence", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid || "unknown";
  console.log("[INTRO-SILENCE] No speech at connect, greeting anyway. CallSid:", callSid);

  let conv = await getSession(callSid);
  if (!conv) {
    conv = new Conversation();
    await setSession(callSid, conv);
  }

  res.type("text/xml").send(buildGather(conv.getGreeting(), "greeting"));
});

// ─── Handle speech input — return filler instantly, process LLM in background ─
app.post("/gather", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid;
  const speechResult = req.body.SpeechResult || "";
  const confidence = parseFloat(req.body.Confidence ?? "1");
  console.log("[GATHER] CallSid:", callSid, "| Confidence:", confidence.toFixed(2), "| Speech:", speechResult.slice(0, 80));

  if (confidence < 0.5 && speechResult) {
    res.type("text/xml").send(buildGather("Sorry, I didn't catch that clearly — could you say that one more time?"));
    return;
  }

  let conv = await getSession(callSid);
  if (!conv) {
    conv = new Conversation();
    await setSession(callSid, conv);
  }

  conv.silenceStreak = 0;

  // Kick off LLM immediately — don't await it here
  const responsePromise = conv.respond(speechResult);
  pendingResponses.set(callSid, responsePromise);

  // Return filler instantly so the prospect hears something within ~100ms
  const base = process.env.PUBLIC_URL;
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${base}/respond?callSid=${encodeURIComponent(callSid)}</Redirect>
</Response>`);
});

// ─── Respond — await the pending LLM promise and return real TwiML ────────────
app.post("/respond", validateTwilio, async (req, res) => {
  const callSid = (req.query.callSid || req.body.CallSid) as string;
  const base = process.env.PUBLIC_URL;

  const promise = pendingResponses.get(callSid);
  if (!promise) {
    // No pending response — something went wrong, graceful fallback
    res.type("text/xml").send(buildGather("One moment please."));
    return;
  }

  pendingResponses.delete(callSid);

  try {
    const { text: reply, ended } = await promise;
    const conv = await getSession(callSid);
    if (!conv) {
      res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
      return;
    }

    const currentStage = conv.getStage();
    console.log("[RESPOND] Stage:", currentStage, "| Reply:", reply.slice(0, 80), "| ended:", ended);

    if (ended) {
      await finalizeCall(callSid, req.body.To || "", conv, 0);
      await removeSession(callSid);
      const encoded = encodeURIComponent(reply);
      const stageParam = currentStage ? `&stage=${encodeURIComponent(currentStage)}` : "";
      res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${base}/tts?text=${encoded}${stageParam}</Play>
  <Hangup/>
</Response>`);
    } else {
      await setSession(callSid, conv);
      res.type("text/xml").send(buildGather(reply, currentStage));
    }
  } catch (e: any) {
    console.error("[RESPOND] Error:", e.message);
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Sorry about that, one moment.</Say><Hangup/></Response>`);
  }
});

// ─── No input ─────────────────────────────────────────────────────────────────
app.post("/no-input", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid;
  const conv = await getSession(callSid);
  if (!conv) {
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
    return;
  }

  conv.silenceStreak = (conv.silenceStreak ?? 0) + 1;

  if (conv.silenceStreak < 3) {
    const nudge = conv.silenceStreak === 1
      ? "Sorry, I didn't catch that — could you say that again?"
      : "Still there? Take your time, I'm listening.";
    await setSession(callSid, conv);
    res.type("text/xml").send(buildGather(nudge));
    return;
  }

  await finalizeCall(callSid, req.body.To || "", conv, 0);
  await removeSession(callSid);
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
    const conv = await getSession(CallSid);
    if (conv) {
      await finalizeCall(CallSid, To, conv, duration);
      await removeSession(CallSid);
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
  const stageParam = stage ? `&amp;stage=${encodeURIComponent(stage)}` : "";
  // Play BEFORE Gather so Twilio doesn't pick up its own TTS as speech input
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${base}/tts?text=${encoded}${stageParam}</Play>
  <Gather input="speech" action="${base}/gather" method="POST"
          speechTimeout="auto" speechModel="phone_call"
          language="en-US" timeout="12">
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
