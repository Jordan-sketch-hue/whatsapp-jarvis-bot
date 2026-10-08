// Azure TTS via REST API — no native SDK binaries needed, works on any Linux
const VOICE = "en-US-AriaNeural";

export async function synthesizeToBuffer(text: string): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY!;
  const region = process.env.AZURE_SPEECH_REGION!;

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${VOICE}">
    <prosody rate="0%" pitch="0%">${escapeXml(text)}</prosody>
  </voice>
</speak>`;

  const res = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "raw-8khz-8bit-mono-mulaw",
      },
      body: ssml,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure TTS ${res.status}: ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  console.log(`[TTS] synthesized ${arrayBuffer.byteLength} bytes for: "${text.slice(0, 40)}"`);
  return Buffer.from(arrayBuffer);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}