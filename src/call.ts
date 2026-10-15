import "dotenv/config";

export async function initiateCall(to: string): Promise<string> {
  const apiKey = process.env.TELNYX_API_KEY!;
  const orgId = process.env.TELNYX_ORG_ID!;
  const from = process.env.FROM_NUMBER!;
  const base = process.env.PUBLIC_URL!;
  const appSid = process.env.TELNYX_APP_SID!;

  const body = {
    To: to,
    From: from,
    ApplicationSid: appSid,
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
    `https://api.telnyx.com/v2/texml/Accounts/${orgId}/Calls`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const rawText = await res.text();
  console.log("[CALL] Telnyx HTTP", res.status, "response:", rawText.slice(0, 500));
  const data = JSON.parse(rawText) as any;
  if (!res.ok) {
    const msg = data?.errors?.[0]?.detail ?? data?.message ?? rawText;
    const code = data?.telnyx_error?.error_code ?? data?.errors?.[0]?.code ?? res.status;
    throw new Error(`[${code}] ${msg}`);
  }
  return data.call_control_id ?? data.to ?? "queued";
}
