import "dotenv/config";
import express from "express";
import { createServer } from "http";
import twilio from "twilio";
import { Pool } from "pg";
import { runAll } from "./scraper";
import { runAllIntlMarkets } from "./scraper-intl";
import { Conversation } from "./conversation";
import { logCall, isDNC, markDNC, getProspect, markCalled, hasBeenCalledRecently, ensureSchema, getAttemptCount, getNewLeads, markLeadCalled, saveCallSession, loadCallSession, deleteCallSession, getLastCallContext, logMarketingLead, getSiblingLeads, type LeadFilters } from "./db";
import { initiateCall } from "./call";

// Normalize any JA/US number to E.164.
// 876-xxx-xxxx, 658-xxx-xxxx, (876) xxx-xxxx, +1876… all → +1XXXXXXXXXX
// Other countries: strip spaces/dashes, ensure leading +
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // NANP Jamaica/US: 10 digits or 11 starting with 1
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Already has country code (>11 digits) — just ensure + prefix
  if (digits.length > 11) return `+${digits}`;
  // fallback: return raw if we can't confidently normalize
  return raw.startsWith("+") ? raw : `+${digits}`;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const server = createServer(app);

// sessions Map + timestamps for periodic cleanup
const sessions = new Map<string, Conversation>();
const sessionTimestamps = new Map<string, number>();
const callStartTimes = new Map<string, number>();

// Pending LLM responses keyed by callSid - filler plays while these resolve
const pendingResponses = new Map<string, Promise<{ text: string; ended: boolean }>>();

// DB-backed session helpers - memory is fast cache, DB is source of truth
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
  callStartTimes.delete(callSid);
  await deleteCallSession(callSid);
}

// Simple in-memory TTS cache (text â†’ MP3 buffer, max 100 entries, 1hr TTL)
const ttsCache = new Map<string, { buf: Buffer; ts: number }>();
const TTS_CACHE_TTL_MS = 60 * 60 * 1000;

// Simple rate limiter for /call endpoint (max 20 triggers/minute per IP)
const callRateLimiter = new Map<string, { count: number; resetAt: number }>();

// â"€â"€â"€ Schema init â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
ensureSchema().then(() => console.log("[DB] Schema ready")).catch(e => console.error("[DB] Schema error:", e.message));

// Pre-warm TTS cache with generic greeting so first call has no cold-start silence
const FILLER_TEXTS = ["Mm-hmm.", "Sure.", "Got it.", "Right.", "I see.", "Hello? Can you hear me alright?"];
const GENERIC_GREETING = `Hi, this is Kai calling from J Supreme Tech — we're an agency that specializes in AI sales agents and chatbots, websites, apps, and digital marketing. Quick heads up, this call may be recorded. How are you doing today?`;
setTimeout(async () => {
  try {
    const key = process.env.RIME_API_KEY;
    if (!key) return;
    const textsToWarm = [
      { text: GENERIC_GREETING, stage: "greeting" },
      ...FILLER_TEXTS.map((t: string) => ({ text: t, stage: "filler" })),
    ];
    for (const { text, stage } of textsToWarm) {
      const cacheKey = `${stage}::${text}`;
      if (ttsCache.has(cacheKey)) continue;
      const r = await fetch("https://users.rime.ai/v1/rime-tts", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "Accept": "audio/mp3" },
        body: JSON.stringify({ text, speaker: "godfrey", modelId: "coda", samplingRate: 22050, speedAlpha: 0.95 }),
      });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        ttsCache.set(cacheKey, { buf, ts: Date.now() });
      }
      await new Promise((r2: any) => setTimeout(r2, 200));
    }
    console.log("[TTS] Pre-warmed greeting + fillers, cache size:", ttsCache.size);
  } catch (e: any) { console.error("[TTS] Pre-warm failed:", e.message); }
}, 3000);

// â"€â"€â"€ Session cleanup - prune stale sessions every 5 minutes â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min
  for (const [sid, ts] of sessionTimestamps.entries()) {
    if (ts < cutoff) {
      sessions.delete(sid);
      sessionTimestamps.delete(sid);
    }
  }
}, 5 * 60 * 1000);

// --- SignalWire webhook signature validation ---
// SignalWire uses same HMAC-SHA1 algo as Twilio - twilio.validateRequest works.
// Header is x-signalwire-signature instead of x-twilio-signature.
function validateTwilio(req: express.Request, res: express.Response, next: express.NextFunction) {
  const base = process.env.PUBLIC_URL;
  const authToken = process.env.SIGNALWIRE_API_TOKEN;
  if (!base || !authToken) { next(); return; }

  const signature = (req.headers["x-signalwire-signature"] ?? req.headers["x-twilio-signature"]) as string | undefined;
  if (!signature) {
    console.warn("[SEC] Missing SignalWire signature on", req.path, "- passing through");
    next();
    return;
  }

  const url = `${base}${req.path}`;
  const valid = twilio.validateRequest(authToken, signature, url, req.body);
  if (!valid) {
    console.warn("[SEC] Signature mismatch on", req.path, "url used:", url);
    next();
    return;
  }
  next();
}

// â"€â"€â"€ Jamaica business hours check (AST = UTCâˆ’5, Mon-Sat 09:00-18:00) â"€â"€â"€â"€â"€â"€â"€â"€â"€
function isWithinBusinessHours(): boolean {
  const now = new Date();
  // Jamaica stays on UTCâˆ’5 year-round (no DST)
  const jamaicaOffset = -5 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ja = new Date(utcMs + jamaicaOffset * 60000);
  const day = ja.getDay();   // 0=Sun, 6=Sat
  const hour = ja.getHours();
  return day >= 1 && day <= 6 && hour >= 9 && hour < 18;
}

// â"€â"€â"€ Rime AI TTS endpoint â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
  const sid = (req.query.sid as string) || "";
  if (!text) { res.status(400).send("text required"); return; }

  if (sid && text.length > 0) {
    const conv = await getSession(sid);
    if (conv) {
      conv.rimeChars += text.length;
      await setSession(sid, conv);
    }
  }

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

  const speaker = STAGE_SPEAKER[stage] ?? "godfrey";

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
        modelId: "coda",
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

// â"€â"€â"€ AMD callback - handle answering machine detection â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
app.post("/amd-status", validateTwilio, async (req, res) => {
  const { CallSid, AnsweredBy } = req.body;
  console.log("[AMD] CallSid:", CallSid, "| AnsweredBy:", AnsweredBy);

  // If it's a machine/voicemail, play a brief voicemail and hang up
  if (AnsweredBy === "machine_start") {
    // Voicemail connecting — hang up immediately, do not let IVR audio bleed as speech
    console.log("[AMD] machine_start — hanging up to prevent voicemail bleed");
    try {
      const orgId = process.env.TELNYX_ORG_ID!;
      const apiKey = process.env.TELNYX_API_KEY!;
      await fetch(`https://api.telnyx.com/v2/texml/Accounts/${orgId}/Calls/${encodeURIComponent(CallSid)}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "Status=completed",
      });
    } catch (e: any) {
      console.error("[AMD] hang up error:", e.message);
    }
    res.sendStatus(200);
    return;
  }
  if (["machine_end_beep", "machine_end_silence", "fax"].includes(AnsweredBy)) {
    const base = process.env.PUBLIC_URL;
    const vm = encodeURIComponent("Hi, this is Kai from J Supreme Tech. We'd love to help grow your business online. Please call us back at 658-218-2282 or visit jsupremetech.online. Have a great day!");
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${base}/tts?text=${vm}</Play>
  <Hangup/>
</Response>`);
  } else {
    // Human confirmed - nothing to do, call is already flowing
    res.sendStatus(200);
  }
});

// â"€â"€â"€ Outbound call trigger â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
    return res.status(400).json({ error: "Outside business hours (Mon-Sat 9AM-6PM Jamaica time)" });
  }

  const onDNC = await isDNC(to);
  if (onDNC) return res.status(403).json({ error: "number on DNC list" });

  // Dedup - don't call the same number twice within 24 hours (admin bypass_dedup skips)
  if (!req.body.bypass_dedup) {
    const recentlyCalled = await hasBeenCalledRecently(to, 24);
    if (recentlyCalled) return res.status(409).json({ error: "called within last 24 hours" });

    // Max 3 attempts per number
    const attempts = await getAttemptCount(to);
    if (attempts >= 3) return res.status(403).json({ error: "max attempts reached (3)" });
  }

  try {
    const normalizedTo = toE164(to);
    const call_sid = await initiateCall(normalizedTo);
    const conv = new Conversation(
      await getProspect(to) ?? { company_name, industry }
    );
    sessions.set(`pending_${normalizedTo}`, conv);
    sessionTimestamps.set(`pending_${normalizedTo}`, Date.now());
    await markCalled(to);
    res.json({ call_sid, status: "queued" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// â"€â"€â"€ Batch call new scraper leads â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
app.post("/call-leads", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "unauthorized" });

  const { limit = 3, bypass_hours, market, category, tier } = req.body;

  if (!bypass_hours && !isWithinBusinessHours()) {
    return res.status(400).json({ error: "Outside business hours" });
  }

  const filters: LeadFilters = {};
  if (market === null) filters.market = null;           // null = Jamaica local (IS NULL)
  else if (market)     filters.market = String(market); // string = specific intl market
  if (category) filters.category = String(category);
  if (tier)     filters.tier     = parseInt(String(tier)) as 1 | 2 | 3;

  const leads = await getNewLeads(Math.min(limit, 50), filters);
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

      const normalizedPhone = toE164(lead.phone);
      const call_sid = await initiateCall(normalizedPhone);
      const siblings = await getSiblingLeads(lead.phone, lead.id);
      const conv = new Conversation({
        company_name: lead.business_name,
        industry: lead.category,
        has_website: lead.has_website,
        recommended_service: lead.recommended_product,
        notes: lead.notes,
        sibling_businesses: siblings.length ? siblings.map(s => ({
          company_name: s.business_name,
          category: s.category,
          has_website: s.has_website,
          recommended_product: s.recommended_product,
        })) : undefined,
      });
      sessions.set(`pending_${normalizedPhone}`, conv);
      sessionTimestamps.set(`pending_${normalizedPhone}`, Date.now());
      await markCalled(lead.phone);
      await markLeadCalled(lead.id);
      results.push({ phone: lead.phone, status: "queued", call_sid });

      // 30-second spacing between call initiations — prevents simultaneous spam
      await new Promise(r => setTimeout(r, 30000));
    } catch (e: any) {
      results.push({ phone: lead.phone, status: `error: ${e.message}` });
    }
  }

  res.json({ queued: results.filter(r => r.status === "queued").length, results });
});

// â"€â"€â"€ TwiML entry - play greeting immediately, then gather â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
app.all("/twiml", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid || req.query.CallSid as string || "unknown";
  const to = req.body.To || req.query.To as string || "";
  console.log("[TWIML] CallSid:", callSid);

  const pending = sessions.get(`pending_${to}`);
  const conv = pending ?? new Conversation();
  sessions.delete(`pending_${to}`);
  sessionTimestamps.delete(`pending_${to}`);
  await setSession(callSid, conv);
  callStartTimes.set(callSid, Date.now());

  const base = process.env.PUBLIC_URL;
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${base}/gather" method="POST"
          speechTimeout="1.5" speechModel="phone_call"
          language="en-US" timeout="12">
    <Pause length="0.5"/>
    <Play>${base}/tts?text=${encodeURIComponent(conv.getGreeting())}&amp;stage=greeting</Play>
  </Gather>
  <Redirect method="POST">${base}/no-input</Redirect>
</Response>`);
});

// â"€â"€â"€ /intro - prospect said hello, deliver greeting â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
  res.type("text/xml").send(buildGather(greeting, "greeting", callSid));
});

// â"€â"€â"€ /intro-silence - no speech detected at connect, greet anyway â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// ─── Handle speech input - return filler instantly, process LLM in background ─
app.post("/gather", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid;
  const speechResult = req.body.SpeechResult || "";
  const confidence = parseFloat(req.body.Confidence ?? "1");
  console.log("[GATHER] CallSid:", callSid, "| Confidence:", confidence.toFixed(2), "| Speech:", speechResult.slice(0, 80));

  // Load session first so conv is available for the early empty-gather case
  let conv = await getSession(callSid);
  if (!conv) {
    conv = new Conversation();
    await setSession(callSid, conv);
  }

  const base2 = process.env.PUBLIC_URL;

  // Strip leading dot/space noise prefix (e.g. ". . hello" → "hello")
  const cleanedSpeech = speechResult.replace(/^[\s.]+/, "").trim();
  const effectiveSpeech = cleanedSpeech || speechResult;

  // Noise artifact filter: dots/spaces/punctuation with no real words → treat as empty
  const hasWords = /[a-zA-Z0-9]/.test(effectiveSpeech);
  const isNoiseArtifact = effectiveSpeech.length > 0 && !hasWords;

  if (!effectiveSpeech || effectiveSpeech.trim() === "" || isNoiseArtifact) {
    // Use call start time as fallback when lastRespondedAt not yet set (first gather, greeting stage)
    const lastRef = conv.lastRespondedAt ?? callStartTimes.get(callSid) ?? 0;
    const timeSinceResponse = Date.now() - lastRef;
    if (timeSinceResponse < 20000) {
      console.log("[GATHER] Empty/noise within 20s of TTS — extending gather silently");
      res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${base2}/gather" method="POST"
          speechTimeout="1.5" speechModel="phone_call"
          language="en-US" timeout="15">
  </Gather>
  <Redirect method="POST">${base2}/no-input</Redirect>
</Response>`);
      return;
    }
    console.log("[GATHER] Empty/noise — stage:", conv.getStage(), "| isNoise:", isNoiseArtifact, "| nudging caller");
    const nudge = conv.getStage() === "greeting"
      ? "Hello? Can you hear me alright?"
      : "Sorry, I didn't quite catch that — could you say that again?";
    res.type("text/xml").send(buildGather(nudge));
    return;
  }

  conv.silenceStreak = 0;


  // Kick off LLM immediately - don't await it here
  const responsePromise = conv.respond(effectiveSpeech);
  pendingResponses.set(callSid, responsePromise);

 // Play Rime TTS filler (godfrey voice) while LLM processes — avoids robot <Say> voice clash
  const base = process.env.PUBLIC_URL;
  const fillers = ["Mm-hmm.", "Sure.", "Got it.", "Right.", "I see."];
  const filler = encodeURIComponent(fillers[Math.floor(Math.random() * fillers.length)]);
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${base}/tts?text=${filler}&amp;stage=filler</Play>
  <Redirect method="POST">${base}/respond?callSid=${encodeURIComponent(callSid)}</Redirect>
</Response>`);
});

// â"€â"€â"€ Respond - await the pending LLM promise and return real TwiML â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
app.post("/respond", validateTwilio, async (req, res) => {
  const callSid = (req.query.callSid || req.body.CallSid) as string;
  const base = process.env.PUBLIC_URL;

  const promise = pendingResponses.get(callSid);
  if (!promise) {
    // No pending response - something went wrong, graceful fallback
    res.type("text/xml").send(buildGather("One moment please."));
    return;
  }

  pendingResponses.delete(callSid);

  try {
    let { text: reply, ended } = await promise;
    if (!ended) {
      const startedAt = callStartTimes.get(callSid);
      if (startedAt !== undefined && Date.now() - startedAt > 150_000) {
        reply = reply + " I appreciate your time — I'll follow up with more details shortly. Have a great day!";
        ended = true;
      }
    }
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
      conv.lastRespondedAt = Date.now();
      await setSession(callSid, conv);
      res.type("text/xml").send(buildGather(reply, currentStage, callSid));
    }
  } catch (e: any) {
    console.error("[RESPOND] Error:", e.message);
    const errText = encodeURIComponent("Sorry about that, I'll have someone follow up with you shortly.");
    const base2 = process.env.PUBLIC_URL ?? "";
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Play>${base2}/tts?text=${errText}&amp;stage=end</Play><Hangup/></Response>`);
  }
});

// â"€â"€â"€ No input â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
app.post("/no-input", validateTwilio, async (req, res) => {
  const callSid = req.body.CallSid;
  const conv = await getSession(callSid);
  if (!conv) {
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
    return;
  }

  conv.silenceStreak = (conv.silenceStreak ?? 0) + 1;

  if (conv.silenceStreak < 2) {
    const nudge = conv.silenceStreak === 1
      ? "Sorry, I didn't catch that - could you say that again?"
      : "Still there? Take your time, I'm listening.";
    await setSession(callSid, conv);
    res.type("text/xml").send(buildGather(nudge));
    return;
  }

  await finalizeCall(callSid, req.body.To || "", conv, 0);
  await removeSession(callSid);
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${process.env.PUBLIC_URL}/tts?text=${encodeURIComponent("No problem - feel free to reach us at J Supreme Tech anytime. Have a great day!")}</Play>
  <Hangup/>
</Response>`);
});

// â"€â"€â"€ Call status callback â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// â"€â"€â"€ Finalize: score + log + notify â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

    const mockupDest = mockup.wa_number ?? toNumber;
    const mockupColors = mockup.brand_colors ?? "not collected";
    const mockupStyle = mockup.style_pref ?? "not collected";
    const mockupNote = mockup.wa_number
      ? `Send free mockup to ${mockupDest} within 24h. Colors: ${mockupColors}. Style: ${mockupStyle}.`
      : `Mockup requested — WA not captured, use ${toNumber}. Colors: ${mockupColors}. Style: ${mockupStyle}. Follow up to confirm delivery.`;
    const nextAction = mockup.requested
      ? mockupNote
      : booked
      ? "Follow up within 24h to confirm proposal or trial start."
      : "No commitment - retry in 3 days if not DNC.";

    const contact = conv.getContactCapture();
    const rimeCharCount = conv.rimeChars ?? 0;
    const anthropicIn = conv.anthropicInputTokens ?? 0;
    const anthropicOut = conv.anthropicOutputTokens ?? 0;
    const durationMin = duration / 60;
    const callCostUsd = parseFloat(
      ((rimeCharCount / 1000) * 0.0075
        + (anthropicIn / 1_000_000) * 0.25
        + (anthropicOut / 1_000_000) * 1.25
        + durationMin * 0.007).toFixed(5)
    );
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
      contact_method: contact.method,
      contact_detail: contact.detail,
      next_action: nextAction,
      rime_chars: rimeCharCount,
      anthropic_input_tokens: anthropicIn,
      anthropic_output_tokens: anthropicOut,
      cost_usd: callCostUsd,
    });
    // Log to marketing_leads if marketing was discussed
    if (conv.hadMarketingInterest()) {
      const p = conv.getProspectData();
      await logMarketingLead({
        phone: toNumber,
        business_name: p.company_name,
        industry: p.industry,
        has_website: p.has_website,
        has_social: p.has_social,
        interest_level: booked ? "hot" : (stage === "close" || stage === "objection_address") ? "warm" : "cold",
        interested_services: ["social", "ads", "email", "ai_sales_bot"],
        contact_method: contact?.method,
        contact_detail: contact?.detail,
        notes: p.notes,
      });
    }
    // Sync to Supabase sales_calls so the conglomerate dashboard shows this call
    const supaUrl = process.env.SUPABASE_URL;
    const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supaUrl && supaKey) {
      const p = conv.getProspectData();
      fetch(`${supaUrl}/rest/v1/sales_calls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supaKey,
          "Authorization": `Bearer ${supaKey}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          call_sid: callSid,
          to_number: toNumber,
          lead_name: p?.company_name ?? null,
          lead_business: p?.company_name ?? null,
          duration_seconds: duration,
          outcome: "answered",
          transcript,
          booked_followup: booked,
          notes: nextAction,
        }),
      }).catch((e: any) => console.error("[FINAL] Supabase sync error:", e.message));
    }
    await notifyJordan({ callSid, toNumber, stage, booked, scores, mockup, contact, nextAction, transcript });
    console.log("[FINAL] Logged & notified. Stage:", stage, "| Mockup:", mockup.requested, "| DNC:", conv.isDncRequested());
  } catch (e: any) {
    console.error("[FINAL] Error:", e.message);
  }
}

async function notifyJordan(data: {
  callSid: string; toNumber: string; stage: string; booked: boolean;
  scores?: any; mockup: any; contact?: any; nextAction: string; transcript: string;
}) {
  const webhookUrl = process.env.WHATSAPP_NOTIFY_URL;
  if (!webhookUrl) return;

  const scoreStr = data.scores
    ? `Interest:${data.scores.interest} | Useful:${data.scores.usefulness} | Resourceful:${data.scores.resourcefulness} | Resonance:${data.scores.emotional_resonance} | Success:${data.scores.success}`
    : "Scores: pending";

  const message = [
    `*Kai Call Ended*`,
    `Number: ${data.toNumber}`,
    `Stage reached: ${data.stage}`,
    `Booked: ${data.booked ? "YES" : "NO"}`,
    `Mockup requested: ${data.mockup.requested ? "YES" : "NO"}`,
    data.mockup.requested ? `Mockup WA: ${data.mockup.wa_number ?? "not captured"} | Colors: ${data.mockup.brand_colors ?? "-"} | Style: ${data.mockup.style_pref ?? "-"}` : "",
    data.contact?.captured ? `Contact pref: ${data.contact.method ?? "??"} @ ${data.contact.detail ?? "not captured"}` : "Contact: not captured",
    scoreStr,
    `Next: ${data.nextAction}`,
  ].filter(Boolean).join("\n");

  const sends: Promise<any>[] = [];

  // Jarvis WA bot (Baileys — same Railway project, auto-injected URL)
  const waSendSecret = process.env.WA_SEND_SECRET;
  const jordanJid = process.env.JORDAN_WA_NUMBER;
  if (webhookUrl && waSendSecret && jordanJid) {
    // Jarvis WA bot: WHATSAPP_NOTIFY_URL is the /send endpoint
    sends.push(
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-send-secret": waSendSecret },
        body: JSON.stringify({ jid: jordanJid, text: message }),
      }).catch((e: any) => console.error("[NOTIFY] Jarvis WA send failed:", e.message))
    );
  } else if (webhookUrl) {
    sends.push(
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }).catch((e: any) => console.error("[NOTIFY] WhatsApp notify failed:", e.message))
    );
  }

  // Email alert on every call
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const subject = data.booked
      ? `HOT LEAD — ${data.toNumber} booked a follow-up`
      : data.mockup.requested
      ? `Mockup Requested — ${data.toNumber}`
      : `Kai Call Review — ${data.toNumber} | ${data.stage}`;
    const html = `<pre style="font-family:monospace;font-size:14px">${message.replace(/\*/g, "")}</pre>`;
    sends.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Sales Bot <sales@jsupremetech.online>",
          to: ["jordanmorris@jsupremetech.online"],
          subject,
          html,
        }),
      }).catch((e: any) => console.error("[NOTIFY] Resend email failed:", e.message))
    );
  }

  await Promise.allSettled(sends);
}

// â"€â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function buildGather(say: string, stage?: string, callSid?: string) {
  const base = process.env.PUBLIC_URL;
  const encoded = encodeURIComponent(say);
  const stageParam = stage ? `&amp;stage=${encodeURIComponent(stage)}` : "";
  const sidParam = callSid ? `&amp;sid=${encodeURIComponent(callSid)}` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${base}/gather" method="POST"
          speechTimeout="1.5" speechModel="phone_call"
          language="en-US" timeout="12">
    <Play>${base}/tts?text=${encoded}${stageParam}${sidParam}</Play>
  </Gather>
  <Redirect method="POST">${base}/no-input</Redirect>
</Response>`;
}


// â"€â"€â"€ Scrape leads from OpenStreetMap â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
app.post("/scrape", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "unauthorized" });

  const { limit } = req.body as { limit?: string };
  runAll(limit ? parseInt(limit) : 30).catch((e: unknown) => console.error("[SCRAPE]", (e as Error).message));
  res.json({ started: true, message: "Jamaica scraper running in background" });
});

// ─── Scrape international leads (Miami, Atlanta, NYC etc.) ───────────────────
app.post("/scrape-intl", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "unauthorized" });

  const { limit } = req.body as { limit?: number };
  runAllIntlMarkets(limit ?? 40).catch((e: unknown) => console.error("[SCRAPE-INTL]", (e as Error).message));
  res.json({ started: true, message: "International scraper running — Miami, Atlanta, NYC etc. No-website businesses only." });
});

// â"€â"€â"€ List leads with stats â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
app.post("/lead", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "unauthorized" });

  const { phone, business_name, category, recommended_product, has_website, notes, market } = req.body;
  if (!phone) return res.status(400).json({ error: "phone required" });

  const normalizedPhone = toE164(phone);
  const place_id = `manual_${normalizedPhone.replace(/\D/g, "")}`;

  const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await dbPool.query(
      `INSERT INTO sales_leads
         (place_id, business_name, phone, category, recommended_product, has_website, notes, market, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'new')
       ON CONFLICT (place_id) DO UPDATE SET
         status = 'new',
         business_name = EXCLUDED.business_name,
         category = EXCLUDED.category,
         recommended_product = EXCLUDED.recommended_product,
         has_website = EXCLUDED.has_website,
         notes = EXCLUDED.notes,
         market = EXCLUDED.market`,
      [
        place_id,
        business_name ?? "Unknown",
        normalizedPhone,
        category ?? null,
        recommended_product ?? null,
        has_website ?? false,
        notes ?? null,
        market ?? null,
      ]
    );
    console.log(`[LEAD] Upserted: ${normalizedPhone} (${business_name})`);
    res.json({ ok: true, place_id, phone: normalizedPhone });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  } finally {
    await dbPool.end();
  }
});

app.get("/leads", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "unauthorized" });

  const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const [statsRes, rowsRes] = await Promise.all([
      dbPool.query(`SELECT COUNT(*) FILTER (WHERE status = 'new') AS new_count, COUNT(*) FILTER (WHERE status = 'called') AS called_count, COUNT(*) FILTER (WHERE status = 'dnc') AS dnc_count, COUNT(*) AS total FROM sales_leads`),
      dbPool.query(`SELECT id, business_name, phone, address, category, recommended_product, has_website, status, called_at, created_at FROM sales_leads ORDER BY created_at DESC LIMIT 200`),
    ]);
    res.json({ stats: statsRes.rows[0], leads: rowsRes.rows });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  } finally {
    await dbPool.end();
  }
});

// ── Call logs: full outcome history ──────────────────────────────────────────
app.get("/call-logs", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "unauthorized" });

  const limit = Math.min(parseInt(String(req.query.limit ?? "200")), 500);
  const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const r = await dbPool.query(`
      SELECT
        cl.call_sid, cl.to_number, cl.company_name, cl.industry,
        cl.duration_seconds, cl.outcome, cl.transcript,
        cl.booked_followup, cl.stage_reached, cl.scores,
        cl.mockup_requested, cl.mockup_wa_number,
        cl.next_action, cl.contact_method, cl.contact_detail,
        cl.created_at,
        ml.interest_level, ml.interested_tier, ml.interested_services,
        sl.business_name AS lead_name, sl.recommended_product, sl.market
      FROM call_logs cl
      LEFT JOIN marketing_leads ml ON ml.phone = cl.to_number
      LEFT JOIN sales_leads sl ON sl.phone = cl.to_number
      ORDER BY cl.created_at DESC
      LIMIT $1
    `, [limit]);
    res.json({ call_logs: r.rows });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  } finally {
    await dbPool.end();
  }
});

// ── Follow-ups: hot/warm leads from marketing_leads ──────────────────────────
app.get("/follow-ups", async (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return res.status(401).json({ error: "unauthorized" });

  const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const r = await dbPool.query(`
      SELECT ml.phone, ml.business_name, ml.industry, ml.interest_level,
             ml.interested_services, ml.contact_method, ml.contact_detail,
             ml.notes, ml.created_at,
             cl.stage_reached, cl.booked_followup, cl.mockup_requested,
             cl.mockup_wa_number, cl.next_action, cl.call_sid
      FROM marketing_leads ml
      LEFT JOIN call_logs cl ON cl.to_number = ml.phone
      ORDER BY CASE ml.interest_level WHEN 'hot' THEN 1 WHEN 'warm' THEN 2 ELSE 3 END,
               ml.created_at DESC
      LIMIT 200
    `);
    res.json({ follow_ups: r.rows });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  } finally {
    await dbPool.end();
  }
});

app.get("/health", (_, res) => res.json({
  status: "ok",
  sessions: sessions.size,
  tts_cache: ttsCache.size,
  business_hours: isWithinBusinessHours(),
  time: new Date().toISOString(),
}));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Kai AI Sales Bot running on port ${PORT}`));

















