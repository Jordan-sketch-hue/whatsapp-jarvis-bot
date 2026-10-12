import "dotenv/config";

const VOICE = "en-US-AndrewMultilingualNeural";

export async function synthesizeToBuffer(text: string): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY!;
  const region = process.env.AZURE_SPEECH_REGION || "eastus";

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${VOICE}">
    <prosody rate="-5%" pitch="0%">${escapeXml(text)}</prosody>
  </voice>
</speak>`;

  const res = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        // Raw 8kHz mulaw — what Twilio Media Streams expects, zero conversion
        "X-Microsoft-OutputFormat": "raw-8khz-8bit-mono-mulaw",
        "User-Agent": "marcus-sales-bot",
      },
      body: ssml,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure TTS ${res.status}: ${err}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
