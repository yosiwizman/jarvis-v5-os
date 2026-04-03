import React, { useEffect, useState } from "react";
import AkiorCore from "./AkiorCore";
import { useAkiorVoiceState } from "./useAkiorVoiceState";
import "./akior.css";

export default function AkiorMicDemo() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [requestInFlight, setRequestInFlight] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  const voice = useAkiorVoiceState(stream, {
    speakingThreshold: 0.11,
    listeningThreshold: 0.035,
    silenceHoldMs: 950,
    smoothing: 0.84,
  });

  useEffect(() => {
    voice.setThinking(requestInFlight);
  }, [requestInFlight]);

  useEffect(() => {
    voice.setSpeaking(ttsPlaying);
  }, [ttsPlaying]);

  const openMic = async () => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    setStream(s);
  };

  const closeMic = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    voice.reset();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#020913", color: "#bffcff", display: "grid", placeItems: "center" }}>
      <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
        <AkiorCore state={voice.state} size={460} audioLevel={voice.audioLevel} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={openMic}>Open mic</button>
          <button onClick={closeMic}>Close mic</button>
          <button onClick={() => setRequestInFlight(v => !v)}>
            Toggle thinking ({String(requestInFlight)})
          </button>
          <button onClick={() => setTtsPlaying(v => !v)}>
            Toggle speaking ({String(ttsPlaying)})
          </button>
        </div>
        <pre style={{ background: "#08131c", padding: 12, borderRadius: 12, minWidth: 320 }}>
{JSON.stringify({
  state: voice.state,
  audioLevel: Number(voice.audioLevel.toFixed(3)),
  rawLevel: Number(voice.rawLevel.toFixed(3)),
  isMicActive: voice.isMicActive
}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
