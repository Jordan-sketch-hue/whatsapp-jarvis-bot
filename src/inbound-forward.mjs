/**
 * Forward messages from known JIDs (Ferguson Law owner, Jordan) to external
 * inbound webhooks immediately — no debounce, no Claude extraction.
 *
 * Env vars (set in Railway):
 *   INBOUND_FORWARD_URL    — e.g. https://fergusonlawja.com/api/whatsapp/inbound
 *   INBOUND_FORWARD_SECRET — must match the ferg-law WHATSAPP_BOT_SECRET
 */

const FORWARD_JIDS = new Set([
  "18768405862@s.whatsapp.net", // Owen Ferguson (FL owner)
  "16582182282@s.whatsapp.net", // Jordan
]);

const lastForwardAt = new Map();
const FORWARD_COOLDOWN_MS = 3000;

export async function maybeForwardInbound(msg, text) {
  const url = process.env.INBOUND_FORWARD_URL;
  const secret = process.env.INBOUND_FORWARD_SECRET || "";
  if (!url) return;

  const jid = msg.key?.remoteJid ?? "";
  if (!FORWARD_JIDS.has(jid)) return;
  if (msg.key?.fromMe) return;
  if (!text?.trim()) return;

  const now = Date.now();
  if (now - (lastForwardAt.get(jid) || 0) < FORWARD_COOLDOWN_MS) return;
  lastForwardAt.set(jid, now);

  const payload = {
    jid,
    text,
    pushName: msg.pushName || null,
    messageId: msg.key?.id || null,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-send-secret": secret,
        "x-inbound-secret": secret,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    console.log(`[inbound-fwd] forwarded ${jid} (${res.status}) ticketId=${json.ticketId ?? "?"}`);
  } catch (e) {
    console.error("[inbound-fwd] forward failed:", e?.message);
  }
}