/**
 * Two-tier email notifications — Instagram-style:
 *
 *  1. notifyInstant()  — fires the MOMENT a client message lands (no debounce,
 *                        no Claude). Just the raw text, like an IG DM ping.
 *  2. notifyClientMessage() — fires after Claude extraction (~15s later) with
 *                        full context: summary, category, priority, transcript.
 *
 * Requires RESEND_API_KEY + NOTIFY_EMAIL in Railway vars.
 * Silently skips if either is missing.
 */

const RESEND_URL = "https://api.resend.com/emails";
const FROM = "JARVIS <jarvis@jsupremeconglomerate.online>";

/**
 * Instant ping — called immediately when the message arrives in onMessages.
 * Mirrors Instagram: you see the message the second it lands.
 */
export async function notifyInstant({ clientName, phone, text }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = process.env.NOTIFY_EMAIL?.trim() || "jordanmorrisr@gmail.com";
  if (!key || !text?.trim()) return;

  const display = clientName || phone || "Client";
  const subject = `💬 ${display}: ${text.slice(0, 80)}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:20px 16px">
  <div style="background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:20px 22px">
    <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em">WhatsApp · New Message</p>
    <p style="margin:0 0 14px;font-size:17px;font-weight:600;color:#f1f5f9">${display}</p>
    <div style="background:#0d0d16;border:1px solid #1e1e2e;border-radius:8px;padding:14px 16px">
      <p style="margin:0;font-size:15px;color:#e2e8f0;line-height:1.5">${text.replace(/</g, "&lt;")}</p>
    </div>
    ${phone ? `<p style="margin:12px 0 0;font-size:11px;color:#334155">+${phone}</p>` : ""}
  </div>
  <p style="margin:12px 0 0;font-size:11px;color:#334155;text-align:center">JARVIS · (658) 218-2282</p>
</div>
</body></html>`;

  try {
    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!r.ok) console.error("[notify:instant] Resend", r.status, (await r.text()).slice(0, 200));
    else console.log(`[notify:instant] ${display}: ${text.slice(0, 60)}`);
  } catch (e) {
    console.error("[notify:instant] failed:", e?.message);
  }
}

function priorityBadge(p) {
  return p === "high" ? "🔴 HIGH" : p === "medium" ? "🟡 MEDIUM" : "⚪ LOW";
}

function categoryLabel(c) {
  const map = {
    payment: "💳 Payment",
    order: "📦 Order",
    shipment: "🚚 Shipment",
    scheduling: "📅 Scheduling",
    inquiry: "❓ Inquiry",
    support: "🆘 Support",
    personal: "👤 Personal",
    spam: "⚠️ Spam",
    general: "💬 General",
  };
  return map[c] || c;
}

function buildHtml({ clientName, phone, extraction, transcript }) {
  const rows = transcript
    .slice(-10)
    .map(
      (m) =>
        `<tr style="background:${m.fromMe ? "#1a1a2e" : "#0f0f1a"}">
          <td style="padding:6px 10px;color:${m.fromMe ? "#94a3b8" : "#e2e8f0"};font-size:13px;width:52px;white-space:nowrap">${m.fromMe ? "You" : clientName || "Client"}</td>
          <td style="padding:6px 10px;color:${m.fromMe ? "#94a3b8" : "#f1f5f9"};font-size:13px">${(m.text || "[media]").replace(/</g, "&lt;")}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">

  <div style="background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:24px;margin-bottom:16px">
    <p style="margin:0 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em">WhatsApp · Client Message</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#f1f5f9">${clientName || phone}</h1>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
      <span style="background:#1e1e2e;border:1px solid #334155;border-radius:6px;padding:4px 10px;font-size:12px;color:#94a3b8">${categoryLabel(extraction.category)}</span>
      <span style="background:#1e1e2e;border:1px solid #334155;border-radius:6px;padding:4px 10px;font-size:12px;color:#94a3b8">${priorityBadge(extraction.priority)}</span>
      ${phone ? `<span style="background:#1e1e2e;border:1px solid #334155;border-radius:6px;padding:4px 10px;font-size:12px;color:#64748b">+${phone}</span>` : ""}
    </div>

    <p style="margin:0 0 6px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em">Summary</p>
    <p style="margin:0 0 20px;font-size:15px;color:#e2e8f0;line-height:1.5">${extraction.summary}</p>

    ${extraction.action_needed ? `
    <div style="background:#1e2a1e;border:1px solid #166534;border-radius:8px;padding:12px 14px;margin-bottom:20px">
      <p style="margin:0 0 4px;font-size:11px;color:#4ade80;text-transform:uppercase;letter-spacing:.08em">Action needed</p>
      <p style="margin:0;font-size:14px;color:#bbf7d0">${extraction.action_needed}</p>
    </div>` : ""}
  </div>

  <div style="background:#0d0d16;border:1px solid #1e1e2e;border-radius:12px;overflow:hidden">
    <p style="margin:0;padding:10px 14px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #1e1e2e">Recent conversation</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
  </div>

  <p style="margin:16px 0 0;font-size:11px;color:#334155;text-align:center">JARVIS · J Supreme · (658) 218-2282</p>
</div>
</body></html>`;
}

/**
 * Send a client-message notification email to Jordan.
 * @param {{ clientName:string, phone:string, extraction:object, transcript:Array }} opts
 */
export async function notifyClientMessage({ clientName, phone, extraction, transcript }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const to = process.env.NOTIFY_EMAIL?.trim() || "jordanmorrisr@gmail.com";
  if (!key) return; // silently skip — bot works without email

  const subject = `[${(extraction.priority || "").toUpperCase()}] ${clientName || phone}: ${(extraction.summary || "").slice(0, 80)}`;

  try {
    const r = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html: buildHtml({ clientName, phone, extraction, transcript }),
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => "");
      console.error("[notify] Resend error", r.status, err.slice(0, 200));
    } else {
      console.log(`[notify] emailed — ${subject.slice(0, 80)}`);
    }
  } catch (e) {
    console.error("[notify] fetch failed:", e?.message);
  }
}
