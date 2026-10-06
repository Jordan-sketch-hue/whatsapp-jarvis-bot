/**
 * Contextual, clients-ONLY auto-reply powered by Claude.
 *
 * Fires only when ALL hold:
 *   - sender's number is in clients.json / DB allowlist (clients only, never personal)
 *   - not a group
 *   - the bot booted more than STARTUP_GRACE_MS ago
 *   - Jordan hasn't sent in that chat within RECENT_REPLY_MS
 *   - no ack already sent to that chat within ACK_COOLDOWN_MS
 *
 * Sends ONE contextual Claude reply — acknowledges what they actually said,
 * stays brief and WA-natural, never quotes prices or makes commitments.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

let allowlist = {};
try {
  allowlist = JSON.parse(readFileSync(join(__dirname, "clients.json"), "utf8")).allowlist || {};
} catch (e) {
  console.error("[autoreply] could not read clients.json:", e?.message);
}

const ACK_COOLDOWN_MS  = 3 * 60 * 1000;        // one reply per chat / 3 min
const RECENT_REPLY_MS  = 2 * 60 * 60 * 1000;   // skip if Jordan replied within 2h
const STARTUP_GRACE_MS = 15 * 60 * 1000;        // no replies for 15 min after boot

const bootAt       = Date.now();
const lastAck      = new Map();       // chatId → ts of last auto-reply
const lastOutbound = new Map();       // chatId → ts of Jordan's last own message

export function isClient(phone) {
  return !!(phone && allowlist[phone]);
}

export function noteOutbound(chatId) {
  lastOutbound.set(chatId, Date.now());
}

/* ─── Claude contextual reply ─────────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are Jordan Morris's WhatsApp assistant at J Supreme — a Jamaican technology and marketing company.

A client just messaged Jordan. Write ONE short, warm, contextual WhatsApp reply that:
- Acknowledges specifically what they said (don't be generic)
- Lets them know Jordan received it and will respond personally
- Is natural WA-length (1–3 sentences max)
- Sounds like Jordan's friendly professional voice — confident, warm, Jamaican-run business
- NEVER quotes a price or dollar amount (say "I'll have Jordan confirm the details")
- NEVER makes a commitment, books anything, or answers technical questions
- NEVER mentions you're an AI
- Ends with "— Jordan, J Supreme" on a new line

Reply ONLY with the message text. No quotes. No preamble.`;

async function tryAnthropic(userPrompt) {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!r.ok) { console.error("[autoreply] Anthropic", r.status); return null; }
  const d = await r.json();
  return d.content?.[0]?.text?.trim() || null;
}

async function tryGroq(userPrompt) {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return null;
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 200,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
    }),
  });
  if (!r.ok) { console.error("[autoreply] Groq", r.status); return null; }
  const d = await r.json();
  return d.choices?.[0]?.message?.content?.trim() || null;
}

async function tryOpenRouter(userPrompt) {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json", "HTTP-Referer": "https://jsupremeconglomerate.online" },
    body: JSON.stringify({
      model: "meta-llama/llama-3.1-8b-instruct:free",
      max_tokens: 200,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
    }),
  });
  if (!r.ok) { console.error("[autoreply] OpenRouter", r.status); return null; }
  const d = await r.json();
  return d.choices?.[0]?.message?.content?.trim() || null;
}

async function buildContextualReply(label, transcript) {
  const recent = transcript.slice(-6).map(m => `${m.fromMe ? "Jordan" : label}: ${m.text || "[media]"}`).join("\n");
  const userPrompt = `Client name: ${label}\n\nRecent conversation:\n${recent}\n\nWrite the reply now.`;

  for (const fn of [tryGroq, tryOpenRouter, tryAnthropic]) {
    try {
      const result = await fn(userPrompt);
      if (result) return result;
    } catch (e) {
      console.error("[autoreply] provider failed:", e?.message);
    }
  }
  return buildFallback(label);
}

function buildFallback(label) {
  const first = (label || "").split(/[\s—-]+/).filter(Boolean)[0] || "there";
  const hours = process.env.OFFICE_HOURS || "Mon–Fri, 9am–5pm (Jamaica)";
  return `Hi ${first} 🙏 thanks for reaching out — Jordan's got your message and will get back to you personally shortly. Office hours: ${hours}.\n— Jordan, J Supreme`;
}

/* ─── Main export ──────────────────────────────────────────────────────────── */

/**
 * @param {{sock, chatId, phone, isGroup, settings, transcript}} opts
 */
export async function maybeAutoReply({ sock, chatId, phone, isGroup, settings, transcript = [] }) {
  if (settings?.autoreply_enabled === false) return false;
  if (isGroup) return false;
  if (!sock) return false;

  const dbList = settings?.client_allowlist;
  const list   = (dbList && typeof dbList === "object" && Object.keys(dbList).length) ? dbList : allowlist;
  const label  = phone && list[phone];
  if (!label) return false;

  const now = Date.now();
  if (now - bootAt                          < STARTUP_GRACE_MS) return false;
  if (now - (lastOutbound.get(chatId) || 0) < RECENT_REPLY_MS)  return false;
  if (now - (lastAck.get(chatId)      || 0) < ACK_COOLDOWN_MS)  return false;

  lastAck.set(chatId, now);
  try {
    const text = await buildContextualReply(label, transcript);
    await sock.sendMessage(chatId, { text });
    console.log(`[autoreply] replied to ${label}`);
    return true;
  } catch (e) {
    console.error("[autoreply] send failed:", e?.message);
    lastAck.delete(chatId);
    return false;
  }
}
