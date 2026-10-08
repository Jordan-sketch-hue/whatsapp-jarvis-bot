"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAzureSTT = createAzureSTT;
// Azure STT via WebSocket — no native SDK binaries needed
const ws_1 = __importDefault(require("ws"));
const STT_LANG = "en-US";
function createAzureSTT(onTranscript) {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    const url = `wss://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${STT_LANG}&format=simple`;
    const ws = new ws_1.default(url, {
        headers: { "Ocp-Apim-Subscription-Key": key },
    });
    let ready = false;
    const queue = [];
    ws.on("open", () => {
        // Send speech config
        ws.send(JSON.stringify({
            context: { system: { version: "1.0" }, os: { platform: "Linux", name: "Node" }, device: { manufacturer: "JST" } },
        }));
        // Send audio config
        const audioConfig = {
            type: "start",
            format: { encoding: "PCM", channels: 1, sampleRate: 8000, bitspersample: 16 },
        };
        ws.send(JSON.stringify(audioConfig));
        ready = true;
        queue.forEach((buf) => ws.send(buf));
        queue.length = 0;
    });
    ws.on("message", (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.RecognitionStatus === "Success" && msg.DisplayText) {
                onTranscript(msg.DisplayText, true);
            }
            else if (msg.Text) {
                onTranscript(msg.Text, false);
            }
        }
        catch { }
    });
    ws.on("error", (err) => console.error("[STT] WS error:", err.message));
    return {
        pushAudio: (mulawBuffer) => {
            const pcm = mulawToPcm(mulawBuffer);
            const buf = Buffer.from(pcm.buffer);
            if (ready)
                ws.send(buf);
            else
                queue.push(buf);
        },
        stop: () => {
            try {
                ws.send(JSON.stringify({ type: "end" }));
                ws.close();
            }
            catch { }
        },
    };
}
function mulawToPcm(mulaw) {
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
