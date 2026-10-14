import "dotenv/config";

export async function initiateCall(to: string): Promise<string> {
  const apiKey = process.env.TELNYX_API_KEY!;
  const from = process.env.FROM_NUMBER!;
  const base = process.env.PUBLIC_URL!;

  const params: Record<string, string> = {
    To: to,
    From: from,
    Url: `${base}/twiml`,
    StatusCallback: `${base}/call-status`,
    StatusCallbackMethod: "POST",
    MachineDetection: "Enable",
    AsyncAmd: "true",
    AsyncAmdStatusCallback: `${base}/amd-status`,
    AsyncAmdStatusCallbackMethod: "POST",
    Record: "true",
    RecordingChannels: "dual",
  };

  const res = await fetch(
    `https://api.telnyx.com/v2/texml/Accounts/${apiKey}/Calls.json`,
    {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${apiKey}:`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    }
  );

  const rawText = await res.text();
  console.log("[CALL] Telnyx HTTP", res.status, "response:", rawText.slice(0, 500));
  const data = JSON.parse(rawText) as any;
  if (!res.ok) {
    const msg = data?.message ?? rawText;
    const code = data?.code ?? res.status;
    throw new Error(`[${code}] ${msg}`);
  }
  return data.sid;
}
