/**
 * Supabase wiring for the WhatsApp reader:
 *  - a service-role client (writes bypass RLS; the tables have RLS on + no policies)
 *  - a Supabase-backed Baileys auth state, so the linked-device session survives
 *    Railway redeploys without a disk volume
 *  - thin write helpers for the jarvis_wa_* tables
 *
 * The same Supabase project backs the conglomerate app, so whatever the bot writes
 * here shows up at /jarvis/whatsapp instantly.
 */
import { createClient } from "@supabase/supabase-js";
import { initAuthCreds, BufferJSON, proto } from "@whiskeysockets/baileys";
import WebSocket from "ws";

// supabase-js v2 always spins up a Realtime client, which needs a global
// WebSocket constructor. Node < 22 has none, so createClient() throws on boot.
// We never use Realtime (REST only), but the client still initializes it —
// so provide a WebSocket global. (Node 22+ already has one; this is a no-op there.)
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;

const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();

if (!url || !key) {
  console.error("[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — exiting.");
  process.exit(1);
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const AUTH_TABLE = "jarvis_wa_auth";

/* --------------------- Baileys auth state, backed by Supabase --------------------- */

async function readKV(k) {
  const { data, error } = await supabase.from(AUTH_TABLE).select("value").eq("key", k).maybeSingle();
  if (error) {
    console.error("[auth] read", k, error.message);
    return null;
  }
  if (!data) return null;
  // Re-hydrate Buffers that BufferJSON encoded on the way in.
  return JSON.parse(JSON.stringify(data.value), BufferJSON.reviver);
}

async function writeKV(k, value) {
  const encoded = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
  const { error } = await supabase
    .from(AUTH_TABLE)
    .upsert({ key: k, value: encoded, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) console.error("[auth] write", k, error.message);
}

async function removeKV(k) {
  const { error } = await supabase.from(AUTH_TABLE).delete().eq("key", k);
  if (error) console.error("[auth] remove", k, error.message);
}

/** Drop the whole linked-device session (used when WhatsApp logs the device out). */
export async function clearAuthState() {
  const { error } = await supabase.from(AUTH_TABLE).delete().neq("key", "");
  if (error) console.error("[auth] clear", error.message);
}

export async function useSupabaseAuthState() {
  const creds = (await readKV("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const out = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readKV(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              out[id] = value;
            }),
          );
          return out;
        },
        set: async (data) => {
          const tasks = [];
          for (const type of Object.keys(data)) {
            for (const id of Object.keys(data[type])) {
              const value = data[type][id];
              const k = `${type}-${id}`;
              tasks.push(value ? writeKV(k, value) : removeKV(k));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeKV("creds", creds),
  };
}

/* ------------------------------- settings / heartbeat ------------------------------- */

export async function getSettings() {
  const { data } = await supabase.from("jarvis_wa_settings").select("*").eq("id", "default").maybeSingle();
  return data ?? { id: "default", paused: false, capture_mode: "all_business", skip_groups: true, linked: false };
}

export async function patchSettings(patch) {
  const { error } = await supabase
    .from("jarvis_wa_settings")
    .upsert({ id: "default", ...patch, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) console.error("[settings] patch", error.message);
}

/** Cheap "I'm alive / a message arrived" ping for the hub's status line. */
export async function heartbeat(note) {
  await patchSettings({ last_event_at: new Date().toISOString(), ...(note ? { last_note: note } : {}) });
}

/* --------------------------------- thread + updates --------------------------------- */

/**
 * Upsert the per-chat card with the latest Claude extraction, and append the
 * update to the feed. Returns nothing — fire-and-forget from the message handler.
 */
export async function upsertThreadUpdate({ chat, extraction, message }) {
  const row = {
    chat_id: chat.id,
    chat_name: chat.name ?? null,
    phone: chat.phone ?? null,
    is_group: chat.isGroup,
    last_message_text: message.text?.slice(0, 2000) ?? null,
    last_message_at: message.at,
    last_message_from_me: message.fromMe,
    category: extraction.category,
    priority: extraction.priority,
    summary: extraction.summary,
    action_needed: extraction.action_needed || null,
    needs_reply: !!extraction.needs_reply,
    triage_engine: extraction.engine,
    extracted_at: new Date().toISOString(),
    // A fresh inbound update re-opens a card that was previously cleared.
    status: "open",
  };

  const { data: thread, error } = await supabase
    .from("jarvis_wa_threads")
    .upsert(row, { onConflict: "chat_id" })
    .select("id")
    .single();
  if (error) {
    console.error("[thread] upsert", error.message);
    return;
  }

  const { error: uErr } = await supabase.from("jarvis_wa_updates").upsert(
    {
      thread_uuid: thread.id,
      chat_id: chat.id,
      category: extraction.category,
      summary: extraction.summary,
      detail: extraction.action_needed || null,
      source_message_id: message.id,
    },
    { onConflict: "thread_uuid,source_message_id", ignoreDuplicates: true },
  );
  if (uErr) console.error("[update] insert", uErr.message);
}
