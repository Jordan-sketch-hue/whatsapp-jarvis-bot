import { logSms } from "./db";
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
      const failResult = { ok: false, error: String(err) };
      logSms(to, body, failResult).catch(() => {});
      return failResult;
    }
    const result = { ok: true, id: data?.data?.id };
    console.log("[SMS] Sent to", to, "| id:", result.id);
    logSms(to, body, result).catch(() => {});
    return result;
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
    return `Hi${biz}, this is Kai from J Supreme Tech. Great speaking with you! We handle websites, social media management + digital marketing. I will be in touch shortly to get you started. Reply STOP to opt out.`;
  }

  if (params.mockupRequested) {
    return `Hi${biz}, this is Kai from J Supreme Tech. Your free website mockup is on its way within 24 hours. We also do social media management + digital marketing. Visit jsupremetech.online. Reply STOP to opt out.`;
  }

  if (["close", "schedule", "objection_address"].includes(params.stage)) {
    return `Hi${biz}, this is Kai from J Supreme Tech. Thanks for the chat - we build websites, manage social media + run digital marketing for businesses like yours. Visit jsupremetech.online. Reply STOP to opt out.`;
  }

  if (params.stage === "no_answer") {
    return `Hi, this is Kai from J Supreme Tech. I tried reaching you about websites, social media management + digital marketing for your business. Visit jsupremetech.online or reply here. Reply STOP to opt out.`;
  }

  return null;
}

