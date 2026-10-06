/**
 * Turn a short WhatsApp exchange into one structured "update card" for Jordan.
 *
 * Engine: Claude (Anthropic Messages API) when ANTHROPIC_API_KEY is set —
 * defaults to Haiku because this runs on every client message and needs to be
 * cheap. Falls back to a deterministic keyword heuristic so the reader still
 * works with no key and never blocks the message pipeline.
 *
 * Capture mode (from jarvis_wa_settings.capture_mode) decides what's worth a card:
 *   all_business           → any client business chat (default — what Jordan chose)
 *   action_money_shipping  → only replies owed, payments, shipments, deadlines
 *   urgent_only            → only clearly time-sensitive items
 * Returning null means "not worth a card" — the message is skipped.
 */

const CATEGORIES = [
  "payment",
  "order",
  "shipment",
  "scheduling",
  "inquiry",
  "support",
  "personal",
  "spam",
  "general",
];

/* --------------------------------- heuristic --------------------------------- */

const RE = {
  payment: /\b(pay|paid|payment|deposit|transfer|invoice|owe|balance|wipay|cash app|cashapp|zelle|\$|jmd|usd)\b/i,
  shipment: /\b(ship|shipping|shipment|package|parcel|tracking|delivered|delivery|pickup|customs|barrel|freight|courier)\b/i,
  order: /\b(order|buy|purchase|quantity|in stock|sold out|available|reserve|qty)\b/i,
  scheduling: /\b(meeting|call|schedule|appointment|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|what time|book)\b/i,
  inquiry: /\b(how much|price|pricing|cost|quote|do you|can you|interested|available\?|info|details)\b/i,
  support: /\b(problem|issue|not working|broken|help|complaint|refund|wrong|late|where('|’)?s my)\b/i,
};
const SPAM = /\b(you('|’)?ve won|congratulations|claim your|crypto|forex|verify your account|click here|free gift)\b/i;

function lastInbound(transcript) {
  for (let i = transcript.length - 1; i >= 0; i--) if (!transcript[i].fromMe) return transcript[i].text || "";
  return "";
}

function heuristic(transcript) {
  const lastClient = lastInbound(transcript);
  const blob = transcript.map((m) => m.text || "").join(" ");
  if (!lastClient.trim() && !blob.trim()) return null;
  if (SPAM.test(blob)) return { category: "spam", priority: "low", summary: lastClient.slice(0, 160) || "Likely spam", action_needed: "", needs_reply: false, engine: "heuristic" };

  let category = "general";
  for (const c of ["payment", "shipment", "order", "scheduling", "support", "inquiry"]) {
    if (RE[c].test(blob)) { category = c; break; }
  }
  const lastIsClient = transcript.length > 0 && !transcript[transcript.length - 1].fromMe;
  const priority = category === "support" || category === "payment" ? "high" : category === "general" ? "low" : "medium";
  return {
    category,
    priority: lastIsClient ? priority : "low",
    summary: (lastClient || blob).slice(0, 160),
    action_needed: lastIsClient ? "Reply to the client" : "",
    needs_reply: lastIsClient,
    engine: "heuristic",
  };
}

/* ----------------------------------- Claude ----------------------------------- */

function transcriptText(transcript, who) {
  return transcript
    .slice(-12)
    .map((m) => `${m.fromMe ? "Me" : who}: ${m.text || "[media/attachment]"}`)
    .join("\n");
}

async function claude(transcript, ctx) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.CLAUDE_MODEL?.trim() || "claude-haiku-4-5-20251001";
  const who = ctx.name || ctx.phone || "Client";

  const system = `You are the WhatsApp triage brain for Jordan Morris, founder of the J Supreme group (a Jamaica-based studio + several small businesses: web/app/marketing services, a courier "BP Couriers", "Ship 2 Door" package forwarding, "Morris Pizza", car detailing, etc.). You read one WhatsApp Business conversation and produce ONE compact "update card" so Jordan knows the state of that client without opening the chat.

Capture mode: ${ctx.captureMode}.
- all_business: surface ANY real business conversation (clients, orders, payments, shipments, leads, scheduling). Skip pure social chit-chat unless it carries a business action.
- action_money_shipping: ONLY surface if there is a reply owed, money, a shipment/order, or a deadline.
- urgent_only: ONLY surface clearly time-sensitive items.

If this conversation does not warrant a card under the active capture mode, return {"skip": true}.

Return STRICT JSON only, no prose:
{"skip": false, "category": one of [${CATEGORIES.join(", ")}], "priority": "high"|"medium"|"low", "summary": "<=160 chars, what is going on with this client right now", "action_needed": "<=120 chars, the single next thing Jordan should do, or empty string if none", "needs_reply": true|false}

Rules: be terse and concrete. "summary" describes the situation; "action_needed" is an imperative ("Confirm the $25k payment cleared", "Send tracking for the barrel", ""). needs_reply = true only if the client is waiting on Jordan. If the latest message is a possible scam (fake transfer, "call this number to verify", advance-fee), set category "spam", priority "high", and put the warning in action_needed.`;

  const user = `Contact: ${who}${ctx.phone ? ` (${ctx.phone})` : ""}
Recent messages (oldest → newest):
${transcriptText(transcript, who)}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!r.ok) {
      console.error("[claude] HTTP", r.status, (await r.text()).slice(0, 200));
      return null;
    }
    const data = await r.json();
    const raw = data?.content?.[0]?.text ?? "";
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const p = JSON.parse(json);
    if (p.skip) return { skip: true };
    const category = CATEGORIES.includes(p.category) ? p.category : "general";
    const priority = ["high", "medium", "low"].includes(p.priority) ? p.priority : "medium";
    return {
      category,
      priority,
      summary: String(p.summary ?? "").slice(0, 160),
      action_needed: String(p.action_needed ?? "").slice(0, 120),
      needs_reply: !!p.needs_reply,
      engine: "claude",
    };
  } catch (e) {
    console.error("[claude] parse/error", e.message);
    return null;
  }
}

/**
 * @returns extraction object, or null to skip this chat (not card-worthy).
 */
export async function extractUpdate(transcript, ctx) {
  const ai = await claude(transcript, ctx);
  if (ai?.skip) return null;
  if (ai) return ai;
  // Heuristic fallback. In the two stricter modes, only keep action/money/urgent.
  const h = heuristic(transcript);
  if (!h) return null;
  if (ctx.captureMode === "urgent_only" && h.priority !== "high") return null;
  if (ctx.captureMode === "action_money_shipping" && !h.needs_reply && !["payment", "shipment", "order"].includes(h.category))
    return null;
  return h;
}
