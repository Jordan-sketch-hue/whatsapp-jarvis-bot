import "dotenv/config";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY!;
const FROM_NUMBER   = process.env.FROM_NUMBER!;

export interface SmsResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  try {
    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_NUMBER, to, text: body }),
    });
    const data = await res.json() as any;
    if (!res.ok) {
      const err = data?.errors?.[0]?.detail ?? data?.message ?? res.status;
      console.error("[SMS] Send failed:", err);
      return { ok: false, error: String(err) };
    }
    console.log("[SMS] Sent to", to, "| id:", data?.data?.id);
    return { ok: true, id: data?.data?.id };
  } catch (e: any) {
    console.error("[SMS] Exception:", e.message);
    return { ok: false, error: e.message };
  }
}

export function buildSmsMessage(params: {
  stage: string;
  booked: boolean;
  mockupRequested: boolean;
  businessName?: string;
}): string | null {
  const biz = params.businessName ? ` ${params.businessName}` : "";

  if (params.booked) {
    return `Hi${biz}, this is Kai from J Supreme Tech. Great speaking with you! I will be in touch shortly to get you started with your free trial. Reply STOP to opt out.`;
  }

  if (params.mockupRequested) {
    return `Hi${biz}, this is Kai from J Supreme Tech. Your free website mockup is on its way within 24 hours. Any questions? Visit jsupremetech.online. Reply STOP to opt out.`;
  }

  if (["close", "schedule", "objection_address"].includes(params.stage)) {
    return `Hi${biz}, this is Kai from J Supreme Tech. Thanks for the chat - I will follow up with more details. Visit jsupremetech.online to explore our products. Reply STOP to opt out.`;
  }

  if (params.stage === "no_answer") {
    return `Hi, this is Kai from J Supreme Tech. I tried reaching you about a free digital tool for your business. Visit jsupremetech.online or reply here. Reply STOP to opt out.`;
  }

  return null;
}
