import "dotenv/config";

export async function initiateCall(to: string): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  const base = process.env.PUBLIC_URL!;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
    {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Url: `${base}/twiml`,
        StatusCallback: `${base}/call-status`,
        StatusCallbackMethod: "POST",
      }).toString(),
    }
  );

  const data = await res.json() as any;
  if (!res.ok) throw new Error(`[${data.code ?? res.status}] ${data.message ?? "Twilio error"}`);
  console.log("[CALL] Initiated", data.sid, "→", to);
  return data.sid;
}

export function buildTwiml(publicUrl: string): string {
  const host = new URL(publicUrl).host;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/stream" />
  </Connect>
</Response>`;
}
