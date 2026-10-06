/**
 * Send a WhatsApp message via the self-hosted jarvis bot, UTF-8 safe.
 *
 *   node scripts/send.mjs <jid> <utf8-text-file>
 *
 * WHY a script instead of `curl -d '...'`:
 * On Windows, curl's -d/--data flag passes the body through the shell's argv
 * which uses the system codepage (cp1252). Multi-byte UTF-8 (emojis, em-dash —,
 * smart quotes) gets best-fit-replaced and arrives at the bot as ???? or �.
 * Reading the text from a file as UTF-8 and POSTing via Node's fetch keeps
 * every byte intact end-to-end.
 *
 * Config (endpoint + secret) is read from the central state file so every
 * notifier in the conglomerate shares one source of truth.
 */
import fs from "node:fs";

const [, , jid, textFile] = process.argv;
if (!jid || !textFile) {
  console.error("Usage: node scripts/send.mjs <jid> <utf8-text-file>");
  process.exit(2);
}

const CFG_PATH = "C:/Users/jader/.claude/state/whatsapp.json";
const cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
if (!cfg.enabled) {
  console.error("[send] whatsapp.enabled=false — refusing to send. Flip enabled=true in", CFG_PATH);
  process.exit(3);
}

const text = fs.readFileSync(textFile, "utf8");
if (!text.trim()) {
  console.error("[send] empty text body");
  process.exit(4);
}

// Sanity-log the first 60 chars + a byte-count so a regression is obvious.
const preview = text.slice(0, 60).replace(/\n/g, "\\n");
const bytes = Buffer.byteLength(text, "utf8");
console.log(`[send] → ${jid} (${bytes} bytes UTF-8): ${preview}${text.length > 60 ? "…" : ""}`);

const res = await fetch(cfg.endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json; charset=utf-8",
    "x-send-secret": cfg.secret,
  },
  body: JSON.stringify({ jid, text }),
});
const out = await res.text();
console.log(`[send] ← ${res.status} ${out}`);
if (!res.ok) process.exit(5);
