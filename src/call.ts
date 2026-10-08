import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function initiateCall(to: string): Promise<string> {
  const call = await client.calls.create({
    to,
    from: process.env.TWILIO_FROM_NUMBER!,
    url: `${process.env.PUBLIC_URL}/twiml`,
    statusCallback: `${process.env.PUBLIC_URL}/call-status`,
    statusCallbackMethod: "POST",
    statusCallbackEvent: ["completed", "no-answer", "busy", "failed"],
    machineDetection: "DetectMessageEnd", // voicemail detection
    asyncAmd: "true",
    asyncAmdStatusCallback: `${process.env.PUBLIC_URL}/amd-status`,
  });
  return call.sid;
}

export function buildTwiml(publicUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${new URL(publicUrl).host}/stream" />
  </Connect>
</Response>`;
}

export function buildVoicemailTwiml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">
    Hi, this is Marcus from J Supreme Tech. We help Jamaican businesses with websites, social media, and digital marketing.
    Give us a call back at 876-314-9024 or WhatsApp us. Have a great day!
  </Say>
</Response>`;
}
