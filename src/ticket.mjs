/**
 * Auto-create ops_tickets from WhatsApp extractions.
 *
 * Flow:
 *   1. isTicketWorthy() — skip spam/personal/general
 *   2. Check for an existing open ticket from same contact in last 48h
 *      → if found, append new context to it (follow-up, not a new ticket)
 *      → if not, create a new ticket
 *   3. Send a one-line ACK to the client on WhatsApp confirming receipt
 *   4. POST push notification to the conglomerate PWA
 */
import { createHash } from "crypto";
import { supabase } from "./supabase.mjs";

const TICKET_CATEGORIES = new Set(["support", "payment", "order", "shipment", "scheduling", "inquiry"]);

/** Cooldown — one ACK per chat per 30 min to avoid spamming if multiple issues land close together. */
const ticketAckMap = new Map(); // chatId → ts
const TICKET_ACK_COOLDOWN_MS = 30 * 60 * 1000;

function isTicketWorthy(extraction) {
  const { category, priority, needs_reply } = extraction;
  if (!category || category === "spam" || category === "personal" || category === "general") return false;
  if (category === "support") return true;
  return priority === "high" && !!needs_reply && TICKET_CATEGORIES.has(category);
}

function ticketId(sourceKey) {
  return "t_" + createHash("sha256").update(sourceKey).digest("hex").slice(0, 16);
}

function buildTranscript(messages) {
  return messages
    .slice(-20)
    .map((m) => `[${m.fromMe ? "Jordan" : "Client"}] ${m.text || "[media]"}`)
    .join("\n");
}

async function findOpenTicket(phone) {
  if (!phone) return null;
  const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data } = await supabase
    .from("ops_tickets")
    .select("id, body_text")
    .eq("contact", phone)
    .in("state", ["triaged", "awaiting_approval"])
    .gte("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

async function appendToTicket(ticketId, newTranscript, extraction) {
  const separator = "\n\n--- follow-up ---\n";
  const { data: existing } = await supabase
    .from("ops_tickets")
    .select("body_text")
    .eq("id", ticketId)
    .single();

  const combined = (existing?.body_text ?? "") + separator + newTranscript;
  const { error } = await supabase
    .from("ops_tickets")
    .update({
      body_text: combined.slice(0, 4000),
      summary: extraction.summary ?? undefined,
      action_needed: extraction.action_needed ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);
  if (error) console.error("[ticket] append failed", error.message);
  else console.log(`[ticket] appended to ${ticketId}`);
  return !error;
}

async function sendAck(sock, chatId, name, ticketRef) {
  if (!sock) return;
  const now = Date.now();
  if (now - (ticketAckMap.get(chatId) || 0) < TICKET_ACK_COOLDOWN_MS) return;
  ticketAckMap.set(chatId, now);
  try {
    const first = (name || "").split(/[\s—-]+/).filter(Boolean)[0] || "there";
    const text = `Hi ${first}, your message has been received and logged (ref: ${ticketRef}). We will review and respond shortly. You can reply here if you have additional details.`;
    await sock.sendMessage(chatId, { text });
    console.log(`[ticket] ack sent to ${chatId}`);
  } catch (e) {
    console.error("[ticket] ack send failed", e?.message);
    ticketAckMap.delete(chatId);
  }
}

async function sendPushAlert(ticketRef, name, phone, extraction) {
  const pushUrl = process.env.PUSH_NOTIFY_URL;
  const pushSecret = process.env.PUSH_NOTIFY_SECRET;
  if (!pushUrl || !pushSecret) return;
  const clientLabel = name || phone || "Client";
  void fetch(pushUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-push-secret": pushSecret },
    body: JSON.stringify({
      title: `${clientLabel} — ${extraction.category}`,
      body: extraction.summary?.slice(0, 120) ?? "Needs attention",
      url: "/jarvis/whatsapp",
      tag: ticketRef,
      urgent: extraction.priority === "high",
    }),
  }).catch((e) => console.error("[ticket] push failed", e.message));
}

/**
 * @param {object} opts
 * @param {string}   opts.chatId     Baileys JID
 * @param {string}   opts.name       Contact display name
 * @param {string}   opts.phone      E.164-ish phone string
 * @param {object}   opts.extraction Output of extractUpdate()
 * @param {object}   opts.message    Latest message { id, text, at }
 * @param {Array}    opts.transcript Full conversation buffer (last ~20 msgs)
 * @param {object}   [opts.sock]     Baileys socket for sending the ACK
 */
export async function maybeCreateTicket({ chatId, name, phone, extraction, message, transcript = [], sock, onSent }) {
  if (!isTicketWorthy(extraction)) return;

  const fullText = buildTranscript(transcript.length ? transcript : [message]);

  // --- Follow-up: append to existing open ticket ---
  const existing = await findOpenTicket(phone);
  if (existing) {
    const appended = await appendToTicket(existing.id, fullText, extraction);
    if (appended) {
      void sendAck(sock, chatId, name, existing.id);
      void sendPushAlert(existing.id, name, phone, extraction);
      return;
    }
    // Fall through to create a new ticket if append failed
  }

  // --- New ticket ---
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
    body_text: fullText.slice(0, 4000),
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
  void sendAck(sock, chatId, name, id);
  void sendPushAlert(id, name, phone, extraction);
}
