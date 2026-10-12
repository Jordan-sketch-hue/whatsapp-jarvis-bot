# AGENTS.md — ai-sales-bot

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
- **STT:** Twilio built-in (`<Gather input="speech">`) — no Deepgram
- **TTS:** Rime AI REST API — model `coda`, voice `godfrey`, lang `eng`
- **LLM:** Anthropic `claude-haiku-4-5-20251001` via HTTP (8s timeout)
- **DB:** PostgreSQL via Supabase `ibtadbwtrxglujkzqofs` (call_logs, prospects, call_sessions, sales_leads)

## Key Files
| File | Role |
|------|------|
| `src/index.ts` | Express server — all TwiML endpoints + /tts proxy |
| `src/conversation.ts` | 12-stage state machine + LLM calls |
| `src/call.ts` | Twilio outbound call initiation |
| `src/db.ts` | Supabase/pg pool + schema |
| `src/scraper.ts` | Google Maps scraper for leads |
| `src/scraper-yello.ts` | Yellow Pages JA scraper |

## Conversation Stages (in order)
`greeting → qualify → mockup_offer → mockup_collect → pitch → objection_classify → objection_address → hesitation_close → close → schedule → follow_up → end`

## Webhook Flow
```
Twilio calls → /twiml (plays greeting via <Play>, opens <Gather>)
Prospect speaks → /gather (starts LLM async, returns <Redirect>/respond)
               → /respond (awaits LLM promise, returns real TwiML)
Silence → /no-input (3-strike then hangup)
Call ends → /call-status (logs to DB)
```

## Persona
Bot introduces itself as **Alex** from J Supreme Tech. Never "Aria".

## TTS Cache
In-memory, 100-entry LRU, 1hr TTL. Cleared on each deploy (Railway new container).

## Env Vars Required
| Var | Purpose |
|-----|---------|
| `RIME_API_KEY` | Rime AI TTS — `YLHwcn527Deo...` |
| `ANTHROPIC_API_KEY` | Claude LLM |
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio webhook validation |
| `TWILIO_FROM_NUMBER` | Outbound caller ID |
| `DATABASE_URL` | Supabase Postgres connection string |
| `PUBLIC_URL` | Bot's Railway public URL (no trailing slash) |
| `ADMIN_KEY` | `jst-sales-bot-2026` — gates /call and /call-leads |
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
- **TwiML echo loop**: `<Play>` MUST come BEFORE `<Gather>` — never nest Play inside Gather.
- **Async lag fix**: `/gather` kicks off `conv.respond()` as a Promise immediately, stores in `pendingResponses` Map, returns `<Redirect>/respond`. `/respond` awaits that promise. This is intentional — do not revert to synchronous.
- **follow_up stage**: stays in follow_up for 2 turns (`stageTurnCount >= 2`) before ending — gives time to collect WhatsApp number.
- **Trial Twilio account**: only verified numbers can be called. No AMD, no recording unless `TWILIO_PAID=true`.
- **GitHub auto-deploy NOT wired**: must use `railway up` CLI to deploy.
