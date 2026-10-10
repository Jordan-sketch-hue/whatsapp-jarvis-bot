import "dotenv/config";

export async function initiateCall(to: string): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  const base = process.env.PUBLIC_URL!;
  const isPaid = process.env.TWILIO_PAID === "true";

  const params: Record<string, string> = {
    To: to,
    From: from,
    Url: `${base}/twiml`,
  };

  // StatusCallback may be rejected on trial accounts — only add on paid
  if (isPaid) {
    params.StatusCallback = `${base}/call-status`;
    params.StatusCallbackMethod = "POST";
  }

  // AMD and recording require a paid Twilio account
  if (isPaid) {
    params.MachineDetection = "Enable";
    params.AsyncAmd = "true";
    params.AsyncAmdStatusCallback = `${base}/amd-status`;
    params.AsyncAmdStatusCallbackMethod = "POST";
    params.Record = "true";
    params.RecordingChannels = "dual";
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
    {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    }
  );

  const rawText = await res.text();
  console.log("[CALL] Twilio HTTP", res.status, "response:", rawText.slice(0, 500));
  const data = JSON.parse(rawText) as any;
  if (!res.ok) {
    const msg = data?.message ?? rawText;
    const code = data?.code ?? res.status;
    throw new Error(`[${code}] ${msg}`);
  }
  return data.sid;
}
