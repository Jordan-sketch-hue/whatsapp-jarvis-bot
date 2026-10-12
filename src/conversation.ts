import "dotenv/config";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

type ConvState = "greeting" | "qualify" | "pitch" | "objection" | "close" | "schedule" | "end";

const PRODUCTS = [
  { name: "GlowDesk",    price: 35,  targets: ["nail", "salon", "beauty", "hair", "barber", "spa", "lash", "brow"] },
  { name: "SlotIQ",      price: 39,  targets: ["clinic", "therapy", "gym", "physio", "dentist", "doctor", "multi-staff", "appointment"] },
  { name: "DeskBot",     price: 39,  targets: ["chatbot", "website", "online", "digital", "24/7", "chat", "leads"] },
  { name: "PunchPro",    price: 29,  targets: ["carwash", "laundry", "café", "cafe", "coffee", "repeat", "loyalty"] },
  { name: "SignalBoard", price: 45,  targets: ["analytics", "marketing", "ads", "performance", "multi-channel"] },
  { name: "FleetRun",    price: 49,  targets: ["courier", "delivery", "dispatch", "logistics", "freight", "driver"] },
  { name: "TourBase",    price: 49,  targets: ["tour", "tourism", "experience", "excursion", "travel", "guide"] },
  { name: "EnrollIQ",    price: 59,  targets: ["school", "tutoring", "academy", "class", "education", "training", "course"] },
  { name: "RingPilot",   price: 59,  targets: ["calls", "phone", "inbound", "reception", "answering"] },
  { name: "HaulBase",    price: 59,  targets: ["moving", "hauling", "storage", "relocation", "truck"] },
  { name: "TableFlow",   price: 69,  targets: ["restaurant", "bar", "dining", "food", "reservation", "venue", "event"] },
  { name: "StockOps",    price: 79,  targets: ["wholesale", "distributor", "inventory", "stock", "retail", "warehouse"] },
  { name: "DwellDesk",   price: 89,  targets: ["property", "landlord", "tenant", "rental", "real estate", "apartment"] },
];

function matchProduct(businessType: string): typeof PRODUCTS[0] | null {
  const lower = businessType.toLowerCase();
  for (const p of PRODUCTS) {
    if (p.targets.some(t => lower.includes(t))) return p;
  }
  return null;
}

const SYSTEM_BASE = `You are Marcus, a sales rep at J Supreme Tech — a Caribbean tech company that builds white-label business software called Supreme Suite.
You are on a phone call. Keep every response to 1-3 sentences maximum — this is a voice call, not an email.
Never read out prices unless asked. Always be warm, professional, and direct.
Your goal: book a FREE 3-day trial (no card needed) or a 15-minute demo call.
Supreme Suite gives businesses: a full CRM, a branded website, and an AI receptionist — all white-labeled to their brand. Launch in minutes.
Free trial URL: jsupremetech.online/products
Phone: (658) 218-2282`;

const STATE_INSTRUCTIONS: Record<ConvState, string> = {
  greeting:  "Introduce yourself briefly. Ask what type of business they run.",
  qualify:   "Learn about their business. Ask if they have a website or booking system. Listen for pain points.",
  pitch:     "Match their business to one Supreme Suite product. Explain ONE key benefit. Mention 3-day free trial, no card needed.",
  objection: "Handle their concern honestly and briefly. For price: mention free trial and ROI. For time: mention 'launch in minutes'.",
  close:     "Ask for a clear yes to the free trial or a 15-min demo. Make it easy — just need their email or WhatsApp.",
  schedule:  "Confirm the next step. If trial: give URL jsupremetech.online/products. If demo: confirm time.",
  end:       "Wrap up warmly. Thank them for their time.",
};

export interface Lead {
  phone: string;
  name?: string;
  business?: string;
}

export class Conversation {
  private state: ConvState = "greeting";
  private history: { role: "user" | "assistant"; content: string }[] = [];
  private businessType = "";
  private matchedProduct: typeof PRODUCTS[0] | null = null;
  ended = false;

  constructor(lead?: Lead) {
    if (lead?.business) {
      this.businessType = lead.business;
      this.matchedProduct = matchProduct(lead.business);
    }
  }

  getGreeting(): string {
    return "Hi there, this is Marcus calling from J Supreme Tech. How are you doing today?";
  }

  async respond(userText: string): Promise<string> {
    if (this.state === "qualify" && !this.matchedProduct) {
      this.businessType += " " + userText;
      this.matchedProduct = matchProduct(this.businessType);
    }

    this.history.push({ role: "user", content: userText });

    let systemPrompt = SYSTEM_BASE + "\n\nCurrent conversation stage: " + STATE_INSTRUCTIONS[this.state];
    if (this.matchedProduct) {
      systemPrompt += `\n\nBest-fit product for this prospect: ${this.matchedProduct.name} (from US$${this.matchedProduct.price}/mo).`;
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...this.history,
      ],
      max_tokens: 120,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "Could you repeat that?";
    this.history.push({ role: "assistant", content: reply });

    this.state = this.nextState(userText, reply);
    this.ended = this.state === "end" || this.isEndPhrase(reply);
    return reply;
  }

  private nextState(userText: string, _reply: string): ConvState {
    const user = userText.toLowerCase();
    switch (this.state) {
      case "greeting":  return "qualify";
      case "qualify":   return this.matchedProduct ? "pitch" : "qualify";
      case "pitch":     return (user.includes("no") || user.includes("not") || user.includes("but")) ? "objection" : "close";
      case "objection": return "close";
      case "close":     return (user.includes("yes") || user.includes("sure") || user.includes("ok")) ? "schedule" : "end";
      case "schedule":  return "end";
      default:          return "end";
    }
  }

  private isEndPhrase(text: string): boolean {
    const endings = ["have a great day", "goodbye", "take care", "bye", "thank you for your time"];
    return endings.some(e => text.toLowerCase().includes(e));
  }

  getTranscript(): string {
    return this.history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  }

  isBooked(): boolean {
    return this.state === "schedule" || this.state === "end";
  }
}
