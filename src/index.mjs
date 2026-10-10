/**
 * WhatsApp → Jarvis reader.
 *
 * Links Jordan's WhatsApp Business number as a "linked device" (one QR scan),
 * then listens to every chat. For each chat that goes quiet for a moment, it runs
 * the recent exchange through Claude and writes a per-client "update card" to
 * Supabase, which the conglomerate /jarvis/whatsapp hub renders.
 *
 * READ-ONLY by design: it never sends, reacts to, or deletes anything. It only
 * observes and summarizes. (To keep it that way, there is simply no send path.)
 */
import makeWASocket, {
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import {
  supabase,
  useSupabaseAuthState,
  clearAuthState,
  getSettings,
  patchSettings,
  heartbeat,
  upsertThreadUpdate,
} from "./supabase.mjs";
import { extractUpdate } from "./extract.mjs";
import { startServer } from "./server.mjs";
import { maybeAutoReply, noteOutbound } from "./autoreply.mjs";
import { notifyClientMessage, notifyInstant } from "./notify.mjs";
import { sendAlert, setAlertSock } from "./alert.mjs";
import { maybeCreateTicket } from "./ticket.mjs";

const DEBOUNCE_MS = Number(process.env.DEBOUNCE_MS) || 8000;
const logger = pino({ level: process.env.LOG_LEVEL || "warn" });

// Shared state the HTTP server reads (QR + link status).
const shared = { linked: false, qr: null, lastEventAt: null, startedAt: new Date().toISOString() };
startServer(shared);

// Live settings cache, refreshed every 60s so pause / capture_mode changes in the
// hub take effect without a redeploy.
let settings = await getSettings();
setInterval(async () => {
  try {
    settings = await getSettings();
  } catch {}
}, 60_000);

/* ------------------------------- message plumbing ------------------------------- */

function getText(msg) {
  const m = msg.message;
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    (m.buttonsResponseMessage?.selectedDisplayText ?? "") ||
    (m.listResponseMessage?.title ?? "") ||
    ""
  );
}

function phoneFromJid(jid) {
  const digits = (jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
  return digits || null;
}

// Per-chat coalescing buffer: collect a burst of messages, then extract once.
const buffers = new Map(); // chatId -> { timer, transcript, name }

function queue(chatId, entry, name, isGroup) {
  let buf = buffers.get(chatId);
  if (!buf) {
    buf = { timer: null, transcript: [], name, isGroup };
    buffers.set(chatId, buf);
  }
  if (name) buf.name = name;
  buf.transcript.push(entry);
  if (buf.transcript.length > 20) buf.transcript = buf.transcript.slice(-20);
  if (buf.timer) clearTimeout(buf.timer);
  buf.timer = setTimeout(() => void flush(chatId), DEBOUNCE_MS);
}

async function flush(chatId) {
  const buf = buffers.get(chatId);
  if (!buf) return;
  buffers.delete(chatId);

  if (settings.paused) return;
  if (buf.isGroup && settings.skip_groups) return;
  // Only card-worthy if the client actually said something in this window.
  if (!buf.transcript.some((m) => !m.fromMe)) return;

  const phone = phoneFromJid(chatId);
  const ctx = {
    name: buf.name,
    phone,
    isGroup: buf.isGroup,
    captureMode: settings.capture_mode || "all_business",
  };

  let extraction;
  try {
    extraction = await extractUpdate(buf.transcript, ctx);
  } catch (e) {
    logger.error({ e: e.message }, "extract failed");
    return;
  }
  if (!extraction) return; // not card-worthy

  const latest = buf.transcript[buf.transcript.length - 1];
  try {
    await upsertThreadUpdate({
      chat: { id: chatId, name: buf.name ?? null, phone, isGroup: buf.isGroup },
      extraction,
      message: { id: latest.id, text: latest.text, at: latest.at, fromMe: latest.fromMe },
    });
    console.log(`[card] ${buf.name || phone}: [${extraction.category}/${extraction.priority}] ${extraction.summary}`);
    void notifyClientMessage({ clientName: buf.name, phone, extraction, transcript: buf.transcript });
    void maybeCreateTicket({ chatId, name: buf.name, phone, extraction, message: latest, transcript: buf.transcript, sock: shared.sock });
  } catch (e) {
    logger.error({ e: e.message }, "write failed");
  }
}

function onMessages({ messages, type }) {
  if (type !== "notify") return;
  shared.lastEventAt = new Date().toISOString();
  void heartbeat();
  for (const msg of messages) {
    const jid = msg.key?.remoteJid;
    if (!jid || jid === "status@broadcast") continue; // ignore status posts
    if (jid.endsWith("@newsletter") || jid.endsWith("@broadcast")) continue; // WA Channels / broadcast lists — read-only feeds, never client work
    const text = getText(msg);
    if (!text && !msg.message) continue; // ignore receipts/empty
    const isGroup = jid.endsWith("@g.us");
    const at = msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString();
    queue(
      jid,
      { id: msg.key.id, text, fromMe: !!msg.key.fromMe, at },
      msg.key.fromMe ? null : msg.pushName || null,
      isGroup,
    );

    // Instant ping to Jordan the moment a message lands — no debounce, no Claude.
    if (!msg.key.fromMe && !isGroup && text) {
      void notifyInstant({
        clientName: msg.pushName || null,
        phone: phoneFromJid(jid),
        text,
      });
    }

    // Constrained, clients-only auto-reply (allowlist + guards live in autoreply.mjs).
    if (msg.key.fromMe) {
      noteOutbound(jid); // Jordan is active in this chat — suppress auto-acks here
    } else if (!isGroup && text) {
      // Pass the current transcript so Claude can reply contextually.
      const currentBuf = buffers.get(jid);
      void maybeAutoReply({
        sock: shared.sock,
        chatId: jid,
        phone: phoneFromJid(jid),
        isGroup,
        settings,
        transcript: currentBuf ? [...currentBuf.transcript] : [{ text, fromMe: false, at: new Date().toISOString() }],
      });
    }
  }
}

/* --------------------------------- connection --------------------------------- */

let starting = false;

async function start() {
  if (starting) return;
  starting = true;
  const { state, saveCreds } = await useSupabaseAuthState();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: Browsers.appropriate("J Supreme Jarvis"),
    markOnlineOnConnect: false, // keep the phone receiving its own notifications
    syncFullHistory: false,
  });
  starting = false;
  shared.sock = sock;
  setAlertSock(sock); // give the alert module a handle to send WA messages

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", onMessages);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      shared.qr = qr;
      shared.linked = false;
      await patchSettings({ linked: false, last_qr_at: new Date().toISOString(), last_note: "QR ready — scan to link" });
      console.log("[conn] QR ready — open /qr?token=… to link");
    }

    if (connection === "open") {
      shared.linked = true;
      shared.qr = null;
      await patchSettings({ linked: true, device_label: "J Supreme Jarvis", last_note: "Linked & listening" });
      console.log("[conn] linked & listening ✅");
    }

    if (connection === "close") {
      shared.linked = false;
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`[conn] closed (code ${code}) — ${loggedOut ? "logged out" : "reconnecting"}`);
      await patchSettings({ linked: false, last_note: loggedOut ? "Logged out — re-link needed" : "Reconnecting…" });
      if (loggedOut) {
        void sendAlert("WhatsApp device was LOGGED OUT. Bot needs a fresh QR scan to re-link.\nhttps://whatsapp-jarvis-bot-production.up.railway.app/qr?token=" + (process.env.QR_TOKEN || ""), "logged-out");
        await clearAuthState();
        setTimeout(() => void start(), 2000);
      } else {
        if (code !== 428) { // 428 = normal keep-alive restart, not worth alerting
          void sendAlert(`WhatsApp connection dropped (code ${code}). Reconnecting automatically…`, `conn-drop-${code}`);
        }
        setTimeout(() => void start(), 3000);
      }
    }
  });
}

console.log("[boot] WhatsApp → Jarvis reader starting…");
await start();

// Surface fatal errors instead of dying silently (Railway restarts on exit).
const NOISE_ERRORS = ["timed out", "connection closed", "connection reset", "econnreset", "socket hang up", "network error"];
const isNoise = (e) => NOISE_ERRORS.some(s => String(e).toLowerCase().includes(s));

process.on("unhandledRejection", (e) => {
  logger.error({ e: String(e) }, "unhandledRejection");
  if (!isNoise(e)) void sendAlert(`Unhandled rejection: ${String(e).slice(0, 200)}`, "unhandled-rejection");
});
process.on("uncaughtException", (e) => {
  logger.error({ e: String(e) }, "uncaughtException");
  if (!isNoise(e)) void sendAlert(`Uncaught exception: ${String(e).slice(0, 200)}`, "uncaught-exception");
});
