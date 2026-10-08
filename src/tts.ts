import * as sdk from "microsoft-cognitiveservices-speech-sdk";

// Marcus voice — US male, already used in jst-academy-platform
const VOICE = "en-US-AndrewMultilingualNeural";

export function synthesizeToBuffer(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY!,
      process.env.AZURE_SPEECH_REGION!
    );
    // Raw 8kHz mulaw — exactly what Twilio Media Streams expects, no conversion needed
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Raw8Khz8BitMonoMULaw;
    speechConfig.speechSynthesisVoiceName = VOICE;

    const pullStream = sdk.AudioOutputStream.createPullStream();
    const audioConfig = sdk.AudioConfig.fromStreamOutput(pullStream);
    const synth = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="${VOICE}">
    <prosody rate="0%" pitch="0%">${escapeXml(text)}</prosody>
  </voice>
</speak>`;

    synth.speakSsmlAsync(
      ssml,
      (result) => {
        synth.close();
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          resolve(Buffer.from(result.audioData));
        } else {
          reject(new Error(`TTS failed: ${result.errorDetails}`));
        }
      },
      (err) => {
        synth.close();
        reject(err);
      }
    );
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
