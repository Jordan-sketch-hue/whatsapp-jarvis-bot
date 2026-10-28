# Kai Call Scripts — Lead Sheet Scenarios

These scripts are wired into the bot's conversation logic. The bot pulls `has_website`, `category`, `business_name`, and `recommended_product` from the `sales_leads` table to decide which path to take.

> **Safety:** the API commands below can trigger real outbound calls or mutate
> live lead records. Do not run them against production without explicit
> authorization. Use a staging deployment and a synthetic test number. The
> phone values below are placeholders; never substitute a real person's number
> without approval.

---

## TRIGGER COMMANDS

**IMPORTANT: `/lead` only inserts into DB — it does NOT call. Always follow with `/call-leads` or `/call`.**

```bash
# Cold call (no lead data) — dials immediately
curl -X POST https://staging-host.example.invalid/call \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"to":"+1XXXXXXXXXX","bypass_hours":true,"bypass_dedup":true}'

# Lead call — Step 1: insert lead, Step 2: dial
# Step 2 (dial):
curl -X POST https://staging-host.example.invalid/call-leads \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"limit":1,"bypass_hours":true,"bypass_dedup":true,"phone_filter":"+1XXXXXXXXXX"}'
```

---

## SCENARIO 1 — NO WEBSITE (has_website: false)

Bot knows they have no website from lead sheet. Pitches website first, upsells app + marketing.

```bash
curl -X POST https://staging-host.example.invalid/lead \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1XXXXXXXXXX","business_name":"Caribbean Eats","category":"restaurant","recommended_product":"Website","has_website":false,"notes":"No online presence. Pitch website J$50K. Upsell: App bundle 20% off, Marketing Starter.","market":"JA"}'
```

| Stage | You say |
|---|---|
| Greeting | "Yeah this is Jordan" |
| Qualify | "Yes I run it" |
| Mockup offer | "Sure, I want to see it" |
| Mockup collect | "658-218-2282" then "Red and yellow" then "Modern" |
| Pitch | "Tell me more about the bundle" |
| Close | "Sounds good, what's next?" |
| Contact | "Email me at jordan@jsupremetech.online" |
| Schedule | "Thursday works" |

**What Kai does:** pitches website J$50K JA / US$650 US, offers free mockup, then bundles app 20% off + AI bot free for 3 months.

---

## SCENARIO 2 — HAS WEBSITE (has_website: true)

Bot skips basic website pitch entirely. Goes straight to App + Marketing + AI Bot upsell.

```bash
curl -X POST https://staging-host.example.invalid/lead \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1XXXXXXXXXX","business_name":"J Supreme Tech","category":"technology","recommended_product":"AI Sales Bot + Elite Marketing","has_website":true,"notes":"FOUNDER TEST. Already has website. Pitch: App, Elite Marketing US$2K/mo, AI Sales Bot expansion.","market":"US"}'
```

| Stage | You say |
|---|---|
| Greeting | "This is Jordan" |
| Qualify | "Yes I run the company" |
| Pitch | "Tell me more about the AI bot" |
| Price objection (test it) | "That's too expensive" |
| (listen to reframe) | "OK fair point" |
| Close | "Sounds good" |
| Contact | "Email me at jordan@jsupremetech.online" |
| Schedule | "Thursday works" |

**What Kai does:** immediately pitches App + Elite Marketing ($2K/mo) + AI Sales Bot (free with marketing). Skips basic website because has_website=true.

---

## SCENARIO 3 — MARKETING + AI BOT PITCH

```bash
curl -X POST https://staging-host.example.invalid/lead \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1XXXXXXXXXX","business_name":"Island Barbershop","category":"barbershop","recommended_product":"Marketing Starter + AI Chatbot","has_website":true,"notes":"Has website, no marketing. Pitch Starter J$30K/mo. AI bot included free.","market":"JA"}'
```

| Stage | You say |
|---|---|
| Greeting | "Hello" |
| Qualify | "Yes I am the owner" |
| Pitch | "I already have a website, I need more customers" |
| (bundle probe) | "Can I get marketing AND an app?" |
| Close | "Sounds good, let's do it" |
| Contact | "658-218-2282" |
| Schedule | "Monday morning" |

**What Kai does:** pivots to Marketing Starter J$30K/mo (US$500), AI bot free. Bundle probe triggers 20% off Website+App, 50% off full stack.

---

## SCENARIO 4 — AI SALES BOT ONLY

```bash
curl -X POST https://staging-host.example.invalid/lead \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1XXXXXXXXXX","business_name":"Kingston Car Wash","category":"automotive","recommended_product":"AI Sales Bot","has_website":true,"notes":"Gets leads but loses them. Pitch AI Sales Bot US$50/mo or FREE with marketing package.","market":"JA"}'
```

| Stage | You say |
|---|---|
| Qualify | "Yes I own it" |
| Pitch | "We get leads but never follow up fast enough" |
| (bot pivots) | Listen — AI bot explanation |
| "How much?" | Listen — US$50/mo or FREE with marketing |
| Close | "OK I want the bot included in the marketing package" |
| Contact | "Email me at jordan@jsupremetech.online" |

---

## SCENARIO 5 — FULL UPSELL LADDER (all stages)

Cold call — tests every stage in order:

```bash
curl -X POST https://staging-host.example.invalid/call \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"to":"+1XXXXXXXXXX","bypass_hours":true,"bypass_dedup":true}'
```

| Stage | You say |
|---|---|
| Greeting | "Hello?" |
| Qualify | "Yes, I run a tech company" |
| Mockup offer | "Sure, I'd be interested" |
| Mockup collect | "658-218-2282" / "Blue and white" / "Professional" |
| Pitch | "What if I wanted marketing too?" |
| Bundle triggers | Listen to bundle offer |
| Close | "Sounds good, what's next?" |
| Contact | "Email me at jordan@jsupremetech.online" |
| Schedule | "Thursday works" |

---

## SCENARIO 6 — OBJECTION TESTS (cold call)

```bash
curl -X POST https://staging-host.example.invalid/call \
  -H "x-admin-key: ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"to":"+1XXXXXXXXXX","bypass_hours":true,"bypass_dedup":true}'
```

| Objection | Say | Expected |
|---|---|---|
| Price | "That's too expensive" | ROI reframe + Kingston salon proof + payment link |
| Timing | "Call me back next month" | "Websites take 30-90 days to rank on Google — waiting = starting from zero" |
| Authority | "I need to discuss with my partner" | Offers one-pager to WA |
| Trust | "Never heard of J Supreme Tech" | "Let me send 3 live sites we built" |
| No need | "We don't need a website" | "Are customers finding you on Google or word of mouth?" |
| Soft no | "Let me think about it" | hesitation_close — "What's the one thing holding you back?" |
| DNC | "Remove me from your list" | Apologizes, ends call, marks DNC in DB |

---

## HOW THE BOT DECIDES WHAT TO PITCH

| Lead data | Bot behaviour |
|---|---|
| `has_website: false` | Website pitch (J$50K JA / US$650) → mockup offer → app upsell |
| `has_website: true` | Skips website → pitches App + Marketing + AI Bot upgrade |
| `recommended_product: "AI Sales Bot"` | Leads with bot pitch, AI bot free with marketing |
| `recommended_product: "Marketing *"` | Leads with marketing tier, bot included free |
| No lead data (cold call) | Asks about website in qualify, then branches accordingly |
