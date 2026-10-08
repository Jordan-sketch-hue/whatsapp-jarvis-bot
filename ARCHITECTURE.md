# AI Sales Calling Bot — Architecture

## Mission
Outbound AI voice agent that calls local and international businesses — primarily those WITHOUT a website — and converts them to J Supreme Tech Supreme Suite free trials.

## First Principles
1. **Foundation**: Phone call = audio stream in/out. All complexity sits on top of that pipe.
2. **Components**: STT → LLM → TTS are three independent, swappable modules.
3. **Patterns**: Every call is a state machine. Every state transition is logged to Supabase.
4. **Documentation**: This file exists so any agent or developer can understand the system without reading source code.
5. **Consistency**: All env vars follow SCREAMING_SNAKE_CASE. All DB columns follow snake_case.

## System Map
```
LEAD DATABASE (Supabase: sales_leads)
        ↓
LEAD SCRAPER (src/scraper.ts)
  - Google Places API → businesses with no website
  - Filters: has phone, no website URL, category matches product catalog
        ↓
OUTBOUND CALL TRIGGER (POST /call)
  - Twilio REST API initiates call
  - AMD (Answering Machine Detection) enabled
        ↓
TWILIO MEDIA STREAMS (WebSocket /stream)
  - Audio in: mulaw 8kHz (Twilio → server)
  - Audio out: mulaw 8kHz (server → Twilio)
        ↓
STT: Deepgram Nova-2
  - encoding: mulaw, sample_rate: 8000
  - interim_results for barge-in detection
        ↓
LLM: Groq Llama 3.3 70B (src/conversation.ts)
  - State machine: greeting → qualify → pitch → objection → close → end
  - Knows all 13 JST Supreme Suite products
  - Picks best-fit product based on caller's business type
        ↓
TTS: Azure Marcus voice (src/tts.ts)
  - Raw8Khz8BitMonoMULaw — zero conversion needed
        ↓
CALL LOG (Supabase: sales_calls)
  - Outcome, transcript, product pitched, booked_followup
```

## JST Product Catalog (for LLM context)

| System | Target Business | Price |
|--------|----------------|-------|
| GlowDesk | Nail techs, hair salons, beauty studios | US$35/mo |
| SlotIQ | Multi-staff service (spas, clinics, gyms) | US$39/mo |
| DeskBot | Any business wanting 24/7 AI chatbot | US$39/mo |
| PunchPro | Repeat-visit businesses (gyms, carwashes) | US$29/mo |
| SignalBoard | Analytics for multi-channel businesses | US$45/mo |
| FleetRun | Courier/delivery/logistics companies | US$49/mo |
| TourBase | Tour operators, experience vendors | US$49/mo |
| EnrollIQ | Schools, tutoring centers, academies | US$59/mo |
| RingPilot | High-inbound-call businesses | US$59/mo |
| HaulBase | Moving companies, storage facilities | US$59/mo |
| TableFlow | Restaurants, event venues | US$69/mo |
| StockOps | Wholesalers, distributors, retailers | US$79/mo |
| DwellDesk | Property managers, landlords | US$89/mo |

## Lead Targeting Strategy
- Primary: Businesses on Google Maps/Facebook/Instagram with NO website
- Secondary: Businesses with outdated websites (pre-2020)
- Qualification signal: Has phone number, no web booking, no CRM
- Industries: Beauty, Logistics, Tourism, F&B, Property, Education, Retail

## Environment Variables
See .env.example for full list.

## Database Tables
- `sales_leads` — scraped/curated prospect list
- `sales_calls` — call log with outcome and transcript

## Call Flow State Machine
```
greeting → qualify (what's your business?) 
        → pitch (here's the perfect system)
        → objection (handle price/time concern)
        → close (free trial, no card needed)
        → schedule (book a demo call)
        → end
```

## Agent Handoff Notes
- Voice: Marcus (en-US-AndrewMultilingualNeural) — NOT African accent
- Tone: Professional Caribbean, warm, direct
- Goal: Book a free trial OR a 15-min demo call
- Never pitch price first — qualify and match product first
