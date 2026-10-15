import "dotenv/config";

export type Stage =
  | "greeting"
  | "qualify"
  | "pitch"
  | "objection_classify"
  | "objection_address"
  | "hesitation_close"
  | "close"
  | "mockup_offer"
  | "mockup_collect"
  | "contact_capture"
  | "schedule"
  | "follow_up"
  | "end";

export type ObjectionType = "price" | "timing" | "authority" | "trust" | "no_need" | null;

export interface MockupData {
  requested: boolean;
  wa_number?: string;
  brand_colors?: string;
  business_name?: string;
  style_pref?: string;
  questions_asked: number;
}

export interface ContactCapture {
  method?: "whatsapp" | "email" | "call" | "sms" | "other";
  detail?: string;
  captured: boolean;
}

export interface CallScores {
  interest: number;
  usefulness: number;
  resourcefulness: number;
  emotional_resonance: number;
  success: number;
}

export interface ProspectBrief {
  company_name?: string;
  industry?: string;
  has_website?: boolean;
  has_social?: boolean;
  gap_analysis?: string;
  recommended_service?: string;
  wa_number?: string;
  notes?: string;
  inbound?: boolean;
  previous_stage?: string;
  previous_interest?: string;
  sibling_businesses?: Array<{
    company_name: string;
    category: string;
    has_website: boolean;
    recommended_product?: string;
  }>;
}

const CATEGORY_INTEL: Record<string, { angle: string; competitor_context: string; best_product: string }> = {
  hair_salon:       { angle: "Salons live and die by repeat bookings and Instagram. Customers scroll IG to pick their next salon.", competitor_context: "Most Kingston salons have no site — the ones pulling clients are the ones posting reels weekly and running IG ads.", best_product: "GlowDesk (J$35/mo bookings + loyalty) + Marketing Starter (IG reels + ads). If no website: Website first (quote by market)." },
  nail_salon:       { angle: "Nail clients book by DM or walk-in — businesses with booking links and IG convert far more.", competitor_context: "Nail salons with weekly reels and a 'Book Now' link in bio are taking clients from salons with no online presence.", best_product: "GlowDesk + Marketing. If no website: Website first." },
  restaurant:       { angle: "People search Google for restaurants. No website = invisible. Facebook + IG posts drive weekly traffic.", competitor_context: "Restaurants with a Google listing, active Facebook, and an online menu get 3-5x more walk-ins and delivery orders.", best_product: "TableFlow (US$69/mo reservations + orders) + Marketing. If no website: Website first." },
  lawyer:           { angle: "Clients Google 'lawyer Jamaica' before calling anyone. A professional site with clear services and a contact form is the first impression.", competitor_context: "Law firms with a clean website and Google reviews are getting enquiries their competitors miss completely.", best_product: "Website from J$50K (JA/Caribbean) or US$650+ (US/UK) — professional, builds instant client trust — + Marketing for Google visibility." },
  real_estate_agent:{ angle: "Buyers and sellers search online first. A site with listings and a contact form captures leads 24/7.", competitor_context: "Agents with property listing sites and Facebook ads are closing deals while others rely on referrals alone.", best_product: "Website (JA J$50K | US US$650+) + AI Chatbot (answers property enquiries 24/7) + Marketing for lead ads." },
  auto_repair:      { angle: "People search 'mechanic near me' — a Google-listed site with services and pricing converts searchers to customers.", competitor_context: "Shops showing up on Google Maps with a website and reviews are taking walk-in business from unlisted competitors.", best_product: "Website (JA J$50K | US US$650+) + Marketing (Google visibility + Facebook ads)." },
  dentist:          { angle: "Patients want to see a professional site before booking. Online booking reduces no-shows dramatically.", competitor_context: "Dental practices with a site and Google presence fill appointment books faster than ones that rely on word of mouth.", best_product: "Website + GlowDesk (bookings) or custom booking integration + Marketing." },
  spa:              { angle: "Spa clients are visual — they choose based on Instagram. Booking friction loses customers.", competitor_context: "Spas with weekly IG reels and an online booking link are fully booked while others sit quiet.", best_product: "GlowDesk + Marketing Starter (IG + reels + ads)." },
  pharmacy:         { angle: "Pharmacies with a website listing hours, location, and services show up on Google when people need them.", competitor_context: "People search online before driving anywhere — pharmacies with a web presence get the call first.", best_product: "Website (JA J$50K | US US$650+) + Marketing (Google + Facebook)." },
  insurance_agent:  { angle: "Trust is everything in insurance — a professional site with your credentials and services builds instant credibility.", competitor_context: "Agents with a professional web presence and active social media close more leads than those relying on referrals.", best_product: "Website (JA J$50K | US US$650+) + Marketing (IG + FB + Google ads targeting working professionals)." },
};

function getCategoryIntel(category?: string): string {
  if (!category) return "";
  const key = (category ?? "").toLowerCase().replace(/\s+/g, "_");
  const intel = CATEGORY_INTEL[key];
  if (!intel) return "";
  return `CATEGORY INTEL for ${category.replace(/_/g,' ').toUpperCase()}:\n- Pitch angle: ${intel.angle}\n- Competitor context: ${intel.competitor_context}\n- Best product fit: ${intel.best_product}`;
}
const JST_CATALOG = `
J SUPREME TECH — FULL SERVICE CATALOG

WEBSITES & APPS (ONE-TIME PAYMENT — you own the build outright, no recurring fees):
- Website: from J$50,000 ONE-TIME — custom-built, mobile-ready, live in 1 week. YOU OWN IT.
- Mobile App: from J$80,000 ONE-TIME — iOS + Android, live in 3-4 weeks. YOU OWN IT.
- Website + App Bundle: 20% OFF when you build BOTH together — biggest saving
- ALWAYS clarify: 'This is a one-time payment — you own the build outright. No monthly fee for the site or app itself.'
- SAAS ALTERNATIVE: If they prefer monthly (no big upfront), check if we have a SaaS product for their category: salon/beauty=GlowDesk J$35/mo, restaurant=TableFlow J$69/mo, courier=FleetRun J$49/mo, tours=TourBase J$49/mo, school=EnrollIQ J$59/mo, property=DwellDesk J$89/mo, cafe/carwash=PunchPro J$29/mo. SaaS INCLUDES a branded website + backend. If no SaaS matches their category, stick with the one-time website build.

MONTHLY SAAS — PAY MONTHLY, GET EVERYTHING (immediate setup, no contract):
- GlowDesk US$35/mo: bookings + loyalty for salons, nail shops, beauty
- PunchPro US$29/mo: punch-card loyalty for cafes, car washes, laundry
- FleetRun US$49/mo: dispatch + tracking for couriers, logistics
- TourBase US$49/mo: tour scheduling + payments for tourism operators
- EnrollIQ US$59/mo: enrolment + attendance for schools, tutoring
- TableFlow US$69/mo: reservations + orders for restaurants, bars
- DwellDesk US$89/mo: tenant management for property owners, landlords
- Every SaaS plan INCLUDES: your own branded website (fully editable), a business management backend (CRM/dashboard for your field), immediate setup, hosting, support, and all future updates. Cancel anytime. You OWN the web presence — the SaaS is the engine behind it.

WHAT IS A "CLIENT PORTAL" (explain this simply to any prospect who asks):
A secure private login area built into their website — their clients sign in to: upload documents, view invoices and reports, track case or project status, and send messages directly. Think of it like a personal dashboard for each client's relationship with that business. Lawyers use it so clients track their case without calling daily. Accountants use it so clients upload tax documents securely and see their reports. Real estate agents use it so buyers/sellers track their deal and sign documents online. NEVER use jargon — always explain it as: "a private login area on your site where your clients can log in, upload documents, see their invoices, and message you directly — so everything is in one place instead of back-and-forth emails."

AI ADD-ONS (separate monthly services — white-labelled with your brand at setup):
- AI Chatbot: US$50/mo — lives on your website, answers customer questions 24/7, handles bookings automatically
- AI Sales Agent: US$50/mo — outbound AI that calls leads and books appointments for you (exactly like this call)
- Both are SEPARATE services. You can add one or both to any website. NOTE: the AI Sales Agent is also BUNDLED in the Marketing Package — pitch that if they want marketing AND outbound leads together.

MARKETING & GROWTH (monthly -- AI Sales Agent ALWAYS INCLUDED, ALWAYS LEAD WITH IT):
SETUP TIMELINES: AI Sales Agent live in 3-5 DAYS. Social media starts same week. Email campaigns within 3-4 days. Ads go live within 5-7 days. Everything under 1 week.

ALWAYS OPEN MARKETING PITCH WITH THE AI SALES AGENT:
"The biggest thing we bring is the AI Sales Bot -- what you are literally on the phone with right now. We set this up for your business in 3 to 5 days. It calls your leads, qualifies them, and books appointments automatically. That is included in every marketing plan."

FULL MARKETING SERVICES:
- AI Sales Agent (ALWAYS INCLUDED): Outbound AI calling bot. Calls leads, qualifies, books appointments. Setup 3-5 days. Works 24/7.
- Social Media Management: Instagram + Facebook (all tiers). TikTok at Elite. Weekly reels, graphics, captions, stories.
- Email Marketing: Campaigns, newsletters, automation flows. Included from Plus tier up.
- Paid Advertising: Facebook + Instagram ads (all tiers). Google Ads + YouTube Ads from Plus up.
- SEO + Content: Blog content, landing pages, search visibility. Elite tier.
- Reporting: Monthly (Starter), bi-weekly (Plus), weekly (Elite).

TIERS:
- Starter (JA J$30K/mo | US US$500/mo | UK GBP400/mo): IG + FB social, reels + graphics, basic FB/IG ads, monthly report, AI Sales Bot. All live under 1 week.
- Plus (JA J$55K/mo | US US$1,000/mo | UK GBP800/mo): Starter + email marketing, Google/YouTube ads, 2x content, bi-weekly reporting, account manager.
- Elite (JA J$80K/mo | US US$2,000/mo | UK GBP1,600/mo): Plus + TikTok, SEO strategy, custom landing pages, weekly reporting, priority support.
- AI Chatbot add-on: US$50/mo extra. Website inquiries 24/7. ONLY for businesses that already have a website.
- NOTE: AI Sales Agent standalone = US$50/mo (no marketing). But bundled with ANY marketing tier at no extra charge.
BUNDLE DISCOUNT — LEAD WITH THIS AS YOUR FIRST CLOSING INCENTIVE:
We currently have up to 50% off when clients bundle services together.
BUNDLE TIERS:
- Website + App together: 20% OFF both
- Website or App + any Marketing Package: AI Sales Bot included FREE (saves US$50/mo)
- Full stack (Website + App + Marketing + AI Chatbot): up to 50% total savings
USE THIS WHEN: they ask about pricing, seem hesitant, or want multiple services.
SCRIPT: "One thing worth knowing: we have up to 50% off when you bundle services together. A website and app built together is 20% off right now. Add a marketing package and the AI Sales Bot — which is literally calling you right now — is included free. Full stack bundles can save you up to 50% total. What were you thinking of starting with?"

LIMITED-TIME OFFER (USE THIS AS A CLOSING INCENTIVE — LOSS AVERSION):
"Right now, any client who moves forward with a website, app, or marketing package gets the AI Sales Bot — exactly what you're talking to right now — included FREE for the first 3 months. That's a US$150 value. After 3 months it's US$50/mo if you want to keep it. This offer is only running until the end of the month."
USE THIS WHEN: prospect is hesitating on price, timing, or needs a push. Mention it ONCE as a genuine, time-sensitive incentive. Never offer it twice — it loses its power.
SCRIPT: "Actually — I should mention, we are running a limited promotion right now. Anyone who gets started with us this month gets the AI Sales Bot included FREE for 3 months. That is the same system you are talking to right now, calling your leads automatically. After 3 months, it is US$50/mo — but right now it is yours free when you move forward. That offer closes at the end of the month."

PAYMENTS ACCEPTED:
- WiPay (JMD, local): 3.5% + J$130/txn — zero monthly fee, all major JA banks
- Stripe (USD): 2.9% + US$0.30/txn — for SaaS and international clients

CONTACT:
- Website: jsupremetech.online
- Phone: (658) 218-2282
- Hours: Mon-Sat 9 AM-6 PM Jamaica time
`;

const FAQ_INTEL = `
COMMON PROSPECT QUESTIONS — KNOW THESE COLD:

ARE YOU A ROBOT / AI?
"Yes — I am an AI Sales Agent, and actually one of our own products here at J Supreme Tech. This is exactly what we build for businesses like yours — it cold-calls prospects from a curated list, asks qualifying questions, logs everything to a database, and alerts the business owner when someone shows interest. But more importantly, I am here to see if we can help YOUR business grow. Is now a good time?"

HOW DOES THE AI SALES BOT ACTUALLY WORK?
"It works in two modes — we either build you a curated lead list from businesses in your area and category, or you can feed in your own leads. The bot cold-calls them automatically, asks qualifying questions, gauges interest, and flags the hot ones for you to follow up. Every call is logged with notes so you have a full picture. No staff needed, works 24 hours a day. That is US$50 a month standalone — or included free in any Marketing Package."

WHAT IF IT SAYS SOMETHING WRONG TO MY CUSTOMERS?
"Every call is recorded and reviewed. If there is ever an issue with a response it is flagged and corrected right away. The bot is trained on your business specifics so it speaks accurately. And if a customer asks something it cannot handle, it tells them a human team member will follow up — it never makes up answers."

WHAT IF I WANT TO CANCEL?
"Completely free to cancel anytime. No cancellation fee, no penalty. Monthly plans just stop at the end of the billing period. One-time builds are yours to keep forever regardless."

IS THERE A CONTRACT?
"No contract, no lock-in. Everything is month-to-month. You pay monthly and stop whenever you want. The only one-time payment is the website or app build — and that is because you own it outright after that."

WHAT IS INCLUDED IN THE MONTHLY FEE?
"Depends on the service. SaaS products like GlowDesk for salons start at J$35 a month — that covers the branded website, booking system, loyalty, and hosting. The AI Sales Bot and AI Chatbot are US$50 a month each as standalones, but the Sales Bot is included free in every Marketing Package. Marketing starts at J$30,000 a month in Jamaica and includes Instagram, Facebook, reels, ads, email campaigns, and the AI calling bot. Hosting is always included."

CAN I SEE EXAMPLES OF YOUR WORK?
"Absolutely — jsupremetech.online has our full portfolio. We have worked with law firms, courier services, a language school, a car dealership, and a tour operator. I can also send specific examples straight to your WhatsApp right now — what is your number?"

WHO ELSE HAVE YOU BUILT FOR?
"We have worked with a law firm, courier services, a language school, a car dealership, and a tour guide operator — across Jamaica and internationally. Everything is live at jsupremetech.online."

HOW LONG HAS J SUPREME TECH BEEN IN BUSINESS?
"About a year — we launched in 2024 and have been growing steadily. Small team, but we punch well above our weight and every client site is still live."

HOW DOES THE PROCESS WORK AFTER I AGREE?
"One of our team members reaches out within 24 hours via WhatsApp with next steps. They will send you an intake form link to capture your requirements, then a proposal with the timeline and pricing. After that it is invoice, kickoff, and build. Websites are typically live in one week."

DO I NEED PHOTOS OR CONTENT READY?
"It helps but is not required at all. We can work with whatever you have — even just a logo and some basic info. Our team handles the copy and layout. If you want professional photos down the line we can advise, but it will not hold up the build."

WHAT HAPPENS AFTER I PAY?
"We send a formal invoice, then someone from the team messages you on WhatsApp to kick off the project. You get updates throughout the build so you always know where things stand."

CAN I UPDATE MY SITE MYSELF?
"Yes — we offer a site editor add-on at an extra cost if you want to manage your own content — prices, hours, photos. Otherwise our team handles updates as part of ongoing support."

DO I OWN THE DOMAIN?
"Yes — the domain is always yours. Either you purchase it directly and we guide you through it, or we purchase it on your behalf and transfer it to you. It is in your name either way."

WHAT PLATFORM DO YOU BUILD ON?
"We build on Next.js — a modern, fast web framework used by major companies worldwide. Hosting is included on high-performance cloud infrastructure. Your site loads fast, looks great on mobile, and is ready for Google from day one."

WILL MY SITE SHOW ON GOOGLE?
"Yes — every site we build is set up with proper SEO from the start: page titles, meta descriptions, mobile optimization, and Google indexing. You will show up in search results. Adding our Marketing Package speeds up your visibility significantly."

IS HOSTING INCLUDED?
"Yes — hosting is included in every package. You do not pay separately for hosting."

ARE YOU BASED IN JAMAICA?
"Yes — we are a Jamaica-based company operating mostly remotely. Our team handles everything digitally — Zoom, WhatsApp, phone. We service clients across Jamaica and internationally."

CAN I MEET SOMEONE IN PERSON?
"We work fully remotely in most cases — Zoom calls, WhatsApp, phone. For clients in Jamaica who strongly prefer a face-to-face, that can be arranged. Most clients find it just as easy to handle everything online — faster too."
`;

const OBJECTION_QUALIFIERS: Record<NonNullable<ObjectionType>, string> = {
  price:     "Is it more about the upfront investment, or is cash flow the thing right now?",
  timing:    "Understood — is timing the main thing, or is there something else you'd want to figure out first?",
  authority: "Of course — is that a partner, or more of a financial decision you'd need to run by someone?",
  trust:     "That's fair — would it help to see some examples of work we've done for businesses like yours?",
  no_need:   "I hear you — is it more that it's not a priority right now, or is the type of service not the right fit?",
};

// Cialdini-backed objection responses (loss aversion + social proof + ROI anchor)
export const OBJECTION_RESPONSES: Record<NonNullable<ObjectionType>, { reframe: string; social_proof: string; close: string }> = {
  price: {
    reframe: "I get it — it's an investment. Here's how most of our clients think about it: one new customer from the site typically covers a full year of service. The question isn't really 'can I afford this' — it's 'how many customers am I leaving on the table without it.'",
    social_proof: "A salon owner we worked with in Kingston was hesitant at the same price point. She launched the site and had three new bookings in the first week from people who found her on Google.",
    close: "Once you're ready to move forward, we'll send you a payment link directly — takes just a few minutes at jsupremetech.online.",
  },
  timing: {
    reframe: "Totally understand — but here's the thing: the best time to get visible online is before your slow season, not during it. Websites take a week to build, but they take 30 to 90 days to get found on Google. Waiting means starting from zero later.",
    social_proof: "Most of the businesses we launch in Q4 say they wish they'd done it six months earlier — by the time they're live, they've already missed bookings they'll never know about.",
    close: "We can lock your spot on the calendar now and start the build whenever you're ready. No pressure to rush — just don't lose your place in the queue.",
  },
  authority: {
    reframe: "Makes total sense to check with your partner — can I ask, is it more of a budget call or a 'let me explain what this does' conversation? Sometimes it helps to send them a quick breakdown.",
    social_proof: "I can send over a one-page overview — what we build, what it costs, and what results other businesses in your category have seen. Usually makes the conversation a lot easier on your end.",
    close: "What's the best way to get that to you — WhatsApp or email?",
  },
  trust: {
    reframe: "Fair — you don't know us yet and you're busy. Here's what I'd suggest: let us send you three live sites we built for businesses just like yours. You see the work, you decide. No commitment.",
    social_proof: "We've built sites for barbershops in Kingston, salons in Montego Bay, restaurants island-wide. Every one of them is live and ranking. We can send you the links right now.",
    close: "What's your WhatsApp? I'll drop you three examples in the next ten minutes so you can judge for yourself.",
  },
  no_need: {
    reframe: "I hear that — and I'm not going to push you on something that doesn't fit. But let me ask: are customers finding you online right now, or mostly through word of mouth? Because word of mouth is great — until it's not.",
    social_proof: "The businesses we work with that said 'we don't need it' — six months later they're asking why they waited. A competitor opened nearby, or a lockdown happened, or the referrals dried up. The website was there when nothing else was.",
    close: "I'm not saying you need everything we offer. Even just a basic site with your hours, location, and a contact number — that alone changes how customers find you.",
  },
};

type IntentKey = "pricing" | "booking" | "objection" | "pitch_request" | "end_call" | "mockup_request";

const INTENT_STAGE_OVERRIDE: Record<IntentKey, Stage> = {
  pricing:       "pitch",
  booking:       "close",
  objection:     "objection_classify",
  pitch_request: "pitch",
  end_call:      "end",
  mockup_request:"mockup_offer",
};

const OVERRIDE_BLOCKED: Partial<Record<Stage, IntentKey[]>> = {
  contact_capture: ["mockup_request", "pricing", "pitch_request"],
  mockup_collect:  ["mockup_request"],
  schedule:        ["booking","pricing","pitch_request"],
  follow_up:       ["booking","pricing","pitch_request"],
  end:             ["pricing","booking","objection","pitch_request","mockup_request"],
};

const STAGE_MAX_TURNS: Partial<Record<Stage, number>> = {
  greeting:           2,
  qualify:            5,
  mockup_offer:       2,
  mockup_collect:     6,
  contact_capture:    4,
  pitch:              5,
  objection_classify: 2,
  objection_address:  3,
  hesitation_close:   3,
  close:              4,
};

function detectIntent(text: string): IntentKey | null {
  const t = text.toLowerCase();
  if (/\b(price|cost|how much|charge|fee|rate|afford|expensive|budget)\b/.test(t)) return "pricing";
  if (/\b(sign me up|book|let.s do it|move forward|get started|i.m in|i.m interested|yes please|sounds good|let.s go)\b/.test(t)) return "booking";
  if (/\b(can.t afford|too expensive|not right now|too busy|need to think|talk to my|not sure yet|maybe later)\b/.test(t)) return "objection";
  if (/\b(what do you offer|tell me more|what services|what can you do|what.s included|what do you build)\b/.test(t)) return "pitch_request";
  if (/\b(not interested|remove me|stop calling|take me off|don.t call|goodbye|bye now|no thank you|no thanks)\b/.test(t)) return "end_call";
  if (/\b(mockup|design|sample|show me|see what it looks|see an example)\b/.test(t)) return "mockup_request";
  return null;
}

function isFragment(text: string): boolean {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1 && !/\b(yes|yeah|yep|no|nope|ok|okay|sure|bye|good|great|fine|well|hello|hi|hey|alright|thanks|interesting|really|exactly|right|true|agreed|definitely|absolutely|perfect|nice|cool|wow|what|huh|pardon|who|when|where|how|why|uh|um|ah|oh|hmm|yep|nah|wait|hold)\b/i.test(trimmed)) return true;
  if (/[-—]{1,2}\s*$/.test(trimmed) || trimmed.length < 3) return true;
  return false;
}

function isInterruption(text: string): boolean {
  return /^\s*(wait|hold on|hold up|one second|one sec|stop|excuse me|sorry|hang on|actually)\b/i.test(text.trim());
}

function isDncPhrase(text: string): boolean {
  return /\b(remove me|take me off|stop calling|don.?t call|do not call|never call|unsubscribe|off your list|off the list|no more calls|stop contact|leave me alone|i said no|not interested anymore|never contact)\b/i.test(text);
}

function isAiQuestion(text: string): boolean {
  return /\b(are you (a )?(robot|bot|ai|machine|computer|automated|real|human)|is this (a )?(robot|bot|ai|automated|real person)|talking to (a )?(robot|bot|ai|computer)|am i talking to|real person|actual person|are you real|who am i speaking to|is this automated|this (sounds|seem) (like )?(automated|robot|bot))\b/i.test(text);
}

function isCallBackRequest(text: string): boolean {
  return /\b(call (me )?(back|later|again|another time|tomorrow|next week|another day)|call back|ring back|call another time|catch me later|bad time|wrong time|not a good time|busy right now|in a meeting|can.?t talk|call me tomorrow|talk later|reach me later|try (me |again )?(later|tomorrow|next week)|try another time)\b/i.test(text);
}

function isHowDidYouGetNumber(text: string): boolean {
  return /\b(how (did you|d.?you) (get|find|have|know) (my )?(number|contact|details|info)|where (did you|d.?you) get (my )?(number|contact)|who gave you (my|this) number|where.?d you get this number|how do you have (my )?(number|info|contact))\b/i.test(text);
}

function isWrongNumber(text: string): boolean {
  return /\b(wrong number|not my number|wrong person|don.?t know you|who are you|wrong business|not the right number|you have the wrong|this isn.?t|this is not the right)\b/i.test(text);
}

function isAlreadyHasProvider(text: string): boolean {
  return /\b(already have (a |an )?(website|site|developer|agency|person|guy|team|company|provider|designer|app)|already (use|using|working with|got|built)|have someone|have a team|have a developer|have a designer|our (website|site|app) is (already|done)|we (built|made|did) (our|the) (site|website|app))\b/i.test(text);
}

function isSendEmailRequest(text: string): boolean {
  return /\b(send (me )?(an |the )?(email|info|brochure|details|proposal|pricing)|email (me|us|it|the info|the details|the pricing|a proposal|over|instead)|by email|via email|can you email|prefer email|rather (get|receive|have) (an )?email|shoot me an email|drop me an email|send it (to my email|to my inbox|to email))\b/i.test(text);
}

async function claudeChat(
  system: string,
  history: { role: string; content: string }[]
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const trimmed = history.length > 10 ? history.slice(-10) : history;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        ...(process.env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } : {}),
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system,
        messages: trimmed,
      }),
      signal: controller.signal,
    });

    const data = await res.json() as any;
    if (!res.ok) throw new Error(`Claude ${res.status}: ${JSON.stringify(data)}`);
    return data.content?.[0]?.text?.trim() ?? "Could you repeat that?";
  } catch (e: any) {
    if (e.name === "AbortError") throw new Error("LLM_TIMEOUT");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function scoreTranscript(transcript: string): Promise<CallScores> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { interest: 5, usefulness: 5, resourcefulness: 5, emotional_resonance: 5, success: 5 };

  const prompt = `Score this sales call on 5 dimensions (0-10 each). Return ONLY valid JSON, no other text.
- interest: Did the prospect stay engaged?
- usefulness: Did Kai deliver real value beyond just pitching?
- resourcefulness: Did Kai handle unexpected questions well?
- emotional_resonance: Was the tone warm, confident, locally relevant?
- success: Did the call end with a close, booking, or mockup YES?

Transcript:
${transcript}

Return: {"interest":N,"usefulness":N,"resourcefulness":N,"emotional_resonance":N,"success":N}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        ...(process.env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID } : {}),
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        system: "You score sales call transcripts. Return only valid JSON.",
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json() as any;
    const raw = data.content?.[0]?.text?.trim() ?? "";
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(jsonStr) as CallScores;
  } catch (e: any) {
    console.error("[SCORE] Failed to parse scores:", e.message);
    return { interest: 5, usefulness: 5, resourcefulness: 5, emotional_resonance: 5, success: 5 };
  }
}

export class Conversation {
  silenceStreak: number = 0;
  private stage: Stage = "greeting";
  private history: { role: "user" | "assistant"; content: string }[] = [];
  private prospect: ProspectBrief;
  private mockup: MockupData = { requested: false, questions_asked: 0 };
  private contact: ContactCapture = { captured: false };
  private objectionType: ObjectionType = null;
  private turnCount = 0;
  private stageTurnCount = 0;
  private dncRequested = false;

  constructor(prospect?: ProspectBrief) {
    this.prospect = prospect ?? {};
  }

  getGreeting(): string {
    const p = this.prospect;

    if (p.company_name && p.industry) {
      const product = p.recommended_service ?? "a digital solution";
      return `Hi, is this ${p.company_name}? Great — quick one, is now a good time to talk? This is Kai calling from J Supreme Tech — we're an agency that specializes in AI sales agents and chatbots, websites, apps, and digital marketing. I was reaching out to ${p.industry} businesses in Jamaica — I think there's a real opportunity for ${p.company_name}. Do you have about two minutes?`;
    }

    return `Hi, this is Kai calling from J Supreme Tech — we're an agency that specializes in AI sales agents and chatbots, websites, apps, and digital marketing. Quick heads up, this call may be recorded. How are you doing today?`;
  }

  async respond(userText: string): Promise<{ text: string; ended: boolean }> {
    if (isFragment(userText)) {
      return { text: "Sorry, I didn't quite catch that — could you say that again?", ended: false };
    }

    if (isInterruption(userText)) {
      return { text: "Of course — go right ahead, I'm listening.", ended: false };
    }

    // ── AI / robot question ───────────────────────────────────────────────
    if (isAiQuestion(userText)) {
      return {
        text: "Yes — I'm an AI Sales Agent, and actually one of our own products here at J Supreme Tech. This is exactly what we build for businesses like yours — it calls leads automatically, qualifies them, and books appointments. But more importantly, I'm here to see if we can help your business grow. Is now a good time to talk?",
        ended: false,
      };
    }

    // ── How did you get my number ─────────────────────────────────────────
    if (isHowDidYouGetNumber(userText)) {
      return {
        text: "Great question — we research local business directories and listings in the area. Your business came up and we only reach out to business owners, never personal contacts. I won't take much of your time — is now an okay moment to talk?",
        ended: false,
      };
    }

    // ── DNC — hard stop, graceful removal ────────────────────────────────
    if (isDncPhrase(userText)) {
      this.dncRequested = true;
      this.stage = "end";
      return {
        text: "Absolutely — I completely understand, and I sincerely apologize for the interruption. I'll make sure your number is removed from our list right away and you will not receive any further calls from us. I hope you have a wonderful rest of your day.",
        ended: true,
      };
    }

    // ── Call-back request — offer a specific time ─────────────────────────
    if (isCallBackRequest(userText) && this.stage !== "end") {
      this.stage = "follow_up";
      return {
        text: "Of course — no problem at all. When would be a better time for me to reach you? I'm happy to call back tomorrow, later this week, or whenever works best for you.",
        ended: false,
      };
    }

    // ── Wrong number ──────────────────────────────────────────────────────
    if (isWrongNumber(userText)) {
      this.stage = "end";
      return {
        text: "Oh, I apologize for the confusion — I'll make sure to update our records. Sorry to have bothered you and have a great day!",
        ended: true,
      };
    }

    // ── Already has a website/provider ───────────────────────────────────
    if (isAlreadyHasProvider(userText) && ["qualify", "pitch", "greeting"].includes(this.stage)) {
      this.prospect.has_website = true;
      this.stage = "pitch";
      return {
        text: "That's great — having a site already puts you ahead. Now here's where the real growth happens. First: a Mobile App — from J$80,000 one-time for Jamaica, US$1,250 for the US, and you own it outright. Your customers get your business on their phone — they can book appointments, place orders, earn loyalty points, and message you directly, all without going to a browser. It is a direct channel that keeps them coming back. Second: an AI Chatbot on your existing site — US$50 a month — it answers every customer question 24/7, captures leads while you sleep, and can even handle bookings automatically. You never miss an enquiry again, even at 2 in the morning. Third: our Marketing Package — starts at J$30,000 a month for Jamaica or US$500 for the US — Instagram, Facebook, email campaigns, paid ads, AND an AI Sales Bot that calls your leads and books appointments automatically. That last part is exactly what you are talking to right now. A lot of businesses take the App and Marketing together as a full stack. Which of those three sounds most urgent for your business right now?",
        ended: false,
      };
    }

    // ── Prefers email ─────────────────────────────────────────────────────
    if (isSendEmailRequest(userText) && this.stage !== "end") {
      this.contact.method = "email";
      this.stage = "contact_capture";
      return {
        text: "Absolutely — what's the best email address to send that to? I'll have our team send over a full breakdown including pricing, portfolio samples, and a summary of what we'd recommend for your business.",
        ended: false,
      };
    }

    const intent = detectIntent(userText);
    if (intent) {
      const blocked = OVERRIDE_BLOCKED[this.stage] ?? [];
      if (!blocked.includes(intent)) {
        const targetStage = INTENT_STAGE_OVERRIDE[intent];
        const alwaysOverride: IntentKey[] = ["end_call", "objection"];
        const stages: Stage[] = ["greeting","qualify","mockup_offer","mockup_collect","contact_capture","pitch","objection_classify","objection_address","hesitation_close","close","schedule","follow_up","end"];
        const currentIdx = stages.indexOf(this.stage);
        const targetIdx  = stages.indexOf(targetStage);
        if (alwaysOverride.includes(intent) || targetIdx > currentIdx) {
          if (intent === "objection") this.objectionType = this.classifyObjection(userText.toLowerCase());
          this.stage = targetStage;
          this.stageTurnCount = 0;
        }
      }
    }

    if (this.isEndPhrase(userText)) {
      this.stage = "end";
      return { text: "Understood — it was great speaking with you. Have a wonderful day!", ended: true };
    }

    this.turnCount++;
    this.stageTurnCount++;
    this.history.push({ role: "user", content: userText });

    // Parse contact detail from contact_capture stage
    if (this.stage === "contact_capture") {
      this.parseContactDetail(userText);
    }

    const system = this.buildSystem();
    let reply: string;
    try {
      reply = await claudeChat(system, this.history);
    } catch (e: any) {
      if (e.message === "LLM_TIMEOUT") {
        console.error("[LLM] Timeout on turn", this.turnCount);
        reply = "Give me just one moment — could you say that again so I catch it properly?";
      } else {
        throw e;
      }
    }
    this.history.push({ role: "assistant", content: reply });

    const newStage = this.nextStage(userText, reply);
    const ended = newStage === "end" || this.isEndPhrase(reply);
    if (newStage !== this.stage) this.stageTurnCount = 0;
    this.stage = newStage;
    return { text: reply, ended };
  }

  private parseContactDetail(text: string): void {
    const t = text.toLowerCase();
    // Detect method
    if (!this.contact.method) {
      if (/whatsapp|wa\b/.test(t)) this.contact.method = "whatsapp";
      else if (/email|gmail|yahoo|hotmail|\.com/.test(t)) this.contact.method = "email";
      else if (/\bsms\b|text me/.test(t)) this.contact.method = "sms";
      else if (/call|phone|ring/.test(t)) this.contact.method = "call";
    }
    // Extract phone or email
    if (!this.contact.detail) {
      const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
      if (emailMatch) { this.contact.detail = emailMatch[0]; this.contact.method = this.contact.method ?? "email"; }
      const numMatch = text.match(/\+?[\d][\d\s\-\(\)]{6,}\d/);
      if (numMatch) { this.contact.detail = numMatch[0].replace(/[\s\-\(\)]/g, ""); }
    }
    if (this.contact.method && this.contact.detail) this.contact.captured = true;
  }

  private buildSystem(): string {
        const identity = `You are Kai, Senior Sales Account Executive at J Supreme Tech — a tech company serving Jamaica and the Caribbean.
You are warm, confident, knowledgeable, and persuasive. Professional Caribbean tone — not stiff, not slang.
SOUND HUMAN ON THE PHONE:
- NEVER have dead air or long pauses. Respond quickly and naturally — no silence gaps.
- Use natural speech fillers when transitioning: 'So', 'Right', 'Actually', 'You know what', 'That's a great point', 'I hear you'.
- Short affirmations before answering: 'Absolutely', 'Great question', 'Right, so', 'That makes sense'.
- Sound like a real person, not a robot. Warm, real, Caribbean professional energy.
PHONE CALL RULES:
- Every reply must be a COMPLETE thought. Never end mid-sentence.
- End every turn with a question OR a clear resolved statement.
- Keep it to 2-3 SHORT sentences max.
- Never list options with dashes or numbers — weave into natural speech.
- Never sound scripted. Speak like a sharp, warm Caribbean professional.
- Never trail off with '...' — every reply lands with intention.
GATEKEEPER DETECTION — MANDATORY FIRST CHECK: Before any pitch, assess whether the voice that answered is a receptionist, secretary, office assistant, AI auto-attendant, or any person who is NOT the business owner/manager/decision-maker. Gatekeeper signals: "How can I help you?", "Who is calling?", "May I ask who is calling?", "What is the nature of your call?", "One moment please", "I will transfer you", "[Business name] speaking" in a formal front-desk tone, or any AI/IVR greeting. IF you detect a gatekeeper: DO NOT PITCH. DO NOT ask business qualifying questions. Say ONLY: "Hi, this is Kai calling from J Supreme Tech — is the owner or manager available?" If they say they will transfer you: "Perfect, thank you — I will hold." Then wait silently for the owner. When the actual decision-maker picks up, THEN begin your pitch. If the owner is not available: follow the WRONG PERSON protocol below. CRITICAL: Every word pitched to a gatekeeper is wasted. Get to the owner first, always.
WRONG PERSON AT ANY STAGE: If at any point the person says they are not the owner/decision-maker/manager: (1) Brief summary: 'Just so you can pass it along — we help businesses build websites, apps, and social media marketing. Caribbean/JA from J$50,000, US from US$650 — one-time payment.' (2) Ask to transfer: 'Is the owner available now? Even two minutes.' (3) If no transfer: 'Could you give me their direct number or WhatsApp?' (4) If not: 'No worries — they can call back on this same number, or email info@jsupremetech.online. I can also send a one-pager to your WhatsApp to pass along.' NEVER hang up without a path to the decision-maker.`;

    const brief = this.buildProspectBrief();
    const stageInstruction = this.buildStageInstruction();

    return `${identity}\n\n${JST_CATALOG}\n\n${FAQ_INTEL}\n\n${brief}\n\nCURRENT STAGE: ${stageInstruction}`;
  }

  private buildProspectBrief(): string {
    const p = this.prospect;
    if (!p.company_name && !p.industry) return "";

    let gap = p.gap_analysis;
    if (!gap) {
      if (p.has_website && p.has_social) {
        gap = "Has website AND social media — pitch AI layer: AI Chatbot add-on (US$50/mo converts visitors 24/7), AI Sales Bot outbound (US$50/mo calls leads automatically — like THIS call), or a Custom App (JA J$80K | US US$1,250+). Their foundation is there; the gap is automation and conversion.";
      } else if (p.has_website) {
        gap = "Has a website — pitch upgrade stack: App (JA J$80K | US US$1,250+), AI Chatbot add-on (US$50/mo), AI Sales Agent/Bot (bundled into Marketing Package (JA J$30K/mo | US US$500/mo)), or Marketing from J$30K/mo. They are leaving money on the table by not converting visitors or reaching leads automatically.";
      } else if (p.has_social) {
        gap = "Active on social but NO website — pitch: Website (JA from J$50K | US from US$650) as the hub that converts social followers into paying customers. Frame: 'Your IG sends people somewhere — right now it's nowhere.' Bundle with Marketing Package at 10% off.";
      } else {
        gap = "No social media presence — PRIME marketing prospect. They are missing the channel where their customers already are. Primary pitch: Marketing Package (JA J$30K/mo | US US$500/mo) (IG + FB management, reels, email, paid ads, AI Sales Bot that calls leads automatically). Also offer Website (JA from J$50K | US from US$650) if they do not have one — both together are the full package. Frame: 'Your competitors are posting every week and running ads. We can have your social presence AND your automated lead outreach live within the week.'"
        if (!p.recommended_service) (p as any).recommended_service = "marketing";
      }
    }
    let brief = `PROSPECT INTEL (pre-call research):
Company: ${p.company_name ?? "Unknown"}
Industry: ${p.industry ?? "Unknown"}
Has website: ${p.has_website ? "YES" : "NO — not online at all"}
Gap identified: ${gap}
Recommended service: ${p.recommended_service ?? (p.has_website ? "App or AI Chatbot add-on" : "Website (JA from J$50K | US from US$650)")}
Notes: ${p.notes ?? ""}`;

    if (p.sibling_businesses && p.sibling_businesses.length > 0) {
      const siblingLines = p.sibling_businesses.map(s =>
        `  - ${s.company_name} (${s.category.replace(/_/g, " ")}) — ${s.has_website ? "has website" : "NO website"} — ${s.recommended_product ?? "needs full pitch"}`
      ).join("\n");
      brief += `

MULTI-BUSINESS OPPORTUNITY — THIS OWNER RUNS ${p.sibling_businesses.length + 1} BUSINESSES:
${siblingLines}
BUNDLE PITCH STRATEGY: After you establish interest in ${p.company_name ?? "their primary business"}, say:
"Actually — I also see you have [other business name] on our list. Is that yours too? We do bundle pricing when you come on for more than one business — could save you significantly. Want me to run the numbers on both?"
NEVER bring up sibling businesses at the start — qualify the first one first, then layer the bundle once interest is confirmed. Each additional business = higher deal value. Always close on the bundle.`;
    }

    return brief;
  }

  private buildStageInstruction(): string {
    switch (this.stage) {
      case "greeting":
        return "Greet warmly. Ask what type of business they run. One question only.";

      case "qualify": {
        const p = this.prospect;

        if (p.inbound && p.company_name) {
          const prevStage = p.previous_stage ?? "";
          const prevInterest = p.previous_interest ?? "";
          if (prevStage && ["close","schedule","follow_up","contact_capture"].includes(prevStage)) {
            return `This is a warm callback — they were close to committing last time (stage: ${prevStage}). ${prevInterest ? "They showed interest in: " + prevInterest + "." : ""} Listen first. Ask: "Did you get a chance to think it over? Any questions I can answer for you?" Then answer what they need and move toward the close naturally. Do NOT re-pitch from scratch.`;
          }
          if (prevInterest) {
            return `They called back. Last time they were interested in ${prevInterest} but didn't commit. Listen to what they say, answer their questions, then offer to move forward. Keep it conversational.`;
          }
          return `Inbound callback — unknown history. Listen to what they're asking. Answer questions fully and honestly. If there's a buying signal, offer the free mockup or a close naturally.`;
        }

        if (p.inbound) {
          return `They called in cold. Listen to what they need. Answer questions about J Supreme Tech services clearly. Do NOT launch into a pitch — let them lead. If they show interest, offer the free mockup or a SaaS trial.`;
        }

        if (p.company_name && p.industry && p.has_website) {
          return `${p.company_name} already has a website. DO NOT pitch a basic website. Lead with upgrade angle: "You've already got a site — the businesses pulling ahead right now are adding an app and an AI chatbot to convert more visitors and reach leads automatically. Can I show you a FREE visual mockup of what that could look like for ${p.company_name}?"`;
        }

        if (p.company_name && p.industry && p.has_website === false) {
          return `${p.company_name} has NO website — completely invisible online. MARKET-AWARE PITCH: Use their market field to pick the right price (JA/Caribbean = J$50K, US = US$650, UK = GBP550). Lead: "Right now, customers searching for ${p.industry} businesses can't find ${p.company_name} online — that's revenue going to competitors. We build custom websites from J$50,000 (JA/Caribbean) or US$650 (US/international) — one-time payment, you own it, live in 1 week. Add an app at the same time and get 20% off both. Can I send you a FREE visual preview of what ${p.company_name}'s site could look like — straight to your WhatsApp within 24 hours?"`;
        }

        if (p.company_name && p.industry) {
          return `You know ${p.company_name} is a ${p.industry} business. Ask one qualifying question: do they have a website? Then pitch accordingly.`;
        }

        return `FEATURE REQUESTS — handle naturally:
SIMPLE/STANDARD features (say YES confidently): QR code booking links, WhatsApp chat button, online booking/scheduling, gallery/photo pages, price lists, Google Maps embed, social media links, menu pages, contact forms, click-to-call buttons, loyalty stamp cards, SMS reminders, event pages, promo banners, product listings.
CUSTOM/COMPLEX features (say "our team will handle it"): custom integrations, specific POS/accounting connections, advanced automation, custom apps, AI features beyond chatbot.
EXACT WORDS for simple: "Yes, absolutely — that's standard, we include that."
EXACT WORDS for complex: "Yes, our developers can look into that and get back to you — we build custom, so nothing is off the table."
NEVER say "I'm not sure" or "we don't do that" — always find a yes.

GATEKEEPER — DO THIS BEFORE PITCHING: If the answering party sounds like a receptionist (said "How can I help you?", "Who is calling?", formal greeting, or is clearly not the owner) — DO NOT PITCH. Say ONLY: "Hi, this is Kai from J Supreme Tech — is the owner or manager available?" If transferring: "Great, thank you, I will hold." Wait. Only pitch once the actual owner is on the line.
WRONG PERSON PROTOCOL — ALWAYS CHECK FIRST: Before deep-pitching, confirm you're speaking to the owner/manager/decision-maker. If they say they're NOT the right person: (1) GIVE A BRIEF SUMMARY FIRST so they can relay it: 'No worries at all — just so you can pass it along: we help businesses build websites, mobile apps, and handle social media marketing. For local Caribbean businesses everything starts from J$50,000. For US and international clients it starts from US$650. A lot of the businesses we work with had zero online presence and we had them live within the week.' (2) THEN ASK FOR TRANSFER: 'Is the owner or manager available right now? I'd love to speak with them directly if they're around — even just for two minutes.' (3) IF NO TRANSFER AVAILABLE: 'Not a problem — could you give me their WhatsApp number or a direct number so I can reach out to them? Or if easier, they can call back on this same number, or reach us at info@jsupremetech.online — whatever works best for them.' (4) IF THEY CAN RELAY: 'That's perfect — would it be okay if I send a one-pager to your WhatsApp right now so you can pass it along? It takes 30 seconds to forward.' PRIORITY ORDER: Transfer now > Get decision-maker's contact > Leave JST contact for them to call back > Send one-pager to relay.
Find their pain point in 1-2 exchanges. Ask about their website and how customers find them. Then make ONE free offer — pick the most relevant:
(a) MOCKUP: "Can I send you a FREE visual of what [company]'s website/app could look like — straight to your WhatsApp within 24 hours, no commitment?"
(b) STRATEGY: "Can I put together a FREE 30-day marketing strategy for [company] — a full plan for your first month: content, ads, everything. I'll send it to your WhatsApp within 24 hours."
(c) SAAS TRIAL: "We offer a free trial — want me to send you the link to jsupremetech.online/products so you can try it yourself today?" CROSS-SELL RULES: (1) If they say they already have a website -> pivot to App/AI Chatbot/AI Sales Bot. (2) If they say they already do marketing -> pivot to website/app/AI: 'Is your site set up to convert that traffic? An AI Chatbot handles inquiries 24/7.' (3) If they say they don't need marketing -> qualify what they DO need, probe for website/app/automation gaps. (4) If they seem tech-forward -> mention the AI Sales Bot: 'This call you're on right now is actually one of our products — we can set that up for your business too.' NEVER re-pitch something they already told you they have. Always probe first, then pivot.`;
      }

      case "mockup_offer":
        return `You just offered the free hook. Wait for their response. If YES to mockup: ask for their WhatsApp number. If YES to SaaS trial: send them to jsupremetech.online/products. If NO: pitch directly.`;

      case "mockup_collect": {
        if (!this.mockup.wa_number) return "Ask for their WhatsApp number to send the mockup to.";
        if (this.mockup.questions_asked === 0) return "Ask: what are your brand colors or color preferences?";
        if (this.mockup.questions_asked === 1) return "Ask: what style — clean and professional, bold and modern, or warm and friendly?";
        return "You have everything. Confirm you will send the mockup within 24 hours. Then say: 'Before I let you go — how would you prefer we follow up with you once the mockup is ready? WhatsApp, email, a call back, or SMS works too.' Wait for their answer.";
      }

      case "contact_capture":
        return `Ask for their preferred contact method: "Just so someone from our team can follow up with you directly — do you prefer WhatsApp, email, a call back, or SMS? And what's the best number or email to reach you?"
If they already gave a WhatsApp number earlier, confirm it: "We have your WhatsApp at [number] — is that still the best one for follow-up?"
Once you have their method and detail, say: "Perfect — someone from the J Supreme Tech team will reach out to you at [their detail] to finalize everything. You're in good hands."
If they want to buy immediately: "Wonderful — someone from our team will reach out to finalize the proposal and get you started right away. You won't need to do anything else on your end."`;

      case "pitch": {
        const p = this.prospect;
        if (p.recommended_service === "marketing" && p.has_website) {
          // Inbound marketing inquiry AND they already have a site -- pitch marketing directly
          return `They contacted us about marketing. Lead with the full package: "Our Marketing Starter at J$30,000/mo covers your Instagram, Facebook, reels, paid ads, email campaigns -- and the AI Sales Bot like this call is included. Everything goes live in under a week." THEN ADD APP UPSELL: "Quick question -- do you have a mobile app for [company name]? If not, we also build apps from J$80,000 ONE-TIME (you own it, no monthly fee, live in 3-4 weeks). A lot of our marketing clients bundle the app with marketing so their customers can book or order straight from their phone. Want to hear more about that?" OFFER HOOK (exact words): "Can I put together a FREE 30-day marketing strategy for [company name] — no commitment, just a full content and ads plan for your first month? I'll send it straight to your WhatsApp within 24 hours."`;
        }
        if (p.has_website) {
          // Has website -- pitch upgrade layer, then soft-close with marketing
          return `They have a site already -- DO NOT pitch basic website. Lead: "You have your site -- the businesses pulling ahead right now are adding a Mobile App (from J$80,000 ONE-TIME, you own it, live in 3-4 weeks -- that is JA pricing; US starts at US$1,250) or an AI Chatbot (US$50/mo) that converts site visitors 24/7. The app gives your customers a direct line to you on their phone -- bookings, orders, loyalty, all in one place." Then soft close: "We also have a Marketing Package (JA J$30K/mo | US US$500/mo | UK GBP400/mo) -- IG, Facebook, email, paid ads, AND the AI calling bot all in one. A lot of businesses take the App + Marketing together -- that is a full digital stack. Want me to walk you through what that looks like for [company]?" OFFER HOOK — choose one based on what they responded to: (a) "Can I send you a FREE visual mockup of what an app could look like for [company] — straight to your WhatsApp, no commitment?" OR (b) "Can I put together a FREE 30-day marketing strategy for [company] — full plan of what we'd run in your first month, sent to your WhatsApp within 24 hours?"`;
        }
        // DEFAULT cold call -- no website: lead with website, close with marketing
        return `MARKET-AWARE PRICING (auto-apply based on prospect market field):
- JA + ALL CARIBBEAN ISLANDS (TT, BB, LC, VC, GD, AG, DM, KN, BS, GY, SR): SAME PRICING AS JAMAICA: Website J$50K+ | App J$80K+ | Marketing Starter J$30K/mo | Marketing Plus J$55K/mo | Marketing Elite J$80K/mo. Caribbean clients pay THE SAME as Jamaican clients across ALL services. Quote in J$ or USD equivalent (~US$330 website / ~US$530 app / ~US$200/mo marketing starter) at your discretion.
- US/Canada leads: Website US$650-1,500 | App US$1,250-2,500 | Marketing US$500-2,000/mo
- UK leads: Website GBP550-1,200 | App GBP1,000-2,000 | Marketing GBP400-1,600/mo
- TIME ZONES: JA/TT/BB=EST-1 | US East=EST | US West=PST | UK=GMT
- For callbacks: always offer a time in THEIR local timezone
LEAD WITH WEBSITE + ONE-TIME CLARITY: "Right now if someone searches for [their business/industry] in [city/country], they cannot find you -- that is revenue going straight to your competitors. We build custom websites from J$50,000 (JA) | US$650 (US) | GBP550 (UK) -- and this is a ONE-TIME PAYMENT. You own the site outright. No monthly fee for the build itself. Live in as little as one week." SAAS ALTERNATIVE (pitch if they prefer monthly): "If you prefer to pay monthly with no big upfront, we also have a plan built for [their business type] that includes a branded website plus a full business management system -- starting from J$35/mo. Everything included. You can upgrade to a fully custom build later." APP UPSELL: "Whether you go website or monthly plan, we also build Mobile Apps from J$80,000 ONE-TIME (you own it, live in 3-4 weeks). Build the website and app together right now and get 20% off both -- that is the most popular package." SOFT-CLOSE WITH MARKETING: "And to make sure people are actually finding you -- we have a Marketing Package (JA J$30K/mo | US US$500/mo | UK GBP400/mo): Instagram, Facebook, email, paid ads, AND the AI calling bot like this call -- all live within the week." OFFER HOOK: "Can I send you a FREE visual of what your site could look like -- straight to your WhatsApp within 24 hours, no commitment?"`;
      }

      case "objection_classify": {
        const q = this.objectionType ? OBJECTION_QUALIFIERS[this.objectionType] : "Is it more about the investment, or is the timing not right?";
        return `Acknowledge warmly ("That makes sense, I hear you."). Then ask: "${q}"`;
      }

      case "objection_address": {
        const objResp = this.objectionType ? OBJECTION_RESPONSES[this.objectionType] : null;
        const objScript = objResp
          ? `REFRAME: "${objResp.reframe}" | SOCIAL PROOF: "${objResp.social_proof}" | CLOSE MOVE: "${objResp.close}"`
          : "";
        return `Address concern using loss-aversion + social proof + ROI anchoring (Cialdini principles).
${objScript}

PRICE on website/app: Anchor the ROI first ("one new customer covers a year of service"). Pivot to Marketing Starter (JA J$30K/mo | US US$500/mo) as a lower-entry alternative — includes AI Sales Bot. When they're ready: "We'll send you a payment link — takes just a few minutes at jsupremetech.online."
PRICE on marketing: "Starter is J$30K/mo — IG + Facebook, reels, ads, AI calling bot included. When you're ready, we'll send a payment link over — quick and easy at jsupremetech.online."
TIMING: Use loss framing — "Websites take 30-90 days to rank on Google. Starting now means you're visible when others are still waiting." Lock the calendar spot, start when they're ready.
AUTHORITY (wrong person): Summary in one sentence → try to transfer NOW → get their direct contact → leave JST contact → send one-pager via WhatsApp. NEVER end the call without a path to the decision-maker.
TRUST: "Let me send three live sites we built for [their category] businesses right now — judge for yourself. What's your WhatsApp?"
NO NEED (website): "Are customers finding you on Google right now? Our Marketing Starter (JA J$30K/mo) fixes visibility AND includes the AI calling bot — no website needed."
NO NEED (marketing): "Got it — is growing your customer base a goal right now?" Probe → pivot to AI Chatbot/SaaS if yes → schedule follow-up if no.
UPSELL PATH: website rejected → marketing | marketing rejected → AI Bot standalone (US$50/mo) | all rejected → free mockup/one-pager → follow-up scheduled. NEVER end without next step.`;
      }

      case "hesitation_close":
        return `The prospect is on the fence. Your job here is to remove friction, NOT push harder.
FIRST — ask ONE gentle question: "Is there anything specific holding you back that I can help clear up?"
LISTEN. Then respond with exactly ONE of these paths based on what they say:
- If PRICE (try bundle angle FIRST): "Actually — one thing that might help: we have up to 50% off on bundle packages right now. A website and app together is 20% off, and adding a marketing package means the AI Sales Bot is included free. The more you combine, the better the deal gets. Does bundling a couple of services make more sense for you?" If still price-sensitive: "When you're ready to move, we'll send you a payment link directly — super quick to complete at jsupremetech.online. No pressure today."
- If TIMING: "That makes complete sense — I don't want to pressure you at all. That's completely fine. Can I follow back up with you in a couple of days just to see where you're at? No pitch, no pressure — just a quick check-in."
- If AUTHORITY: "Of course — totally reasonable. Quick summary to pass along: websites from J$50K (JA) / US$650 (US/Canada/Australia) / GBP550 (UK) — one-time payment, you own it. Can I send a one-pager to your WhatsApp to share with them?"
- If TRUST: "That's fair — we'd love to show you some of our work first. Can I send our portfolio to your WhatsApp right now? No obligation."
- If UNDECIDED / GENERAL: "That's completely fine — there's no rush. Would it be okay if I reached back out in a few days just to see where you're at? Sometimes the timing just isn't right and that's totally okay."
NEVER hard close here. Offer callback or one-pager as the exit.`;

      case "close": {
        const p = this.prospect;
        return `BUNDLE CLOSE (if not yet mentioned this call): "Quick note — we have up to 50% off bundle packages right now. If you're thinking about combining services, doing it together now gets you the best deal." Then: "Shall I send you a proposal today?" or "Want to start your free 3-day trial now?"
If they say yes or want to move forward immediately: say "Wonderful — let me grab the best way to reach you so someone from our team can follow up and finalize everything."
If they hesitate, offer the free hook as fallback:
- ${p.has_website ? 'Offer: "At minimum, let me send you a FREE visual of what your app or chatbot could look like — no cost, no obligation."' : 'Offer: "At minimum, let me send you a FREE visual preview of your website via WhatsApp — 24 hours, no obligation."'}`;
      }

      case "schedule":
        return `They said yes and you have their contact. Confirm: "Perfect — someone from J Supreme Tech will be in touch at [their contact detail] within 24 hours to go over everything. Is there anything else you'd like to know before we wrap up?"`;

      case "follow_up":
        return `This stage covers TWO scenarios — read the conversation and pick the right one:

SCENARIO A — They said YES / are booked / gave contact info:
"Perfect — someone from J Supreme Tech will be in touch shortly. You've made a great decision and we're excited to get started. Have a wonderful day!"
Wrap up warm and end.

SCENARIO B — They are UNDECIDED / said 'maybe' / asked for time / said they need to think:
Do NOT push. Say exactly this type of response:
"That's completely fine — there's absolutely no pressure at all. Would it be okay if I reached back out in a few days just to see where you're at? Sometimes the timing just isn't right and that's 100% okay — I just want to make sure you have the information when you need it."
Then: "In the meantime, can I send you a quick summary to your WhatsApp — our portfolio, pricing (JA/Caribbean from J$50K | US from US$650 | UK from GBP550), and a few examples? Then if you ever want to move forward, everything's right there."
Wait. If they say yes to WhatsApp: capture the number and confirm.
If they decline everything: "Not a problem at all — if you ever want to revisit it, just reach out to us at jsupremetech.online or call (658) 218-2282. Have a wonderful day." End warmly.

MARKET-CORRECT PRICING REMINDER (always use the right currency):
- Jamaica / Caribbean: J$ pricing
- US / Canada / Australia: US$ pricing
- UK: GBP pricing`;


      case "end":
        return `Thank them genuinely. Wish them well. End naturally.
BEFORE ending, confirm product direction internally so the follow-up team knows exactly what was discussed. You do NOT say this aloud — it is for the record. The product direction is captured by the system automatically.`;

      default:
        return "Continue the conversation naturally toward a close or a free mockup agreement.";
    }
  }

  private nextStage(userText: string, reply: string): Stage {
    const u = userText.toLowerCase();

    if (this.isEndPhrase(reply)) return "end";
    if (this.turnCount > 24) return "end";

    const maxTurns = STAGE_MAX_TURNS[this.stage];
    if (maxTurns && this.stageTurnCount >= maxTurns) {
      const forceMap: Partial<Record<Stage, Stage>> = {
        greeting:           "qualify",
        qualify:            "mockup_offer",
        mockup_offer:       "pitch",
        pitch:              "close",
        objection_classify: "objection_address",
        objection_address:  "close",
        hesitation_close:   "close",
        close:              "contact_capture",
        contact_capture:    "schedule",
      };
      const forced = forceMap[this.stage];
      if (forced) return forced;
    }

    switch (this.stage) {
      case "greeting":
        if (/wrong number|not looking|not interested|remove/i.test(u)) return "end";
        if (this.prospect.company_name && this.prospect.industry) return "mockup_offer";
        return "qualify";

      case "qualify":
        if (this.turnCount >= 2 && this.isMockupYes(u)) { this.mockup.requested = true; return "mockup_collect"; }
        if (this.turnCount >= 3) return "mockup_offer";
        return "qualify";

      case "mockup_offer":
        if (this.isMockupYes(u)) { this.mockup.requested = true; return "mockup_collect"; }
        return "pitch";

      case "mockup_collect":
        const mc = this.handleMockupCollect(userText);
        if (mc === "schedule") return "contact_capture"; // capture contact before scheduling
        return mc;

      case "contact_capture":
        if (this.contact.captured || this.stageTurnCount >= 3) return "schedule";
        return "contact_capture";

      case "pitch":
        if (this.hasObjection(u)) { this.objectionType = this.classifyObjection(u); return "objection_classify"; }
        if (this.isPositive(u)) return "close";
        if (this.isHesitation(u)) return "hesitation_close";
        return "pitch";

      case "objection_classify":
        return "objection_address";

      case "objection_address":
        return "close";

      case "hesitation_close":
        if (this.isPositive(u)) return "close";
        this.objectionType = this.classifyObjection(u);
        return "objection_classify";

      case "close":
        if (this.isPositive(u)) return "contact_capture";
        if (!this.mockup.requested) return "mockup_offer";
        if (this.isHesitation(u) || this.hasObjection(u)) return "hesitation_close";
        return "follow_up";

      case "schedule":
        return "follow_up";

      case "follow_up":
        return this.stageTurnCount >= 2 ? "end" : "follow_up";

      default:
        return "end";
    }
  }

  private handleMockupCollect(userText: string): Stage {
    if (!this.mockup.wa_number) {
      const numMatch = userText.match(/\+?[\d][\d\s\-\(\)]{6,}\d/);
      if (numMatch) {
        this.mockup.wa_number = numMatch[0].replace(/[\s\-\(\)]/g, "");
        // Also pre-fill contact detail
        if (!this.contact.detail) { this.contact.detail = this.mockup.wa_number; this.contact.method = "whatsapp"; }
      }
      return "mockup_collect";
    }
    if (this.mockup.questions_asked === 0) {
      this.mockup.brand_colors = userText;
      this.mockup.questions_asked = 1;
      return "mockup_collect";
    }
    if (this.mockup.questions_asked === 1) {
      this.mockup.style_pref = userText;
      this.mockup.questions_asked = 2;
      return "mockup_collect";
    }
    return "schedule";
  }

  private classifyObjection(text: string): ObjectionType {
    if (/expensive|cost|price|afford|budget|cheap/.test(text)) return "price";
    if (/busy|time|later|not now|next month|next year/.test(text)) return "timing";
    if (/wife|husband|partner|manager|boss|board/.test(text)) return "authority";
    if (/trust|sure|proof|guarantee|scam|risk/.test(text)) return "trust";
    if (/don.t need|not interested|fine already|good already/.test(text)) return "no_need";
    return "price";
  }

  private isPositive(t: string): boolean {
    return /\b(yes|yeah|yep|sure|ok|okay|alright|sounds good|let.s do|go ahead|send it|perfect|great|absolutely)\b/.test(t);
  }

  private isMockupYes(t: string): boolean {
    return /\b(yes|yeah|yep|sure|ok|okay|alright|send it|go ahead|sounds good|absolutely|please|why not)\b/.test(t)
      && !/\b(already have|have one|don.t need|not interested|no thanks|no thank|nope)\b/.test(t);
  }

  private hasObjection(t: string): boolean {
    return /\b(expensive|costly|budget|timing|busy|partner|husband|wife|manager|trust|already have|don.t need|not sure|maybe)\b/.test(t);
  }

  private isHesitation(t: string): boolean {
    return /\b(maybe|i don.t know|hmm|not sure|let me think|possibly|perhaps|we.ll see)\b/.test(t);
  }

  private isEndPhrase(t: string): boolean {
    return /\b(goodbye|bye|have a great day|take care|not interested at all|remove me|don.t call|stop calling)\b/.test(t.toLowerCase());
  }

  getTranscript(): string {
    return this.history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  }

  getMockupData(): MockupData { return this.mockup; }
  getContactCapture(): ContactCapture { return this.contact; }
  getStage(): Stage { return this.stage; }
  isBooked(): boolean { return ["schedule","follow_up"].includes(this.stage); }
  isDncRequested(): boolean { return this.dncRequested; }
  getProspectData(): ProspectBrief { return this.prospect; }
  getProductDirection(): {
    product: string;
    tier: string | null;
    next_action: string;
    price_discussed: string | null;
  } {
    const t = this.getTranscript().toLowerCase();
    const p = this.prospect;

    // Determine primary product from conversation signals
    let product = "unknown";
    let tier: string | null = null;
    let price_discussed: string | null = null;
    let next_action = "follow_up_call";

    if (t.includes("saas") || t.includes("glowdesk") || t.includes("tableflow") || t.includes("fleetrun") || t.includes("tourbase") || t.includes("enrolliq") || t.includes("dwelldesk") || t.includes("punchpro")) {
      product = "saas_subscription";
      tier = "monthly";
    } else if (t.includes("mobile app") || t.includes("app bundle") || t.includes("j$80") || t.includes("80,000") || t.includes("us$1,250")) {
      product = "mobile_app";
      price_discussed = p.industry?.match(/^(US|UK|GB)/) ? "US$1,250+" : "J$80,000+";
    } else if (t.includes("website") && !t.includes("already have") && !p.has_website) {
      product = "website";
      price_discussed = "J$50,000+";
    } else if (t.includes("marketing") || t.includes("instagram") || t.includes("facebook") || t.includes("social media") || t.includes("ads")) {
      product = "marketing_package";
      if (t.includes("elite")) { tier = "elite"; price_discussed = "J$80,000/mo"; }
      else if (t.includes("plus")) { tier = "plus"; price_discussed = "J$55,000/mo"; }
      else { tier = "starter"; price_discussed = "J$30,000/mo"; }
    } else if (t.includes("ai chatbot") || t.includes("chatbot")) {
      product = "ai_chatbot";
      price_discussed = "US$50/mo";
    } else if (t.includes("ai sales") || t.includes("sales bot") || t.includes("ai agent")) {
      product = "ai_sales_bot";
      price_discussed = "US$50/mo";
    } else if (p.has_website) {
      product = "marketing_or_app_upsell";
    } else {
      product = "website";
      price_discussed = "J$50,000+";
    }

    // Determine next action
    if (this.isBooked() || this.contact.captured) {
      next_action = "send_proposal";
    } else if (this.mockup.requested) {
      next_action = "send_mockup_to_wa";
    } else if (this.dncRequested) {
      next_action = "dnc_remove";
    } else {
      next_action = "follow_up_call";
    }

    return { product, tier, next_action, price_discussed };
  }

  hadMarketingInterest(): boolean {
    const t = this.getTranscript().toLowerCase();
    return t.includes('marketing') || t.includes('social media') || t.includes('instagram') || t.includes('facebook') || t.includes('ads') || t.includes('email campaign') || (this.prospect as any).recommended_service === 'marketing';
  }

  async scoreCall(): Promise<CallScores> {
    return scoreTranscript(this.getTranscript());
  }

  toJSON(): object {
    return {
      stage: this.stage,
      history: this.history,
      prospect: this.prospect,
      mockup: this.mockup,
      contact: this.contact,
      objectionType: this.objectionType,
      turnCount: this.turnCount,
      stageTurnCount: this.stageTurnCount,
      silenceStreak: this.silenceStreak,
      dncRequested: this.dncRequested,
    };
  }

  static fromJSON(data: any): Conversation {
    const conv = new Conversation(data.prospect ?? {});
    conv["stage"] = data.stage ?? "greeting";
    conv["history"] = data.history ?? [];
    conv["mockup"] = data.mockup ?? { requested: false, questions_asked: 0 };
    conv["contact"] = data.contact ?? { captured: false };
    conv["objectionType"] = data.objectionType ?? null;
    conv["turnCount"] = data.turnCount ?? 0;
    conv["stageTurnCount"] = data.stageTurnCount ?? 0;
    conv.silenceStreak = data.silenceStreak ?? 0;
    conv["dncRequested"] = data.dncRequested ?? false;
    return conv;
  }
}












