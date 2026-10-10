# JST AI Sales Bot — Leads Strategy & Target Database
> Last updated: Oct 10 2026 | Maintained by: Jordan Morris / J Supreme Tech
> **Supabase table:** `sales_leads` on `ibtadbwtrxglujkzqofs`
> **Seed script:** `leads/seed-leads.ts` (run once to populate)
> **Scraper config:** `leads/scraper-targets.json` (feed to `src/scraper.ts`)

---

## HOW TO ACCESS THE FULL LEADS LIST

```bash
# View all new leads
SELECT business_name, phone, category, recommended_product, status
FROM sales_leads WHERE status = 'new' ORDER BY created_at ASC;

# View by tier (stored in notes field as "TIER:1" etc.)
SELECT * FROM sales_leads WHERE notes LIKE '%TIER:1%' AND status = 'new';

# Run the scraper to fill real phone numbers per category
node dist/scraper.js --query "nail salon" --location "Kingston Jamaica" --limit 50
```

---

## PRIORITY FRAMEWORK

| Tier | Signal | Conversion | Service Match |
|------|--------|------------|---------------|
| T1 | No website, phone-only bookings | Highest | Website + Booking |
| T2 | Outdated/bad website, no CRM | High | Redesign + CRM |
| T3 | Good digital presence, no AI/automation | Medium | AI Caller + Suite |
| T4 | Enterprise/SaaS opportunity | Strategic | Supreme Suite |

**Bot calling priority:** T1 first (easiest pitch — they NEED a website and know it), then T3 (AI caller pitch lands well on outbound sales teams).

---

## TIER 1 — NO WEBSITE, PHONE-ONLY (HIGHEST PRIORITY)

These businesses run entirely off WhatsApp/phone. Zero web presence. Ready to spend J$15K–J$40K for a site that pays for itself in bookings.

### Beauty & Personal Care
| Category | Pitch Angle | Avg Spend | Scraper Query |
|----------|-------------|-----------|---------------|
| Nail salons | "Clients book at 2AM when they think of it" | J$25K | `nail salon [city] Jamaica` |
| Hair salons | "Gallery + online booking kills the no-shows" | J$25K | `hair salon [city] Jamaica` |
| Barber shops | "Book online, collect deposits, cut no-shows" | J$20K | `barbershop [city] Jamaica` |
| Eyelash/brow studios | "Instagram leads waste if no booking page" | J$20K | `lash studio Jamaica` |
| Spa & massage | "24/7 booking = more revenue while you sleep" | J$30K | `spa massage Jamaica` |
| Tattoo studios | "Portfolio + booking = stop losing walk-aways" | J$25K | `tattoo [city] Jamaica` |
| Makeup artists | "Bride season bookings captured automatically" | J$20K | `makeup artist Jamaica` |

### Food & Beverage
| Category | Pitch Angle | Avg Spend | Scraper Query |
|----------|-------------|-----------|---------------|
| Local restaurants | "Menu + order link in bio drives pickup orders" | J$30K | `restaurant [city] Jamaica` |
| Takeout/cookshops | "WhatsApp orders → website orders, less phone tag" | J$20K | `takeout food Jamaica` |
| Bakeries | "Pre-order system = know what to bake daily" | J$20K | `bakery [city] Jamaica` |
| Catering companies | "Quote form + portfolio = serious inquiries only" | J$35K | `catering Jamaica` |
| Food trucks | "Location tracker + menu = $0 marketing spend" | J$15K | `food truck Jamaica` |
| Jerk/BBQ spots | "Tourist season traffic needs a website to capture" | J$20K | `jerk chicken [city] Jamaica` |

### Auto & Trades
| Category | Pitch Angle | Avg Spend | Scraper Query |
|----------|-------------|-----------|---------------|
| Car mechanics/garages | "Booking system = no more full voicemail" | J$25K | `auto repair garage Jamaica` |
| Car detailing | "Online booking + gallery converts social followers" | J$20K | `car detailing Jamaica` |
| Tires/rims shops | "Price list + appointment = fewer time-wasters" | J$20K | `tires rims Jamaica` |
| Panel beaters | "Insurance referral = they need a proper site" | J$25K | `panel beater Jamaica` |
| Plumbers | "Emergency call form + reviews = Google ranking" | J$20K | `plumber [city] Jamaica` |
| Electricians | "Licensed badge + contact form = trust signals" | J$20K | `electrician Jamaica` |
| A/C technicians | "Service contract upsell requires a site" | J$25K | `AC technician Jamaica` |
| General contractors | "Project portfolio = bigger jobs, less lowballers" | J$35K | `contractor construction Jamaica` |

### Retail
| Category | Pitch Angle | Avg Spend | Scraper Query |
|----------|-------------|-----------|---------------|
| Clothing boutiques | "Instagram store → real e-commerce = 3x orders" | J$35K | `clothing boutique Jamaica` |
| Beauty supply stores | "Product catalog + WhatsApp order = more volume" | J$25K | `beauty supply Jamaica` |
| Phone repair shops | "Price list + wait time estimate = less calls" | J$20K | `phone repair Jamaica` |
| Hardware stores | "Product lookup + delivery booking = B2B clients" | J$30K | `hardware store Jamaica` |
| Furniture shops | "Gallery + quote form = serious buyers only" | J$35K | `furniture store Jamaica` |
| Pharmacies | "Prescription refill form + delivery option" | J$30K | `pharmacy Jamaica` |

---

## TIER 2 — BAD WEBSITE, NO CRM (HIGH PRIORITY)

Already online but their site is a Wix template from 2018. No booking. No CRM. Can't compete. Pitch: "Upgrade + automate."

### Professional Services
| Category | Pitch Angle | Avg Spend | Notes |
|----------|-------------|-----------|-------|
| Dentists / clinics | "Patient portal + appointment system" | J$50K–J$80K | Ask about patient count |
| Doctors / GPs | "Online triage + booking = less phone calls" | J$50K | Health sector premium |
| Lawyers / attorneys | "Case intake form + client portal" | J$60K | Ferguson Law = proof |
| Accountants | "Tax season client upload portal" | J$40K | Seasonal pitch (Jan–Apr) |
| Real estate agents | "Property listings + mortgage calc + lead capture" | J$50K | HIGH CONVERSION |
| Insurance agents | "Quote form + AI follow-up caller" | J$45K | T1 for AI bot pitch |
| Financial advisors | "Client portal + portfolio tracker" | J$60K | Affluent clients |
| Architects | "Project portfolio + consultation booking" | J$40K | |
| Engineers | "Service scope + quote request" | J$35K | |
| Chartered surveyors | "Property report ordering system" | J$40K | |

### Education
| Category | Pitch Angle | Avg Spend | Notes |
|----------|-------------|-----------|-------|
| Tutoring centers | "Student enrollment + lesson scheduling" | J$35K | |
| Private schools | "Parent portal + fee payment + comms" | J$60K+ | |
| Music schools | "Lesson booking + student tracking" | J$30K | |
| Dance studios | "Class schedule + registration + showcase" | J$30K | |
| Driving schools | "Slot booking + theory test practice" | J$25K | |
| Language schools | "Course catalog + enrollment + certificates" | J$40K | LC = proof |

### Health & Wellness
| Category | Pitch Angle | Avg Spend | Notes |
|----------|-------------|-----------|-------|
| Gyms / fitness studios | "Member management + class booking" | J$40K | |
| Personal trainers | "Program packages + booking + progress tracking" | J$25K | |
| Nutritionists | "Meal plan portal + consult booking" | J$30K | |
| Chiropractors | "Appointment booking + patient intake" | J$40K | |
| Physiotherapists | "Referral form + exercise library" | J$40K | |
| Opticians | "Eye test booking + frame gallery" | J$35K | |

### Tourism & Hospitality (JA Gold)
| Category | Pitch Angle | Avg Spend | Notes |
|----------|-------------|-----------|-------|
| Tour operators | "OTA alternative + direct booking = no commission" | J$50K | Aboo = proof |
| Transfer companies | "Airport pickup booking + WhatsApp confirm" | J$40K | |
| Guest houses | "Direct booking = 0% OTA fees" | J$50K | |
| AirBnB hosts (multi) | "Direct booking site = escape Airbnb fees" | J$35K | |
| Activity companies | "Combo packages + waiver forms + booking" | J$45K | |
| Fishing charters | "Trip booking + weather + gallery" | J$40K | |

---

## TIER 3 — AI SALES BOT READY (MEDIUM PRIORITY, HIGH VALUE)

These businesses do outbound sales or have phone-heavy sales processes. Perfect pitch for the AI calling bot.

### Prime AI Bot Targets
| Category | Bot Use Case | Avg Deal | Pitch |
|----------|--------------|----------|-------|
| Insurance companies | Lead qualification + quote follow-up | US$200+/mo | "Bot handles 200 follow-ups/day while agents close" |
| Real estate firms | New listing alerts to hot leads | US$300+/mo | "AI calls every lead within 5 min of inquiry" |
| Car dealerships | Test drive follow-up + financing pre-qual | US$400+/mo | "Never miss a hot lead again" |
| Solar companies | Residential outreach + appointment set | US$500+/mo | "AI books appointments, humans close" |
| Telecom resellers | Upgrade/renewal outreach | US$300+/mo | "Bot reaches 500 customers/day for plan upgrades" |
| Financial services | Investment product outreach | US$400+/mo | "Compliant AI outreach at scale" |
| Staffing agencies | Candidate warm-up calls | US$200+/mo | "AI pre-screens before human interview" |
| B2B SaaS companies | Trial-to-paid conversion calls | US$400+/mo | "AI follows up on every free trial signup" |
| Event companies | Venue sales + sponsor outreach | US$200+/mo | |
| Logistics companies | Fleet/route sales outreach | US$300+/mo | SolidTrust = proof |

---

## TIER 4 — SUPREME SUITE / SAAS RESELLER (STRATEGIC)

High-value, longer sales cycle. Target: small agencies, IT consultants, operators who want to white-label.

| Segment | Use Case | Deal Size | Approach |
|---------|----------|-----------|----------|
| Small digital agencies (JA) | White-label entire JST stack | US$55/mo recurring | Direct pitch meeting |
| IT consultants | Suite for their client base | US$55/mo × N clients | Partner program |
| Accounting firms with multiple clients | CRM + invoice + portal for each | US$55/mo × N | Accountant partnerships |
| Property management companies | Tenant portal + maintenance + invoicing | US$100+/mo | |
| Franchise operators | Multi-location dashboard | US$200+/mo | |
| Churches (chain/network) | Member management + giving | US$55/mo | |
| Healthcare groups | Multi-clinic patient management | US$100+/mo | |

---

## INTERNATIONAL TARGETS

### Caribbean (High Priority)
| Market | Category | Channel | Notes |
|--------|----------|---------|-------|
| Trinidad & Tobago | Same T1 profile as JA | Cold email + DM | Large SMB market |
| Barbados | Tourism + hospitality | Cold email | High spend per deal |
| Guyana | Oil sector services | Cold email | Booming economy |
| Cayman Islands | Financial + hospitality | Cold email | Premium pricing |
| Belize | Tourism + real estate | Cold email | |
| Antigua / St Lucia | Tour operators | Cold email | Small islands, big spend |

### Diaspora (USA — Caribbean-owned businesses)
| State | Business Type | Channel | Notes |
|-------|---------------|---------|-------|
| Florida (Miami, Orlando, Broward) | JA restaurants, beauty, retail | DM + email | Huge JA diaspora |
| New York (Bronx, Brooklyn) | Caribbean restaurants + retail | DM + email | |
| Georgia (Atlanta) | Caribbean beauty + food | DM + email | Growing market |
| Connecticut / New Jersey | Professional services | Email | Established diaspora |

### International SaaS Opportunity
| Region | Segment | Channel | Notes |
|--------|---------|---------|-------|
| UK | Caribbean diaspora businesses | Cold email | |
| Canada (Toronto, Hamilton) | Caribbean SMBs | Cold email | Large JA community |

---

## OUTREACH CHANNEL MATRIX

| Lead Type | Primary Channel | Secondary | Timing |
|-----------|-----------------|-----------|--------|
| No-website local JA | AI Sales Bot (calls) | WhatsApp DM | Mon–Fri 10AM–4PM |
| Professional services | Cold email | Follow-up bot call | Tue/Wed/Thu 9AM–11AM |
| Instagram-only businesses | Instagram DM | Bot call if phone found | Evenings 7PM–9PM |
| B2B / SaaS prospects | Cold email sequence | LinkedIn | Tue/Wed 9AM |
| International | Cold email | LinkedIn DM | Adjusted for timezone |

---

## SCRAPER TARGET CONFIG
See `leads/scraper-targets.json` — feed each entry to `src/scraper.ts` to auto-pull leads from Google Places.

The scraper returns businesses with **no website** first (has_website: false) — these are T1 targets.

---

## SALES BOT SCRIPT MATRIX

| Category | Opening Line | Key Pain Point | Close |
|----------|-------------|----------------|-------|
| Nail/hair salon | "Hi, I'm calling from J Supreme Tech — we build websites for salons in Jamaica..." | "Are clients still calling to book or do you have online booking?" | "We can have your site live this week for J$25,000" |
| Restaurant | "We build online menus and ordering pages for restaurants..." | "Are you getting orders through WhatsApp or phone still?" | "We can set up online ordering this week" |
| Car mechanic | "We help garages in Jamaica get found on Google..." | "Do you have a website customers can book on?" | "Most garages see 30% more bookings once they're online" |
| Insurance agent | "We help insurance agents automate their follow-up calls..." | "How many leads go cold because you couldn't follow up fast enough?" | "Our AI calls every lead within 5 minutes automatically" |
| Real estate | "We help real estate agents in Jamaica generate leads online..." | "Is your website capturing leads or just showing listings?" | "We can turn your listings into a 24/7 lead machine" |

---

## FILE LOCATIONS

| File | Purpose |
|------|---------|
| `LEADS-STRATEGY.md` | This file — full strategy reference |
| `leads/scraper-targets.json` | Scraper job definitions per category |
| `leads/seed-leads.sql` | SQL to seed initial Supabase records |
| `src/scraper.ts` | Google Places scraper (needs API key) |
| Supabase `sales_leads` | Live leads database — query here before launching calls |

---

## LAUNCH CHECKLIST

- [x] Bot deployed to Railway
- [x] Supabase schema live
- [x] Test calls working
- [ ] Google Places API key → set `GOOGLE_PLACES_KEY` env var
- [ ] Run scraper for top 5 T1 categories (target: 200 leads)
- [ ] Review leads, mark DNC if needed
- [ ] Set `TWILIO_PAID=true` and upgrade Twilio for bulk calling
- [ ] Launch: 50 calls/day cap, Mon–Fri 10AM–4PM JA time
