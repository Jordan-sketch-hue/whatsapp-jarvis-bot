# AGENTS.md — whatsapp-jarvis-bot

> Handoff document for any Claude agent picking this project up cold.

## Purpose

Read-only WhatsApp linked-device bot for J Supreme Tech. Links Jordan's WhatsApp Business
number as a secondary device (one QR scan), reads every chat, runs client messages through
Claude to produce update cards, and forwards messages from known JIDs (Owen Ferguson, Jordan)
directly to the Ferguson Law inbound webhook — triggering auto-ticket creation.

This is **not** a bot account. It is a linked device observer with a guarded `/send` endpoint
so the Client Ops Autopilot can ping back.

## Status (Oct 2026)

| Item | Status |
|------|--------|
| Local code | Ready at `C:\Users\jader\J Supreme Tech\whatsapp-jarvis-bot\` |
| GitHub repo | `Jordan-sketch-hue/whatsapp-jarvis-bot` — **currently holds AI sales bot code** (force-pushed) |
| Railway | **DOWN** — needs new Railway project in Jordan's account |
| Previous dead URL | `https://whatsapp-jarvis-bot-production-f6ee.up.railway.app` (404) |

## Tech Stack

- **Runtime:** Node.js ESM (node >=22), `npm start` -> `node src/index.mjs`
- **Framework:** Baileys (`@whiskeysockets/baileys` 6.x) + bare `http` server
- **Hosting:** Railway (needs own project in Jordan's account — NOT Juan's)
- **Auth state:** Supabase `ibtadbwtrxglujkzqofs` — wa_auth tables (survives restarts)
- **LLM:** Anthropic `claude-haiku-4-5-20251001` for chat extraction
- **DB write:** Supabase `ibtadbwtrxglujkzqofs` — `whatsapp_threads`, `ops_tickets`

## Key Files

| File | Role |
|------|------|
| `src/index.mjs` | Entry point — Baileys socket, message plumbing, connect/reconnect |
| `src/server.mjs` | HTTP: `/healthz`, `/qr`, `/qr.json`, `/send` (guarded) |
| `src/supabase.mjs` | Auth state + Supabase helpers |
| `src/extract.mjs` | Claude extraction — transcript -> update card |
| `src/autoreply.mjs` | Allowlist-gated auto-reply (clients only, never owners) |
| `src/notify.mjs` | Instant ping to Jordan on new client message |
| `src/alert.mjs` | Send WA alerts to Jordan for system events |
| `src/ticket.mjs` | Auto-create `ops_tickets` from high-priority messages |
| `src/inbound-forward.mjs` | Forward Owen/Jordan messages to Ferguson Law webhook |

## Message Flow

```
WhatsApp -> Baileys socket -> onMessages()
  |-- queue() -- debounce 8s -- flush() -- Claude extract -- upsert whatsapp_threads
  |-- maybeForwardInbound() -- Owen/Jordan JID -- POST fergusonlawja.com/api/whatsapp/inbound
  |-- notifyInstant() -- email/WA ping to Jordan
  +-- maybeAutoReply() -- allowlist auto-ack for clients

Ferguson Law site -> POST /send (x-send-secret header)
  -> sock.sendMessage(jid, text)  [outbound WA from Jordan's device]
```

## HTTP Endpoints

| Path | Method | Auth | Purpose |
|------|--------|------|---------|
| `/healthz` or `/` | GET | none | Liveness check |
| `/qr` | GET | `?token=QR_TOKEN` | Live pairing page |
| `/qr.json` | GET | `?token=QR_TOKEN` | QR data URL (polls every 2.5s) |
| `/send` | POST | `x-send-secret: WA_SEND_SECRET` | Send WA message as Jordan |

## Env Vars Required

| Var | Value / Notes |
|-----|---------------|
| `SUPABASE_URL` | `https://ibtadbwtrxglujkzqofs.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for project `ibtadbwtrxglujkzqofs` |
| `ANTHROPIC_API_KEY` | Claude API key |
| `CLAUDE_MODEL` | `claude-haiku-4-5-20251001` |
| `QR_TOKEN` | Random string — gates `/qr` page |
| `WA_SEND_SECRET` | `jst-wa-send-2026` (must match `whatsapp.json`.secret) |
| `RESEND_API_KEY` | Email alerts via Resend |
| `NOTIFY_EMAIL` | `jordanmorrisr@gmail.com` |
| `INBOUND_FORWARD_URL` | `https://fergusonlawja.com/api/whatsapp/inbound` |
| `INBOUND_FORWARD_SECRET` | Must match Ferguson Law `WHATSAPP_BOT_SECRET` |

## Deploy SOP — New Railway Project

```
1. Create new GitHub repo: Jordan-sketch-hue/jarvis-wa-reader
   (do NOT reuse whatsapp-jarvis-bot — it now has AI sales bot code)

2. Push local code:
   cd "C:\Users\jader\J Supreme Tech\whatsapp-jarvis-bot"
   git remote add jarvis-wa-reader https://github.com/Jordan-sketch-hue/jarvis-wa-reader.git
   git push jarvis-wa-reader master

3. Railway (Jordan's account):
   New Project -> Deploy from GitHub -> jarvis-wa-reader
   Service name: whatsapp-jarvis-reader

4. Set all env vars in Railway service settings

5. Note public URL (e.g. https://whatsapp-jarvis-reader-production.up.railway.app)

6. Update C:\Users\jader\.claude\state\whatsapp.json:
   "endpoint": "https://<new-url>/send"

7. Open https://<new-url>/qr?token=<QR_TOKEN>
   Phone: WhatsApp Business -> Settings -> Linked devices -> Link a device -> scan
```

## Re-link After Restart

- QR codes rotate ~20s. The `/qr` page always shows the current code (live-polling).
- After Railway restart the session persists (stored in Supabase).
- If logged out (code 428): Jordan gets a WA alert. Must re-scan QR.

## Related Files

- `C:\Users\jader\.claude\state\whatsapp.json` — endpoint URL + secret used by JARVIS and other tools
- Ferguson Law `WHATSAPP_BOT_SECRET` env var — must match `INBOUND_FORWARD_SECRET`
- Ferguson Law `WHATSAPP_BOT_URL` env var — must point to `/send` of this bot

## Known Gotchas

- **Repo conflict:** GitHub `whatsapp-jarvis-bot` repo = AI sales bot now. Use a new repo name.
- **WA_SEND_SECRET must match whatsapp.json:** Ferguson Law reads `whatsapp.json` for the URL + secret.
- **Node >=22:** Required for Baileys top-level await. nixpacks detects from `package.json` engines.
- **Railway project must be in Jordan's account** (not Juan's). The Railway MCP Claude uses is authenticated to Juan's account.
- **INBOUND_FORWARD_URL + SECRET must be set** or inbound forwarding silently no-ops.