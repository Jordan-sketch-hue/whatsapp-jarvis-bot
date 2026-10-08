/**
 * STT module — Azure Speech Services (real-time streaming)
 * Replaces Deepgram. Uses the same AZURE_SPEECH_KEY + AZURE_SPEECH_REGION.
 * Input: mulaw 8kHz PCM chunks from Twilio
 * Output: transcribed text via callback
 */

import * as sdk from "microsoft-cognitiveservices-speech-sdk";

export function createAzureSTT(onTranscript: (text: string, isFinal: boolean) => void) {
  const key = process.env.AZURE_SPEECH_KEY!;
  const region = process.env.AZURE_SPEECH_REGION!;

  const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
  speechConfig.speechRecognitionLanguage = "en-US";
  speechConfig.setProperty(
    sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "5000"
  );
  speechConfig.setProperty(
    sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "1000"
  );

  // Use raw 8kHz PCM format (mulaw decoded)
  const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(8000, 16, 1);
  const pushStream = sdk.AudioInputStream.createPushStream(audioFormat);
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  recognizer.recognizing = (_, e) => {
    if (e.result.text) onTranscript(e.result.text, false);
  };

  recognizer.recognized = (_, e) => {
    if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
      onTranscript(e.result.text, true);
    }
  };

  recognizer.startContinuousRecognitionAsync();

  return {
    /** Feed raw mulaw bytes — will be decoded to PCM before pushing */
    pushAudio: (mulawBuffer: Buffer) => {
      const pcm = mulawToPcm(mulawBuffer);
      pushStream.write(pcm.buffer);
    },
    stop: () => {
      recognizer.stopContinuousRecognitionAsync();
      pushStream.close();
    },
  };
}

/** Decode G.711 mulaw to 16-bit PCM — needed because Azure STT expects PCM */
function mulawToPcm(mulaw: Buffer): Int16Array {
  const pcm = new Int16Array(mulaw.length);
  for (let i = 0; i < mulaw.length; i++) {
    let u = ~mulaw[i] & 0xff;
    const sign = u & 0x80;
    const exp = (u >> 4) & 0x07;
    const mantissa = u & 0x0f;
    let sample = ((mantissa << 1) + 33) << (exp + 2);
    sample -= 33;
    pcm[i] = sign ? -sample : sample;
  }
  return pcm;
}
