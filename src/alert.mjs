/**
 * System alert broadcaster — WhatsApp + Telegram + Email.
 * Called when the bot detects something is haywire (disconnects, auth errors, crashes).
 *
 * Env vars:
 *   JORDAN_PHONE          — Jordan's WA number digits-only (e.g. 16582182282)
 *   TELEGRAM_BOT_TOKEN    — from @BotFather
 *   TELEGRAM_CHAT_ID      — Jordan's Telegram user/chat ID (get via /start on the bot)
 *   RESEND_API_KEY        — already used by notify.mjs
 *   NOTIFY_EMAIL          — destination email (defaults to jordanmorrisr@gmail.com)
 */

const RESEND_URL = "https://api.resend.com/emails";
const FROM       = "JARVIS <jarvis@jsupremeconglomerate.online>";
const TO_EMAIL   = () => process.env.NOTIFY_EMAIL?.trim() || "jordanmorrisr@gmail.com";

let _sock = null;

/** Call once from index.mjs after the socket is created. */
export function setAlertSock(sock) { _sock = sock; }

/* ─── WhatsApp ─────────────────────────────────────────────────────────────── */

async function alertWhatsApp(message) {
  const phone = process.env.JORDAN_PHONE?.trim();
  if (!phone || !_sock) return;
  try {
    const jid = `${phone.replace(/\D/g, "")}@s.whatsapp.net`;
    await _sock.sendMessage(jid, { text: `⚠️ JARVIS ALERT\n${message}` });
    console.log("[alert:wa] sent");
  } catch (e) {
    console.error("[alert:wa] failed:", e?.message);
  }
}

/* ─── Telegram ─────────────────────────────────────────────────────────────── */

async function alertTelegram(message) {
  const token  = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚠️ *JARVIS ALERT*\n${message}`,
        parse_mode: "Markdown",
      }),
    });
    if (!r.ok) console.error("[alert:telegram]", r.status, (await r.text()).slice(0, 100));
    else console.log("[alert:telegram] sent");
  } catch (e) {
    console.error("[alert:telegram] failed:", e?.message);
  }
}

/* ─── Email ────────────────────────────────────────────────────────────────── */

async function alertEmail(message) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:20px 16px">
  <div style="background:#1a0a0a;border:1px solid #7f1d1d;border-radius:12px;padding:20px 22px">
    <p style="margin:0 0 6px;font-size:11px;color:#ef4444;text-transform:uppercase;letter-spacing:.08em">⚠️ JARVIS System Alert</p>
    <pre style="margin:0;font-size:14px;color:#fca5a5;white-space:pre-wrap;line-height:1.5">${message.replace(/</g,"&lt;")}</pre>
  </div>
  <p style="margin:12px 0 0;font-size:11px;color:#334155;text-align:center">JARVIS · (658) 218-2282</p>
</div></body></html>`;

  try {
    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: ["jordanrmorris01@icloud.com"],
        bcc: ["jordanmorrisr@gmail.com"],
        subject: `⚠️ JARVIS Alert — ${message.slice(0, 60)}`,
        html,
      }),
    });
    if (!r.ok) console.error("[alert:email]", r.status, (await r.text()).slice(0, 100));
    else console.log("[alert:email] sent");
  } catch (e) {
    console.error("[alert:email] failed:", e?.message);
  }
}

/* ─── Public API ────────────────────────────────────────────────────────────── */

const alertCooldowns = new Map(); // key → last alert ts
const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // don't spam the same alert for 10 min

/**
 * Send a system alert to all three channels.
 * @param {string} message — plain-text description of what's wrong
 * @param {string} [dedupeKey] — optional key to suppress repeats (e.g. "conn-close")
 */
export async function sendAlert(message, dedupeKey) {
  if (dedupeKey) {
    const last = alertCooldowns.get(dedupeKey) || 0;
    if (Date.now() - last < ALERT_COOLDOWN_MS) return;
    alertCooldowns.set(dedupeKey, Date.now());
  }
  console.error(`[alert] ${message}`);
  await Promise.allSettled([
    alertWhatsApp(message),
    alertTelegram(message),
    // alertEmail disabled — Telegram-only alerts per Jordan 2026-07-25
  ]);
}
