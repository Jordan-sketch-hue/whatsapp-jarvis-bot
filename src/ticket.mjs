/**
 * Auto-create ops_tickets from WhatsApp extractions.
 *
 * Fires after every successful extractUpdate(). Creates a ticket when the
 * extraction signals something actionable (support issue or high-priority
 * inbound that needs a reply). Skips spam, personal, and general chit-chat.
 * Dedupes on source_key so replaying the same message is idempotent.
 */
import { createHash } from "crypto";
import { supabase } from "./supabase.mjs";

const TICKET_CATEGORIES = new Set(["support", "payment", "order", "shipment", "scheduling", "inquiry"]);

function isTicketWorthy(extraction) {
  const { category, priority, needs_reply } = extraction;
  if (!category || category === "spam" || category === "personal" || category === "general") return false;
  if (category === "support") return true; // always ticket a support/complaint
  // Other business categories: only if high-priority and waiting on Jordan
  return priority === "high" && !!needs_reply && TICKET_CATEGORIES.has(category);
}

function ticketId(sourceKey) {
  return "t_" + createHash("sha256").update(sourceKey).digest("hex").slice(0, 16);
}

/**
 * @param {object} opts
 * @param {string} opts.chatId    - Baileys JID (chat identifier)
 * @param {string} opts.name      - contact display name
 * @param {string} opts.phone     - E.164-ish phone string
 * @param {object} opts.extraction - output of extractUpdate()
 * @param {object} opts.message   - { id, text, at }
 */
export async function maybeCreateTicket({ chatId, name, phone, extraction, message }) {
  if (!isTicketWorthy(extraction)) return;

  const sourceKey = `whatsapp:${chatId}:${message.id}`;
  const id = ticketId(sourceKey);

  const row = {
    id,
    source: "whatsapp",
    source_key: sourceKey,
    client_name: name ?? phone ?? null,
    contact: phone ?? null,
    channel: "whatsapp",
    category: extraction.category,
    priority: extraction.priority,
    summary: extraction.summary,
    body_text: message.text?.slice(0, 2000) ?? null,
    action_needed: extraction.action_needed || null,
    sla_hours: extraction.priority === "high" ? 4 : 24,
    due_at: new Date(Date.now() + (extraction.priority === "high" ? 4 : 24) * 3600_000).toISOString(),
    gate: "approval",
    is_scam: false,
    state: "triaged",
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("ops_tickets")
    .upsert(row, { onConflict: "source_key", ignoreDuplicates: true });

  if (error) {
    console.error("[ticket] create failed", error.message);
    return;
  }

  console.log(`[ticket] created ${id} — [${extraction.category}/${extraction.priority}] ${extraction.summary?.slice(0, 80)}`);

  // Fire push notification to Jordan's phone via the conglomerate PWA.
  const pushUrl = process.env.PUSH_NOTIFY_URL;
  const pushSecret = process.env.PUSH_NOTIFY_SECRET;
  if (pushUrl && pushSecret) {
    const clientLabel = name || phone || "Client";
    void fetch(pushUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-push-secret": pushSecret,
      },
      body: JSON.stringify({
        title: `${clientLabel} — ${extraction.category}`,
        body: extraction.summary?.slice(0, 120) ?? "Needs attention",
        url: "/jarvis/whatsapp",
        tag: id,
        urgent: extraction.priority === "high",
      }),
    }).catch((e) => console.error("[ticket] push failed", e.message));
  }
}
