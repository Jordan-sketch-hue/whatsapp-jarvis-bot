# AGENTS.md — ai-sales-bot

> Handoff document for any Claude agent picking this project up cold.

## Purpose
Outbound AI phone sales bot for J Supreme Tech. Calls businesses in Jamaica and other markets, runs a 12-stage sales conversation, logs outcomes to Railway Postgres, and notifies Jordan via WhatsApp webhook. Bot persona: **Kai** from J Supreme Tech.

## Live URL
`https://ample-exploration-production-ef51.up.railway.app`

## Tech Stack
- **Runtime:** Node.js + TypeScript (compiled via `tsc`)
- **Framework:** Express.js
- **Hosting:** Railway (`ample-exploration` service `d2e0d188`, project `8e1fe244`)
- **Phone:** Telnyx TeXML webhooks (outbound calls via `FROM_NUMBER=+17547991892`)
- **STT:** Telnyx built-in (`<Gather input="speech">`) — no Deepgram
- **TTS:** Rime AI REST API — model `coda`, voice `godfrey`, lang `eng`
- **LLM:** Anthropic `claude-haiku-4-5-20251001` via HTTP (8s timeout)
- **DB:** Railway Neon PostgreSQL (`DATABASE_URL` env var — Railway Postgres, NOT Supabase)
- **Auth:** `x-admin-key: jst-sales-bot-2026` for all admin endpoints

## Key Files
| File | Role |
|------|------|
| `src/index.ts` | Express server — all TwiML endpoints + /tts proxy + admin APIs |
| `src/conversation.ts` | 12-stage state machine + deterministic guards + LLM calls |
| `src/call.ts` | Telnyx outbound call initiation |
| `src/db.ts` | Railway Postgres pool + schema + logCall + getNewLeads |
| `src/scraper.ts` | Google Maps scraper for Jamaica leads |
| `src/scraper-yello.ts` | Yellow Pages JA scraper |
| `src/scraper-intl.ts` | International market scraper |

## Conversation Stages (in order)
```
greeting → qualify → mockup_offer → mockup_collect → pitch
→ objection_classify → objection_address → hesitation_close
→ close → contact_capture → schedule → follow_up → end
```

## Webhook Flow
```
Telnyx calls → /twiml (plays greeting via <Play>, opens <Gather>)
Prospect speaks → /gather (starts LLM async, returns <Redirect>/respond)
               → /respond (awaits LLM promise, returns real TwiML)
Silence → /no-input (3-strike then hangup)
AMD → /amd-status (machine_start = hang up, human = pass through)
Call ends → /call-status (logs to DB + notifies Jordan via WA)
```

---

## CRITICAL: Two-Layer Architecture

### Layer 1 — Deterministic Guards (BEFORE Claude Haiku is called)
These run in `respond()` with exact if/else logic. **Claude is never involved.**

| Trigger (regex/keyword) | Hardwired Response | Stage Effect |
|---|---|---|
| DNC phrases ("remove me", "don't call", "stop calling") | Apologizes, confirms removal | `stage = "end"`, `dncRequested = true` |
| Wrong number phrases | Apologizes for confusion | `stage = "end"` |
| "Are you AI / robot / real person?" | Confirms AI, pivots to value prop | No stage change |
| "How did you get my number?" | Explains business directories | No stage change |
| "Call me back / not a good time" | Offers specific callback time | `stage = "follow_up"` |
| "Already have a website" | Specific upsell pitch (app + marketing) | `stage = "pitch"` |
| "Send me an email / info" | Asks for email address | `stage = "contact_capture"` |
| Fragment speech (<10 chars) | "Sorry, didn't catch that" | No stage change |
| Interruption ("actually", "wait") | "Of course, go ahead" | No stage change |

### Layer 2 — LLM-Guided with Hardcoded Scripts Injected
Claude Haiku receives exact scripts via system prompt. It delivers the human-readable version but the core content is fixed.

---

## Objection Handling (Fully Coded)

### Objection Detection
`hasObjection()` — regex: `expensive|costly|budget|timing|busy|partner|husband|wife|manager|trust|already have|don't need|not sure|maybe`

### Objection Classification (`classifyObjection()` — deterministic)
| Keyword Match | Classified As |
|---|---|
| expensive, cost, price, afford, budget, cheap | `price` |
| busy, time, later, not now, next month, next year | `timing` |
| wife, husband, partner, manager, boss, board | `authority` |
| trust, sure, proof, guarantee, scam, risk | `trust` |
| don't need, not interested, fine already, good already | `no_need` |
| anything else (fallback) | `no_need` |

### Objection Flow
```
prospect says objection → classifyObjection() sets type
→ stage = "objection_classify"
  Kai: "That makes sense. [QUALIFIER QUESTION for that type]"
→ stage = "objection_address"
  Kai delivers: REFRAME + SOCIAL PROOF + CLOSE MOVE (from OBJECTION_RESPONSES)
→ stage = "close"
```

### OBJECTION_RESPONSES (hardcoded per type)
**price:**
- Reframe: "One new customer from the site typically covers a full year of service."
- Social proof: "A salon owner in Kingston was hesitant — she launched and had 3 new bookings in week 1 from Google."
- Close: "Once you're ready, we'll send a payment link — takes just a few minutes at jsupremetech.online."

**timing:**
- Reframe: "Websites take 30-90 days to rank on Google. Waiting means starting from zero later."
- Social proof: "Most businesses say they wish they'd done it 6 months earlier."
- Close: "Lock your spot now, start when ready — no rush."

**authority:**
- Reframe: "Is it a budget call or a 'let me explain what this does' conversation?"
- Social proof: "I can send a one-page overview — results for similar businesses."
- Close: "What's the best way to get that to you — WhatsApp or email?"

**trust:**
- Reframe: "Let us send three live sites we built for businesses just like yours."
- Social proof: "Barbershops Kingston, salons MoBay, restaurants island-wide — all still live."
- Close: "What's your WhatsApp? I'll drop three examples in 10 minutes."

**no_need:**
- Reframe: "Are customers finding you on Google right now, or mostly word of mouth?"
- Social proof: "Businesses that said 'we don't need it' — 6 months later asking why they waited."
- Close: "Even a basic site with hours, location, and contact number changes how customers find you."

---

## Bundle/Proposal/Upsell Workflows (Coded into System Prompt)

### Bundle Close (fires in `close` stage)
Kai: *"Quick note — we have up to 50% off bundle packages right now. If you're thinking about combining services, doing it together now gets you the best deal."*

**Bundle tiers (hardcoded in JST_CATALOG):**
- Website + App together: **20% OFF both + $10–$20 flat discount at finalization**
- Website or App + any Marketing Package: **AI Sales Bot included FREE FOR LIFETIME** (saves US$50/mo forever — current promo)
- Full stack (Website + App + Marketing + AI Chatbot): **up to 50% total savings**

### Post-Acceptance Upsell (fires after `contact_capture`)
When a prospect accepts a **single service**, Kai is instructed to offer complementary services:
- **Accepted Website only** → Offer: Mobile App (20% bundle OFF) + Marketing Starter (AI bot included free)
- **Accepted App only** → Offer: Website (bundle 20% OFF) + Marketing
- **Accepted Marketing only** → Offer: Website/App (AI bot included free in bundle)
- **Accepted AI Bot standalone** → Offer: Marketing Starter (bot already included, saves $50/mo)

> ⚠️ **TODO (v1.0.23):** This upsell logic is described in the system prompt (JST_CATALOG) but not yet hardcoded as a deterministic `post_acceptance_upsell` stage. Currently the LLM may or may not deliver it. Next sprint: add `contact_capture_upsell` stage that fires after positive contact capture.

### Proposal Flow (after close)
```
positive response → stage = "contact_capture"
  Kai asks: "What's the best way to reach you — WhatsApp or email?"
→ stage = "schedule"
  Kai: "Someone from our team will reach out within 24 hours with next steps."
→ stage = "follow_up" (2 turns max)
  Scenario A (booked): warm wrap-up, end
  Scenario B (undecided): offer callback + summary via WhatsApp
→ stage = "end"
```

### Mockup Offer Flow
After `qualify` (if prospect has a business), Kai offers a **free mockup** of what their site could look like.
```
→ mockup_offer: "Let me put together a free mockup of what YOUR site could look like..."
→ mockup_collect (if yes): collects business name, brand colors, style preference
→ contact_capture → schedule → follow_up
```

### Hesitation Close Flow
If prospect says "maybe/I don't know/not sure" in pitch stage:
```
stage = "hesitation_close"
  Kai: "Is there anything specific holding you back?"
  Listens → picks ONE response path:
  - PRICE → anchor ROI, offer Marketing Starter as lower entry (JA J$30K/mo | US $500/mo)
  - TIMING → lock calendar spot, start when ready
  - AUTHORITY → send one-pager via WhatsApp
  - TRUST → send portfolio samples via WhatsApp
  - UNDECIDED → "Would it be okay if I reached back out in a few days?"
  NEVER hard close here. Offer callback or one-pager as the exit.
```

---

## Full Price List (as at 2026-10)

### Websites & Apps (one-time, you own it outright)
| Service | Jamaica/Caribbean | US/Canada | UK |
|---|---|---|---|
| Website | J$50,000+ | US$650–1,500 | GBP550–1,200 |
| Mobile App | J$80,000+ | US$1,250–2,500 | GBP1,000–2,000 |
| Website + App bundle | J$50K+J$80K –20% | –20% | –20% |

### SaaS (monthly, includes branded website + backend)
| Product | Market | Price |
|---|---|---|
| GlowDesk | All | US$35/mo |
| PunchPro | All | US$29/mo |
| FleetRun | All | US$49/mo |
| TourBase | All | US$49/mo |
| EnrollIQ | All | US$59/mo |
| TableFlow | All | US$69/mo |
| DwellDesk | All | US$89/mo |

### AI Add-ons
- AI Chatbot: US$50/mo (website-only add-on)
- AI Sales Agent: US$50/mo standalone | **FREE FOR LIFETIME with any Marketing Package** (current promotion)

### Marketing Packages (monthly)
| Tier | Jamaica/Caribbean | US/Canada | UK |
|---|---|---|---|
| Starter | J$30,000/mo | US$500/mo | GBP400/mo |
| Plus | J$55,000/mo | US$1,000/mo | GBP800/mo |
| Elite | J$80,000/mo | US$2,000/mo | GBP1,600/mo |

> **AI Sales Bot is ALWAYS included in every marketing package — FREE FOR LIFETIME** (current promotion — no extra charge, no expiry).

### Active Specials (current — 2026-10)
1. **FREE AI Sales Agent FOR LIFETIME** with any Marketing Package (Starter, Plus, or Elite) — US$50/mo value, no expiry
2. **Website + App bundle: $10–$20 flat discount** applied at finalization (on top of the 20% bundle rate)
3. **Bundle 50% off**: Full-stack (Website + App + Marketing + AI Chatbot) — maximum savings
4. **Bundle 20% off**: Website + App together (plus $10–$20 finalization discount)

---

## Stage Transition Map (Deterministic Logic)

```
greeting    →  [wrong number/not interested] → end
            →  [has company + industry data] → mockup_offer
            →  [default]                      → qualify

qualify     →  [>= 2 turns + mockup yes]     → mockup_collect
            →  [>= 4 turns]                  → mockup_offer
            →  [default]                     → qualify

mockup_offer → [yes]                         → mockup_collect
            →  [default]                     → pitch

pitch       → [has objection keyword]        → objection_classify
            → [positive response]            → close
            → [hesitation keyword]           → hesitation_close
            → [default]                      → pitch

objection_classify → [always]               → objection_address
objection_address  → [always]               → close

hesitation_close → [positive]               → close
                 → [< 2 turns]              → hesitation_close
                 → [>= 2 turns]             → objection_classify

close       → [positive]                    → contact_capture
            → [no mockup yet]               → mockup_offer
            → [hesitation/objection]        → hesitation_close
            → [default]                     → follow_up

schedule    → [always]                       → follow_up
follow_up   → [>= 2 turns]                  → end
```

**Global limits:**
- Any stage: `turnCount > 24` → force `end`
- STAGE_MAX_TURNS: greeting=3, qualify=6, mockup_collect=6, contact_capture=4, pitch=5, objection_classify=2, objection_address=3, hesitation_close=3, close=4

---

## Admin API Endpoints
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/call` | x-admin-key | Trigger a cold call to any number |
| POST | `/call-leads` | x-admin-key | Call N leads from sales_leads table |
| POST | `/lead` | x-admin-key | Insert/upsert a lead into sales_leads |
| GET | `/leads` | x-admin-key | List all sales_leads with stats |
| GET | `/call-logs` | x-admin-key | Full call history with costs |
| GET | `/health` | none | Liveness check |

## Key Env Vars
| Var | Purpose |
|---|---|
| `RIME_API_KEY` | Rime AI TTS |
| `ANTHROPIC_API_KEY` | Claude LLM |
| `TELNYX_API_KEY` | Telnyx — call initiation + AMD hang-up |
| `TELNYX_ORG_ID` | Telnyx org/account ID |
| `FROM_NUMBER` | Outbound caller ID (`+17547991892`) |
| `DATABASE_URL` | Railway Postgres connection string |
| `PUBLIC_URL` | Bot's Railway public URL (no trailing slash) |
| `ADMIN_KEY` | `jst-sales-bot-2026` — gates all admin routes |
| `WHATSAPP_NOTIFY_URL` | Webhook to notify Jordan on call end |
| `SIGNALWIRE_API_TOKEN` | Webhook signature validation token |

## Jordan Test Lead (pre-loaded in DB)

Phone `+16582182282` has ONE slot in `sales_leads` (upsert by phone).  
**Current entry:** J Supreme Tech · has_website=true · AI Sales Bot + Elite Marketing  
Run `/call-leads` with `phone_filter` to call yourself using whichever scenario is loaded.

### Trigger call (uses current lead data)
```bash
curl -X POST https://ample-exploration-production-ef51.up.railway.app/call-leads   -H "x-admin-key: jst-sales-bot-2026"   -H "Content-Type: application/json"   -d '{"limit":1,"bypass_hours":true,"phone_filter":"+16582182282"}'
```

### Swap scenarios (overwrite the lead, then trigger)

**SCENARIO A — No Website (restaurant, JA market)**
```bash
curl -X POST https://ample-exploration-production-ef51.up.railway.app/lead   -H "x-admin-key: jst-sales-bot-2026" -H "Content-Type: application/json"   -d '{"phone":"+16582182282","business_name":"Caribbean Eats","category":"restaurant","recommended_product":"Website","has_website":false,"notes":"No online presence. Pitch website J$50K. Upsell: App 20% off + $10-20 finalization discount. Marketing Starter AI bot FREE lifetime.","market":"JA"}'
```
Bot does: website pitch J$50K → mockup offer → app bundle + AI bot lifetime free

**SCENARIO B — Has Website (founder/JST, US market) — DEFAULT**
```bash
curl -X POST https://ample-exploration-production-ef51.up.railway.app/lead   -H "x-admin-key: jst-sales-bot-2026" -H "Content-Type: application/json"   -d '{"phone":"+16582182282","business_name":"J Supreme Tech","category":"technology","recommended_product":"AI Sales Bot + Elite Marketing","has_website":true,"notes":"FOUNDER TEST. Already has website. Pitch: App US$1,250, Elite Marketing US$2K/mo, AI Sales Bot FREE LIFETIME with marketing.","market":"US"}'
```
Bot does: skips basic website → pitches App + Elite Marketing + AI bot free lifetime

**SCENARIO C — Marketing + AI Bot (barbershop, JA)**
```bash
curl -X POST https://ample-exploration-production-ef51.up.railway.app/lead   -H "x-admin-key: jst-sales-bot-2026" -H "Content-Type: application/json"   -d '{"phone":"+16582182282","business_name":"Island Barbershop","category":"barbershop","recommended_product":"Marketing Starter + AI Chatbot","has_website":true,"notes":"Has website, no marketing. Pitch Starter J$30K/mo. AI Sales Bot FREE LIFETIME with marketing.","market":"JA"}'
```
Bot does: Marketing Starter J$30K/mo → AI bot included free lifetime

**SCENARIO D — AI Bot Only (car wash, JA)**
```bash
curl -X POST https://ample-exploration-production-ef51.up.railway.app/lead   -H "x-admin-key: jst-sales-bot-2026" -H "Content-Type: application/json"   -d '{"phone":"+16582182282","business_name":"Kingston Car Wash","category":"automotive","recommended_product":"AI Sales Bot","has_website":true,"notes":"Gets leads but loses them. Pitch AI Sales Bot — FREE with any marketing package.","market":"JA"}'
```
Bot does: leads with AI bot pitch → FREE with marketing package

### Fields the bot reads per lead (auto-routes script)
| Field | How bot uses it |
|---|---|
| `has_website` | false → website pitch; true → skip to app/marketing/AI layer |
| `recommended_product` | "Marketing *" → leads with marketing; "AI Sales Bot" → bot pitch first |
| `category` | Personalises the pitch ("for barbershops like yours…") |
| `market` | JA = J$ pricing; US = US$ pricing; UK = GBP pricing |
| `business_name` | Used in greeting and throughout call |
| `notes` | Injected into Kai's system prompt as context |

## Deploy SOP
```bash
# 1. Make changes
# 2. Bump version in package.json (busts Railway build cache)
# 3. git add . && git commit -m "..." && git push origin master
# 4. railway up --service d2e0d188-8e0c-4a20-83e6-df16f6fc9ec0 \
#              --environment 369713c4-10ca-43ec-8300-b54dcbab6c82 --detach
# 5. curl https://ample-exploration-production-ef51.up.railway.app/health
# 6. Test call: POST /call with x-admin-key
```

## Trigger Test Calls
```bash
# Cold call (no lead data — Kai doesn't know the company)
curl -X POST "https://ample-exploration-production-ef51.up.railway.app/call" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: jst-sales-bot-2026" \
  -d '{"to":"+16582182282","bypass_hours":true,"bypass_dedup":true}'

# Lead call (pulls Jordan's entry from sales_leads — Kai knows company/industry)
curl -X POST "https://ample-exploration-production-ef51.up.railway.app/call-leads" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: jst-sales-bot-2026" \
  -d '{"limit":1,"bypass_hours":true}'

# Add Jordan as a test lead
curl -X POST "https://ample-exploration-production-ef51.up.railway.app/lead" \
  -H "Content-Type: application/json" \
  -H "x-admin-key: jst-sales-bot-2026" \
  -d '{
    "phone":"+16582182282",
    "business_name":"J Supreme Tech",
    "category":"technology",
    "recommended_product":"AI Sales Bot + Website Revamp",
    "has_website":true,
    "notes":"FOUNDER TEST — Jordan Morris, CEO. TIER:2. Already has website; pitch App + Elite Marketing + AI Bot expansion.",
    "market":null
  }'
```

## Known Gotchas
- **Railway build cache**: identical source = cached build. Always bump `package.json` version before deploy.
- **Rime model**: must be `coda` for `godfrey` voice. `mist`/`mistv2` do NOT support it.
- **TwiML echo loop**: `<Play>` MUST come BEFORE `<Gather>` — never nest Play inside Gather.
- **Async lag fix**: `/gather` kicks off `conv.respond()` as a Promise immediately, stores in `pendingResponses` Map, returns `<Redirect>/respond`. `/respond` awaits that promise. Do not revert to synchronous.
- **follow_up stage**: stays in follow_up for 2 turns (`stageTurnCount >= 2`) before ending.
- **GitHub auto-deploy NOT wired**: must use `railway up` CLI to deploy.
- **NEVER change voice**: TTS is Rime AI `godfrey` (coda model). Never swap for Polly, Azure, or any other.
- **DB is Railway Postgres**: call_logs are stored in Railway Neon DB, NOT Supabase. The `/sales/calls` conglomerate page calls `/call-logs` API.

## Changelog

### 2026-10-16 (v1.0.25)
- **Pricing updates**: Website + App bundles now carry an additional $10–$20 flat discount at finalization (on top of 20% bundle rate).
- **Active promo**: AI Sales Agent is FREE FOR LIFETIME with any Marketing Package (was 3-month promo — now permanent/lifetime for current signups).
- **Case-sensitivity fix**: All guard regex methods (isPositive, isMockupYes, isHesitation, hasObjection, classifyObjection) now use /i flag — fixes failures on capitalized STT input.

### 2026-10-16 (v1.0.22)
- **POST /lead endpoint**: Insert/upsert leads into sales_leads table directly. `place_id` auto-generated as `manual_{phone_digits}`.
- **API cost tracking**: `call_logs` now stores `rime_chars`, `anthropic_input_tokens`, `anthropic_output_tokens`, `cost_usd` per call.
- **Comprehensive AGENTS.md**: Full scenario map, objection flows, bundle/proposal/upsell workflows, price list, specials.

### 2026-10-16 (v1.0.21)
- **Greeting stage**: No longer asks "what type of business" when we have prospect data.
- **AI disclosure**: NOT volunteered unprompted.
- **AMD machine_start**: Hangs up immediately via Telnyx API.
- **call-leads delay**: 500ms → 30s between initiations.
- **call-leads default limit**: 10 → 3 per batch.
- **Empty-gather guard**: Silent extension if TTS played < 10s ago.

### 2026-10-16 (v1.0.17)
- Double-greeting loop fix, timeout 20→12, filler voice fix.

### 2026-10-14
- Voice fix (removed Say Polly bleed), phone migration Twilio → Telnyx.
