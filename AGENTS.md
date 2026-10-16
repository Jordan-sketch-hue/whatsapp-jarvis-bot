# AGENTS.md â€” ai-sales-bot

> Handoff document for any Claude agent picking this project up cold.

## Purpose
Outbound AI phone sales bot for J Supreme Tech. Calls businesses in Jamaica, runs a 12-stage sales conversation, logs outcomes to Supabase, and notifies Jordan via WhatsApp webhook.

## Live URL
`https://ample-exploration-production-ef51.up.railway.app`

## Tech Stack
- **Runtime:** Node.js + TypeScript (compiled via `tsc`)
- **Framework:** Express.js
- **Hosting:** Railway (`ample-exploration` service, project `whatsapp-jarvis-bot`)
- **Phone:** Twilio TwiML webhooks (outbound calls only)
- **STT:** Twilio built-in (`<Gather input="speech">`) â€” no Deepgram
- **TTS:** Rime AI REST API â€” model `coda`, voice `godfrey`, lang `eng`
- **LLM:** Anthropic `claude-haiku-4-5-20251001` via HTTP (8s timeout)
- **DB:** PostgreSQL via Supabase `ibtadbwtrxglujkzqofs` (call_logs, prospects, call_sessions, sales_leads)

## Key Files
| File | Role |
|------|------|
| `src/index.ts` | Express server â€” all TwiML endpoints + /tts proxy |
| `src/conversation.ts` | 12-stage state machine + LLM calls |
| `src/call.ts` | Twilio outbound call initiation |
| `src/db.ts` | Supabase/pg pool + schema |
| `src/scraper.ts` | Google Maps scraper for leads |
| `src/scraper-yello.ts` | Yellow Pages JA scraper |

## Conversation Stages (in order)
`greeting â†’ qualify â†’ mockup_offer â†’ mockup_collect â†’ pitch â†’ objection_classify â†’ objection_address â†’ hesitation_close â†’ close â†’ schedule â†’ follow_up â†’ end`

## Webhook Flow
```
Twilio calls â†’ /twiml (plays greeting via <Play>, opens <Gather>)
Prospect speaks â†’ /gather (starts LLM async, returns <Redirect>/respond)
               â†’ /respond (awaits LLM promise, returns real TwiML)
Silence â†’ /no-input (3-strike then hangup)
Call ends â†’ /call-status (logs to DB)
```

## Persona
Bot introduces itself as **Kai** from J Supreme Tech. Never "Aria".

## TTS Cache
In-memory, 100-entry LRU, 1hr TTL. Cleared on each deploy (Railway new container).

## Env Vars Required
| Var | Purpose |
|-----|---------|
| `RIME_API_KEY` | Rime AI TTS â€” `YLHwcn527Deo...` |
| `ANTHROPIC_API_KEY` | Claude LLM |
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio webhook validation |
| `TWILIO_FROM_NUMBER` | Outbound caller ID |
| `DATABASE_URL` | Supabase Postgres connection string |
| `PUBLIC_URL` | Bot's Railway public URL (no trailing slash) |
| `ADMIN_KEY` | `jst-sales-bot-2026` â€” gates /call and /call-leads |
| `WHATSAPP_NOTIFY_URL` | Webhook to notify Jordan on call end |

## Deploy SOP
```bash
# 1. Make changes
# 2. Bump version in package.json (busts Railway build cache)
# 3. git add . && git commit -m "..." && git push origin master
# 4. railway up --service d2e0d188-8e0c-4a20-83e6-df16f6fc9ec0 --environment 369713c4-10ca-43ec-8300-b54dcbab6c82 --detach
# 5. curl https://ample-exploration-production-ef51.up.railway.app/health
# 6. Trigger test call: POST /call with x-admin-key header
```

## Trigger Test Call
```bash
curl -X POST "https://ample-exploration-production-ef51.up.railway.app/call" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: jst-sales-bot-2026" \
  -d '{"to":"+16582182282","bypass_hours":true,"bypass_dedup":true}'
```

## Known Gotchas
- **Railway build cache**: identical source = cached build. Always bump `package.json` version before deploy.
- **Rime model**: must be `coda` for `godfrey` voice. `mist`/`mistv2` do NOT support it.
- **TwiML echo loop**: `<Play>` MUST come BEFORE `<Gather>` â€” never nest Play inside Gather.
- **Async lag fix**: `/gather` kicks off `conv.respond()` as a Promise immediately, stores in `pendingResponses` Map, returns `<Redirect>/respond`. `/respond` awaits that promise. This is intentional â€” do not revert to synchronous.
- **follow_up stage**: stays in follow_up for 2 turns (`stageTurnCount >= 2`) before ending â€” gives time to collect WhatsApp number.
- **Trial Twilio account**: only verified numbers can be called. No AMD, no recording unless `TWILIO_PAID=true`.
- **GitHub auto-deploy NOT wired**: must use `railway up` CLI to deploy.

## Changelog


### 2026-10-16 (v1.0.17)
- **Double-greeting loop fix**: Empty Gather no longer replays the full 7s greeting. Now serves a short "Hello? Can you hear me alright?" nudge at greeting stage, or "Sorry, I didn't quite catch that" mid-conversation.
- **Timeout fix**: `timeout="20"` → `timeout="12"` everywhere. Greeting is ~7s so 20 gave 13s of dead silence after audio. Now 5s grace window.
- **Filler voice fix**: Replaced `<Say>` filler (robot TTS) with Rime godfrey `<Play>` filler. All fillers pre-warmed at startup alongside greeting.
### 2026-10-14
- **Voice fix**: Removed `<Say voice="Polly.Joanna">` filler block from `/gather` handler in `src/index.ts`. It was playing simultaneously with Rime godfrey TTS, causing a female voice bleed-through. `/gather` now redirects directly to `/respond` with no filler audio.
- **Supabase dual-write**: Added Supabase REST write to `logCall()` in `src/db.ts`. Bot now writes to both Railway Postgres `call_logs` AND Supabase `ibtadbwtrxglujkzqofs` `sales_calls` table on every call end, so the `/sales/calls` dashboard populates.
- **Phone change**: Migrated from Twilio to Telnyx (`FROM_NUMBER=+17547991892`, TeXML API). Updated `src/call.ts` and `src/index.ts` to use Telnyx TeXML webhooks instead of TwiML.
- **NEVER change Rime godfrey voice**: The TTS is Rime AI `godfrey` (coda model). Never swap it for Polly, Azure, or any other provider.

