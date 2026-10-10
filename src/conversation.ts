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
J SUPREME TECH — FULL SERVICE CATALOG

CUSTOM BUILDS (one-time):
- Starter Website: J$25,000-J$35,000 (5-page, mobile-ready, 2 weeks)
- Launch Site: J$55,000 (full business site, SEO, CMS, 3 weeks)
- E-Commerce Store: J$85,000-J$120,000 (WiPay/Stripe, inventory, 4-5 weeks)
- Mobile App: from US$1,500 (iOS + Android, 6-8 weeks)
- AI/Automation System: from US$800 (chatbots, workflows, integrations)
- Custom CRM: from US$1,200 (leads, pipeline, reporting)

SUPREME SUITE — SAAS (monthly, free 3-day trial, no card required):
- GlowDesk US$35/mo: bookings + loyalty for salons, nail shops, beauty
- PunchPro US$29/mo: punch-card loyalty for cafes, car washes, laundry
- FleetRun US$49/mo: dispatch + tracking for couriers, logistics
- TourBase US$49/mo: tour scheduling + payments for tourism operators
- EnrollIQ US$59/mo: enrolment + attendance for schools, tutoring
- TableFlow US$69/mo: reservations + orders for restaurants, bars
- DwellDesk US$89/mo: tenant management for property owners, landlords

ADD-ONS:
- Social Media Management: J$15,000/mo (3 platforms, 12 posts/mo)
- SEO Package: J$18,000/mo (monthly reports, keyword targeting)
- WhatsApp Business Bot: J$25,000 setup + J$5,000/mo

PAYMENTS ACCEPTED:
- WiPay (JMD, local): 3.5% + J$130/txn — zero monthly fee, all major JA banks
- Stripe (USD): 2.9% + US$0.30/txn — for SaaS subscriptions and international clients
- AmberPay (BNPL): split larger invoices into 3 payments — great for J$55K+ projects
- Wire/bank transfer available for projects over US$500

CONTACT:
- Website: jsupremetech.online
- Products: jsupremetech.online/products
- Phone: (658) 218-2282
- Hours: Mon-Sat 9 AM-6 PM Jamaica time
`;

const OBJECTION_QUALIFIERS: Record<NonNullable<ObjectionType>, string> = {
  price:     "Is it more about the upfront investment, or is cash flow the thing right now?",
  timing:    "Understood — is timing the main thing, or is there something else you'd want to figure out first?",
  authority: "Of course — is that a partner, or more of a financial decision you'd need to run by someone?",
  trust:     "That's fair — would it help to see some examples of work we've done for businesses like yours?",
  no_need:   "I hear you — is it more that it's not a priority right now, or is the type of service not the right fit?",
};

// ─── Intent → stage map ───────────────────────────────────────────────────────
type IntentKey = "pricing" | "booking" | "objection" | "pitch_request" | "end_call" | "mockup_request";

const INTENT_STAGE_OVERRIDE: Record<IntentKey, Stage> = {
  pricing:       "pitch",
  booking:       "close",
  objection:     "objection_classify",
  pitch_request: "pitch",
  end_call:      "end",
  mockup_request:"mockup_offer",
};

// Stages where intent override does NOT fire (already past or irrelevant)
const OVERRIDE_BLOCKED: Partial<Record<Stage, IntentKey[]>> = {
  mockup_collect: ["mockup_request"],
  schedule:       ["booking","pricing","pitch_request"],
  follow_up:      ["booking","pricing","pitch_request"],
  end:            ["pricing","booking","objection","pitch_request","mockup_request"],
};

// Max turns to stay in each stage before forcing advance
const STAGE_MAX_TURNS: Partial<Record<Stage, number>> = {
  greeting:           2,
  qualify:            5,
  mockup_offer:       2,
  mockup_collect:     6,
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

// True if input is too short / garbled to act on meaningfully
function isFragment(text: string): boolean {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1 && !/\b(yes|yeah|yep|no|nope|ok|okay|sure|bye|good|great|fine|well|hello|hi|hey|alright|thanks|interesting|really|exactly|right|true|agreed|definitely|absolutely|perfect|nice|cool|wow)\b/i.test(trimmed)) return true;
  if (/[-—]{1,2}\s*$/.test(trimmed) || trimmed.length < 3) return true;
  return false;
}

// True if prospect is trying to interject
function isInterruption(text: string): boolean {
  return /^\s*(wait|hold on|hold up|one second|one sec|stop|excuse me|sorry|hang on|actually)\b/i.test(text.trim());
}

// DNC-level end phrases — prospect wants to be removed
function isDncPhrase(text: string): boolean {
  return /\b(remove me|stop calling|take me off|don.t call|do not call|never call)\b/i.test(text);
}

async function claudeChat(
  system: string,
  history: { role: string; content: string }[]
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  // Keep last 10 messages to prevent token budget blowout on long calls
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
- usefulness: Did Aria deliver real value beyond just pitching?
- resourcefulness: Did Aria handle unexpected questions well?
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
  private objectionType: ObjectionType = null;
  private turnCount = 0;
  private stageTurnCount = 0;      // turns spent in current stage
  private dncRequested = false;    // set true when prospect says "stop calling" etc.

  constructor(prospect?: ProspectBrief) {
    this.prospect = prospect ?? {};
  }

  getGreeting(): string {
    const p = this.prospect;

    // Warm lead — we already know who they are and what they need
    if (p.company_name && p.industry) {
      const product = p.recommended_service ?? "a digital solution";
      return `Hi, is this ${p.company_name}? Great — quick question, is now a good time to talk? … Perfect. This is Aria calling from J Supreme Tech. I was reaching out to ${p.industry} businesses in Jamaica — I think we have something that could really help ${p.company_name}. Do you have about two minutes?`;
    }

    // Cold call — no intel
    return `Hi there, this is Aria calling from J Supreme Tech. Just so you know, this call may be recorded. How are you doing today?`;
  }

  async respond(userText: string): Promise<{ text: string; ended: boolean }> {
    // ── Fragment / garbled input ──────────────────────────────────────────────
    if (isFragment(userText)) {
      return { text: "Sorry, I didn't quite catch that — could you say that again?", ended: false };
    }

    // ── Interruption ("wait", "hold on", etc.) ────────────────────────────────
    if (isInterruption(userText)) {
      return { text: "Of course — go right ahead, I'm listening.", ended: false };
    }

    // ── Intent-based stage override ───────────────────────────────────────────
    const intent = detectIntent(userText);
    if (intent) {
      const blocked = OVERRIDE_BLOCKED[this.stage] ?? [];
      if (!blocked.includes(intent)) {
        const targetStage = INTENT_STAGE_OVERRIDE[intent];
        const alwaysOverride: IntentKey[] = ["end_call", "objection"];
        const stages: Stage[] = ["greeting","qualify","mockup_offer","mockup_collect","pitch","objection_classify","objection_address","hesitation_close","close","schedule","follow_up","end"];
        const currentIdx = stages.indexOf(this.stage);
        const targetIdx  = stages.indexOf(targetStage);
        if (alwaysOverride.includes(intent) || targetIdx > currentIdx) {
          if (intent === "objection") this.objectionType = this.classifyObjection(userText.toLowerCase());
          this.stage = targetStage;
          this.stageTurnCount = 0;
        }
      }
    }

    // ── End-phrase short-circuit (before burning an LLM call) ────────────────
    if (this.isEndPhrase(userText)) {
      this.stage = "end";
      if (isDncPhrase(userText)) this.dncRequested = true;
      return { text: "Understood — no problem at all. Have a wonderful day!", ended: true };
    }

    this.turnCount++;
    this.stageTurnCount++;
    this.history.push({ role: "user", content: userText });

    const system = this.buildSystem();
    let reply: string;
    try {
      reply = await claudeChat(system, this.history);
    } catch (e: any) {
      // LLM timeout or error — give a graceful bridge response
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

  private buildSystem(): string {
    const identity = `You are Aria, Senior Sales Account Executive at J Supreme Tech — a tech company serving Jamaica and the Caribbean.
You are warm, confident, knowledgeable, and persuasive. Professional Caribbean tone — not stiff, not slang.
PHONE CALL RULES — READ CAREFULLY:
- Every reply must be a COMPLETE thought. Never end mid-sentence or mid-idea.
- End every turn with either a question OR a statement that clearly signals you are done speaking (rising or resolved tone). The prospect must always know when it is their turn.
- Keep it to 2-3 SHORT sentences max. Concise, not clipped.
- Never list options with dashes or numbers on a phone call — weave them into natural speech.
- Never sound scripted. Speak the way a sharp, warm Caribbean professional would.
- Never trail off with "..." or leave a thought hanging — every reply lands with intention.
- Be resourceful — if asked anything outside scope, give a useful answer and bridge back to JST services.
- If a prospect mentions Wix, Shopify, or another platform: acknowledge it, then highlight what JST does differently (custom-built for Caribbean payments, local support, no template limitations).`;

    const brief = this.buildProspectBrief();
    const stageInstruction = this.buildStageInstruction();

    return `${identity}\n\n${JST_CATALOG}\n\n${brief}\n\nCURRENT STAGE: ${stageInstruction}`;
  }

  private buildProspectBrief(): string {
    const p = this.prospect;
    if (!p.company_name && !p.industry) return "";
    return `PROSPECT INTEL (pre-call research):
Company: ${p.company_name ?? "Unknown"}
Industry: ${p.industry ?? "Unknown"}
Has website: ${p.has_website ? "Yes" : "No"}
Has social: ${p.has_social ? "Yes" : "No"}
Gap identified: ${p.gap_analysis ?? "General digital presence"}
Recommended service: ${p.recommended_service ?? "Starter Website"}
Notes: ${p.notes ?? ""}`;
  }

  private buildStageInstruction(): string {
    switch (this.stage) {
      case "greeting":
        return "Greet warmly. Ask what type of business they run. One question only.";

      case "qualify": {
        const p = this.prospect;

        // WARM LEAD — we already have their data, skip questioning, go straight to offer
        if (p.company_name && p.industry) {
          const svc = p.recommended_service ?? "";
          const isSaas = /GlowDesk|PunchPro|FleetRun|TourBase|EnrollIQ|TableFlow|DwellDesk/i.test(svc);
          const isMarketing = /social|marketing|seo/i.test(svc);

          if (isSaas) {
            return `You already know they are a ${p.industry} business without a digital system. Do NOT re-ask what type of business they are. Go straight to: "We built ${svc} specifically for businesses like yours — free 3-day trial, no card required. Want me to send you the link right now?"`;
          }
          if (isMarketing) {
            return `You already know they need marketing help. Do NOT ask qualifying questions. Go straight to: "I can put together a FREE 30-day social media strategy plan for ${p.company_name} — what is working for ${p.industry} businesses in Jamaica right now. Can I send that to your WhatsApp?"`;
          }
          // Default warm lead = website/custom
          return `You already know ${p.company_name} (${p.industry}) does not have a website. Do NOT ask if they have one. Go straight to: "I can send you a FREE visual preview of what ${p.company_name}'s website could look like — straight to your WhatsApp within 24 hours, completely free. Would that be helpful?"`;
        }

        // COLD CALL — qualify first, then offer
        return `Find their pain point in 1-2 exchanges. Ask about their website, booking system, how customers find them.

After getting context, make the FREE offer that matches their situation:

PATH A — No website / needs custom build / app:
"Before I go further — can I send you a FREE visual preview of what your website could look like? Straight to your WhatsApp within 24 hours, no obligation."

PATH B — Salon / cafe / restaurant / courier / school / tour op / landlord:
"We built software specifically for [their type] — free 3-day trial, no card required. Want to test it this week?"

PATH C — Mentions marketing / social media / getting more customers:
"I can put together a FREE 30-day social media strategy plan for your business — what is working in Jamaica right now. Can I send that over to your WhatsApp?"

Pick ONE path. Ask only ONE offer question.`;
      }

      case "mockup_offer":
        return `You just offered the free hook (mockup / SaaS trial / strategy plan). Wait for their response.
If YES to mockup: great, ask for their WhatsApp number.
If YES to SaaS trial: send them to jsupremetech.online/products and confirm their WhatsApp for follow-up.
If YES to strategy plan: ask for their WhatsApp number to send the plan.
If NO to everything: move on to pitching their matched service directly.`;

      case "mockup_collect": {
        if (!this.mockup.wa_number) return "Ask for their WhatsApp number to send the mockup to.";
        if (this.mockup.questions_asked === 0) return "Ask: what are your brand colors or color preferences?";
        if (this.mockup.questions_asked === 1) return "Ask: what style — clean and professional, bold and modern, or warm and friendly?";
        return "You have everything. Confirm you will send the mockup within 24 hours. Wrap up warmly.";
      }

      case "pitch":
        return `Match their situation to the best JST service by name and price. For SaaS: mention free 3-day trial, no card. For custom: mention fast delivery. End with a soft question.`;

      case "objection_classify": {
        const q = this.objectionType ? OBJECTION_QUALIFIERS[this.objectionType] : "Is it more about the investment, or is the timing not right?";
        return `First acknowledge warmly ("That makes sense, I hear you."). Then ask: "${q}"`;
      }

      case "objection_address":
        return `Address their specific concern concisely with evidence or a reframe. Then move toward the close.
- Price: "Our free 3-day trial means zero risk — you only pay if it works."
- Timing: "We can start whenever you're ready — most clients are live in 2 weeks."
- Authority: "No problem — I can send a summary you can share with them."
- Trust: "I can send you examples of similar work via WhatsApp right after this call."
- No need: "What if there was a way to get more customers without changing much?"`;

      case "hesitation_close":
        return `Ask gently: "What's stopping you from moving forward?" — not pressuring, genuinely curious. Listen and respond to whatever they say.`;

      case "close":
        return `Ask for the commitment: "Shall I send you a proposal today?" or "Want to start your free 3-day trial now?"
If they hesitate, use the best-fit free offer as a fallback:
- Website prospect: "At minimum, can I send you a FREE visual preview via WhatsApp so you can see what it could look like? No cost, no obligation."
- SaaS prospect: "At minimum, want me to send you the free trial link? Three days, no card, cancel anytime."
- Marketing prospect: "At minimum, can I send you a FREE 30-day strategy plan for your social media? Takes two minutes to set up and you keep it regardless."
Always end with one of these — never leave the call without a YES to something.`;

      case "schedule":
        return `They said yes. Confirm next step:
- Trial: "Perfect — go to jsupremetech.online/products to start. I'll follow up in 3 days."
- Proposal: "I'll have it over by end of day — best email or WhatsApp for that?"
- Mockup: "Sending it within 24 hours. I'll call back once you've had a look."`;

      case "follow_up":
        return "Confirm all details and wrap up warmly. Leave them feeling great about the call.";

      case "end":
        return "Thank them genuinely. Wish them well. End naturally.";

      default:
        return "Continue the conversation naturally toward a close or a free mockup agreement.";
    }
  }

  private nextStage(userText: string, reply: string): Stage {
    const u = userText.toLowerCase();

    if (this.isEndPhrase(reply)) return "end";
    if (this.turnCount > 22) return "end";

    // Stage stuck guard — force advance if we've been in this stage too long
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
        close:              "follow_up",
      };
      const forced = forceMap[this.stage];
      if (forced) return forced;
    }

    switch (this.stage) {
      case "greeting":
        if (/wrong number|not looking|not interested|remove/i.test(u)) return "end";
        // Warm lead: skip qualify loop, go straight to offer
        if (this.prospect.company_name && this.prospect.industry) return "mockup_offer";
        return "qualify";

      case "qualify":
        if (this.turnCount >= 2 && this.isMockupYes(u)) { this.mockup.requested = true; return "mockup_collect"; }
        if (this.turnCount >= 3) return "mockup_offer";
        return "qualify";

      case "mockup_offer":
        if (this.isMockupYes(u)) {
          this.mockup.requested = true;
          return "mockup_collect";
        }
        return "pitch";

      case "mockup_collect":
        return this.handleMockupCollect(userText);

      case "pitch":
        if (this.hasObjection(u)) {
          this.objectionType = this.classifyObjection(u);
          return "objection_classify";
        }
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
        if (this.isPositive(u)) return "schedule";
        if (!this.mockup.requested) return "mockup_offer";
        if (this.isHesitation(u) || this.hasObjection(u)) return "hesitation_close";
        return "follow_up";

      case "schedule":
        return "follow_up";

      case "follow_up":
        return "end";

      default:
        return "end";
    }
  }

  private handleMockupCollect(userText: string): Stage {
    if (!this.mockup.wa_number) {
      const numMatch = userText.match(/\+?[\d][\d\s\-\(\)]{6,}\d/);
      if (numMatch) this.mockup.wa_number = numMatch[0].replace(/[\s\-\(\)]/g, "");
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
  getStage(): Stage { return this.stage; }
  isBooked(): boolean { return ["schedule","follow_up"].includes(this.stage); }
  isDncRequested(): boolean { return this.dncRequested; }

  async scoreCall(): Promise<CallScores> {
    return scoreTranscript(this.getTranscript());
  }
}
