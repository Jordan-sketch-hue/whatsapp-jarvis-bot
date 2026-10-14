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
}

const JST_CATALOG = `
J SUPREME TECH â€” FULL SERVICE CATALOG

WEBSITES & APPS (one-time payment â€” you own the build):
- Website: from J$50,000 â€” custom-built, mobile-ready, delivered in as little as 1 week
- Mobile App: from J$80,000 â€” iOS ready in ~3 weeks; Google Play Store 1-2 months
- Website + App Bundle: 20% OFF when you build BOTH together â€” biggest saving
- IMPORTANT: One-time payment = you own the build. Does NOT include ongoing hosting, database access, or support. Choose the monthly option below for that.

MONTHLY SAAS â€” PAY MONTHLY, GET EVERYTHING (immediate setup, no contract):
- GlowDesk US$35/mo: bookings + loyalty for salons, nail shops, beauty
- PunchPro US$29/mo: punch-card loyalty for cafes, car washes, laundry
- FleetRun US$49/mo: dispatch + tracking for couriers, logistics
- TourBase US$49/mo: tour scheduling + payments for tourism operators
- EnrollIQ US$59/mo: enrolment + attendance for schools, tutoring
- TableFlow US$69/mo: reservations + orders for restaurants, bars
- DwellDesk US$89/mo: tenant management for property owners, landlords
- Monthly SaaS INCLUDES: immediate setup, hosting, support, and all future updates. Cancel anytime.

AI ADD-ONS (separate monthly services â€” white-labelled with your brand at setup):
- AI Chatbot: US$50/mo â€” lives on your website, answers customer questions 24/7, handles bookings automatically
- AI Sales Agent: US$50/mo â€” outbound AI that calls leads and books appointments for you (exactly like this call)
- Both are SEPARATE services. You can add one or both to any website.

MARKETING & GROWTH (monthly):
- Marketing Package: from J$30,000/mo â€” social media management, content, SEO, ad strategy.

PAYMENTS ACCEPTED:
- WiPay (JMD, local): 3.5% + J$130/txn â€” zero monthly fee, all major JA banks
- Stripe (USD): 2.9% + US$0.30/txn â€” for SaaS and international clients
- AmberPay (BNPL): split larger invoices into 3 payments â€” great for J$50K+ projects

CONTACT:
- Website: jsupremetech.online
- Phone: (658) 218-2282
- Hours: Mon-Sat 9 AM-6 PM Jamaica time
`;

const OBJECTION_QUALIFIERS: Record<NonNullable<ObjectionType>, string> = {
  price:     "Is it more about the upfront investment, or is cash flow the thing right now?",
  timing:    "Understood â€” is timing the main thing, or is there something else you'd want to figure out first?",
  authority: "Of course â€” is that a partner, or more of a financial decision you'd need to run by someone?",
  trust:     "That's fair â€” would it help to see some examples of work we've done for businesses like yours?",
  no_need:   "I hear you â€” is it more that it's not a priority right now, or is the type of service not the right fit?",
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
  if (words.length <= 1 && !/\b(yes|yeah|yep|no|nope|ok|okay|sure|bye|good|great|fine|well|hello|hi|hey|alright|thanks|interesting|really|exactly|right|true|agreed|definitely|absolutely|perfect|nice|cool|wow)\b/i.test(trimmed)) return true;
  if (/[-â€”]{1,2}\s*$/.test(trimmed) || trimmed.length < 3) return true;
  return false;
}

function isInterruption(text: string): boolean {
  return /^\s*(wait|hold on|hold up|one second|one sec|stop|excuse me|sorry|hang on|actually)\b/i.test(text.trim());
}

function isDncPhrase(text: string): boolean {
  return /\b(remove me|stop calling|take me off|don.t call|do not call|never call)\b/i.test(text);
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
- usefulness: Did Alex deliver real value beyond just pitching?
- resourcefulness: Did Alex handle unexpected questions well?
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
      return `Hi, is this ${p.company_name}? Great â€” quick question, is now a good time to talk? Perfect. This is Alex calling from J Supreme Tech. I was reaching out to ${p.industry} businesses in Jamaica â€” I think we have something that could really help ${p.company_name}. Do you have about two minutes?`;
    }

    return `Hi there, this is Alex calling from J Supreme Tech. Just so you know, this call may be recorded. How are you doing today?`;
  }

  async respond(userText: string): Promise<{ text: string; ended: boolean }> {
    if (isFragment(userText)) {
      return { text: "Sorry, I didn't quite catch that â€” could you say that again?", ended: false };
    }

    if (isInterruption(userText)) {
      return { text: "Of course â€” go right ahead, I'm listening.", ended: false };
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
      if (isDncPhrase(userText)) this.dncRequested = true;
      return { text: "Understood â€” no problem at all. Have a wonderful day!", ended: true };
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
        reply = "Give me just one moment â€” could you say that again so I catch it properly?";
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
    const identity = `You are Alex, Senior Sales Account Executive at J Supreme Tech â€” a tech company serving Jamaica and the Caribbean.
You are warm, confident, knowledgeable, and persuasive. Professional Caribbean tone â€” not stiff, not slang.
PHONE CALL RULES:
- Every reply must be a COMPLETE thought. Never end mid-sentence.
- End every turn with a question OR a clear resolved statement.
- Keep it to 2-3 SHORT sentences max.
- Never list options with dashes or numbers â€” weave into natural speech.
- Never sound scripted. Speak like a sharp, warm Caribbean professional.
- Never trail off with "..." â€” every reply lands with intention.`;

    const brief = this.buildProspectBrief();
    const stageInstruction = this.buildStageInstruction();

    return `${identity}\n\n${JST_CATALOG}\n\n${brief}\n\nCURRENT STAGE: ${stageInstruction}`;
  }

  private buildProspectBrief(): string {
    const p = this.prospect;
    if (!p.company_name && !p.industry) return "";

    let gap = p.gap_analysis;
    if (!gap) {
      if (p.has_website) {
        gap = "Has a website â€” pitch upgrade: App (J$80K), AI Chatbot add-on (US$50/mo), AI Sales Agent (US$50/mo), or Marketing package (from J$30K/mo). They are leaving money on the table by not converting visitors or reaching new leads automatically.";
      } else {
        gap = "No website â€” pitch: Website from J$50K (delivered in 1 week), or Website + App bundle at 20% off. They are completely invisible online and losing customers to competitors who are.";
      }
    }

    return `PROSPECT INTEL (pre-call research):
Company: ${p.company_name ?? "Unknown"}
Industry: ${p.industry ?? "Unknown"}
Has website: ${p.has_website ? "YES" : "NO â€” not online at all"}
Gap identified: ${gap}
Recommended service: ${p.recommended_service ?? (p.has_website ? "App or AI Chatbot add-on" : "Website from J$50K")}
Notes: ${p.notes ?? ""}`;
  }

  private buildStageInstruction(): string {
    switch (this.stage) {
      case "greeting":
        return "Greet warmly. Ask what type of business they run. One question only.";

      case "qualify": {
        const p = this.prospect;

        if (p.company_name && p.industry && p.has_website) {
          return `${p.company_name} already has a website. DO NOT pitch a basic website. Lead with upgrade angle: "You've already got a site â€” the businesses pulling ahead right now are adding an app and an AI chatbot to convert more visitors and reach leads automatically. Can I show you a FREE visual mockup of what that could look like for ${p.company_name}?"`;
        }

        if (p.company_name && p.industry && p.has_website === false) {
          return `${p.company_name} has NO website â€” completely invisible online. Lead hard: "Right now, customers searching for ${p.industry} businesses in Jamaica can't find ${p.company_name} â€” that's revenue going straight to competitors. We can have your website live in as little as one week from J$50,000. And if you add an app at the same time, you get 20% off both. Can I send you a FREE visual preview of what ${p.company_name}'s site could look like â€” straight to your WhatsApp within 24 hours?"`;
        }

        if (p.company_name && p.industry) {
          return `You know ${p.company_name} is a ${p.industry} business. Ask one qualifying question: do they have a website? Then pitch accordingly.`;
        }

        return `Find their pain point in 1-2 exchanges. Ask about their website and how customers find them. Then make one free offer (mockup for website/app, or free trial for SaaS, or free 30-day marketing strategy).`;
      }

      case "mockup_offer":
        return `You just offered the free hook. Wait for their response. If YES to mockup: ask for their WhatsApp number. If YES to SaaS trial: send them to jsupremetech.online/products. If NO: pitch directly.`;

      case "mockup_collect": {
        if (!this.mockup.wa_number) return "Ask for their WhatsApp number to send the mockup to.";
        if (this.mockup.questions_asked === 0) return "Ask: what are your brand colors or color preferences?";
        if (this.mockup.questions_asked === 1) return "Ask: what style â€” clean and professional, bold and modern, or warm and friendly?";
        return "You have everything. Confirm you will send the mockup within 24 hours. Then say: 'Before I let you go â€” how would you prefer we follow up with you once the mockup is ready? WhatsApp, email, a call back, or SMS works too.' Wait for their answer.";
      }

      case "contact_capture":
        return `Ask for their preferred contact method: "Just so someone from our team can follow up with you directly â€” do you prefer WhatsApp, email, a call back, or SMS? And what's the best number or email to reach you?"
If they already gave a WhatsApp number earlier, confirm it: "We have your WhatsApp at [number] â€” is that still the best one for follow-up?"
Once you have their method and detail, say: "Perfect â€” someone from the J Supreme Tech team will reach out to you at [their detail] to finalize everything. You're in good hands."
If they want to buy immediately: "Wonderful â€” someone from our team will reach out to finalize the proposal and get you started right away. You won't need to do anything else on your end."`;

      case "pitch": {
        const p = this.prospect;
        if (p.has_website) {
          return `They have a website. Pitch upgrade: App from J$80K, AI Chatbot at US$50/mo, AI Sales Agent US$50/mo. If they need more customers, mention Marketing from J$30K/mo. End with a soft question.`;
        }
        return `No website. Pitch: Website from J$50K in as little as 1 week. 20% off doing both website + app together. End with soft question.`;
      }

      case "objection_classify": {
        const q = this.objectionType ? OBJECTION_QUALIFIERS[this.objectionType] : "Is it more about the investment, or is the timing not right?";
        return `Acknowledge warmly ("That makes sense, I hear you."). Then ask: "${q}"`;
      }

      case "objection_address":
        return `Address their concern concisely. Then move toward the close.
- Price: "Our free 3-day trial on the SaaS means zero risk. AmberPay also lets you split a J$50K+ project into 3 payments."
- Timing: "We start whenever you're ready â€” websites go live in as little as a week."
- Authority: "No problem â€” I can send a summary you can share with them."
- Trust: "I can send you examples of similar work via WhatsApp right after this call."
- No need: "What if there was a way to get more customers without changing much about how you operate?"`;

      case "hesitation_close":
        return `Ask gently: "What's stopping you from moving forward?" Listen and respond.`;

      case "close": {
        const p = this.prospect;
        return `Ask for the commitment: "Shall I send you a proposal today?" or "Want to start your free 3-day trial now?"
If they say yes or want to move forward immediately: say "Wonderful â€” let me grab the best way to reach you so someone from our team can follow up and finalize everything."
If they hesitate, offer the free hook as fallback:
- ${p.has_website ? 'Offer: "At minimum, let me send you a FREE visual of what your app or chatbot could look like â€” no cost, no obligation."' : 'Offer: "At minimum, let me send you a FREE visual preview of your website via WhatsApp â€” 24 hours, no obligation."'}`;
      }

      case "schedule":
        return `They said yes and you have their contact. Confirm: "Perfect â€” someone from J Supreme Tech will be in touch at [their contact detail] within 24 hours to go over everything. Is there anything else you'd like to know before we wrap up?"`;

      case "follow_up":
        return "Wrap up warmly. Thank them for their time. Let them know the team will be in touch soon. End naturally.";

      case "end":
        return "Thank them genuinely. Wish them well. End naturally.";

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
