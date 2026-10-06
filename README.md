# WhatsApp → Jarvis reader

Links Jordan's **WhatsApp Business** number as a read-only *linked device*, runs every
client message through Claude, and pushes a per-client **update card** into the
conglomerate operator workspace at **`/jarvis/whatsapp`** (jsupremeconglomerate.online).

It is the real engine behind "give me the WhatsApp API key to read all my chats" —
there is no such key, so this links the number the same way WhatsApp Web does and reads
from there.

## What it does / doesn't do

- ✅ Reads all 1:1 client chats (groups skippable), coalesces bursts, summarizes with Claude.
- ✅ Writes cards to Supabase (`jarvis_wa_threads` / `jarvis_wa_updates`).
- ✅ Survives redeploys — the linked-device session is stored in Supabase (`jarvis_wa_auth`), so you scan the QR **once**.
- ❌ **Never sends, reacts, or deletes.** There is no send path in the code. It only observes.

> Heads-up: this uses the unofficial Baileys client (a "linked device"). It's against
> WhatsApp's ToS for automation and carries a small ban risk on the number. Read-only +
> low-volume is the low-risk end of that; sending bulk messages is what gets numbers banned —
> which this deliberately can't do.

## One-time setup

### 1. Apply the database migration
In the conglomerate repo, the migration `supabase/migrations/20260620120000_jarvis_whatsapp.sql`
creates the `jarvis_wa_*` tables. Apply it to project `ibtadbwtrxglujkzqofs` (Supabase SQL editor or CLI).

### 2. Deploy this folder to Railway
New Railway service (same account as the Slack hub). Set these variables (see `.env.example`):

| var | value |
|---|---|
| `SUPABASE_URL` | `https://ibtadbwtrxglujkzqofs.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | the service-role key for that project |
| `ANTHROPIC_API_KEY` | your Claude key |
| `CLAUDE_MODEL` | `claude-haiku-4-5-20251001` (default; fine to leave unset) |
| `QR_TOKEN` | any random string — protects the pairing page |

Railway auto-detects Node and runs `npm start`. Generate a public domain for the service.

### 3. Link your number (once)
Open `https://<your-railway-url>/qr?token=<QR_TOKEN>` on any device, then on your phone:
**WhatsApp Business → Settings → Linked devices → Link a device**, and scan.
The page shows ✅ Linked when it's done; `/jarvis/whatsapp` starts filling within a minute.

`GET /healthz` returns `{ linked, lastEventAt }` for monitoring.

## Controls (from the hub or Supabase)
`jarvis_wa_settings` (singleton row `default`):
- `paused` — stop creating cards without unlinking
- `capture_mode` — `all_business` (current) · `action_money_shipping` · `urgent_only`
- `skip_groups` — ignore WhatsApp groups (default true)

Changes are picked up within ~60s, no redeploy.

## Local dev
```
cp .env.example .env   # fill in the keys
npm install
npm start
# open http://localhost:8080/qr?token=...  to link
```
