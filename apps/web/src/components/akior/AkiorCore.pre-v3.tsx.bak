import React, { useEffect, useMemo, useRef, useState } from "react";

export type AkiorState = "idle" | "listening" | "speaking" | "thinking";

export interface AkiorCoreProps {
  state?: AkiorState;
  className?: string;
  size?: number | string;
  reducedMotion?: boolean;
  showParticles?: boolean;
  audioLevel?: number; // 0..1 for speaking/listening waveform intensity
}

/**
 * Production-ready AKIOR orb renderer.
 * Strategy:
 * - Render each SVG state asset as a layer
 * - Crossfade between states
 * - Add CSS-driven transforms for motion
 * - Support reduced motion and optional audio reactivity
 */
export default function AkiorCore({
  state = "idle",
  className = "",
  size = 420,
  reducedMotion = false,
  showParticles = true,
  audioLevel = 0,
}: AkiorCoreProps) {
  const rootStyle = useMemo(
    () =>
      ({
        width: typeof size === "number" ? `${size}px` : size,
        height: typeof size === "number" ? `${size}px` : size,
        ["--akior-audio-level" as any]: Math.max(0, Math.min(1, audioLevel)),
      }) as React.CSSProperties,
    [size, audioLevel]
  );

  const stateClass = `akior--${state}` + (reducedMotion ? " akior--reduced" : "");

  return (
    <div className={`akior ${stateClass} ${className}`.trim()} style={rootStyle} aria-label={`AKIOR ${state} state`}>
      <img
        src="/akior/state-idle.svg"
        alt=""
        aria-hidden="true"
        className="akior__asset akior__asset--idle"
        draggable={false}
      />
      <img
        src="/akior/state-listening.svg"
        alt=""
        aria-hidden="true"
        className="akior__asset akior__asset--listening"
        draggable={false}
      />
      <img
        src="/akior/state-speaking.svg"
        alt=""
        aria-hidden="true"
        className="akior__asset akior__asset--speaking"
        draggable={false}
      />
      <img
        src="/akior/state-thinking-loading.svg"
        alt=""
        aria-hidden="true"
        className="akior__asset akior__asset--thinking"
        draggable={false}
      />

      <div className="akior__fx akior__fx--outer-ring" aria-hidden="true" />
      <div className="akior__fx akior__fx--counter-ring" aria-hidden="true" />
      <div className="akior__fx akior__fx--pulse" aria-hidden="true" />
      {showParticles && <div className="akior__fx akior__fx--bloom" aria-hidden="true" />}
    </div>
  );
}

/**
 * Lightweight Web Audio hook.
 * Use only for live mic / TTS playback amplitude if desired.
 */
export function useAkiorAudioLevel(stream?: MediaStream | null) {
  const [audioLevel, setAudioLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) {
      setAudioLevel(0);
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((acc, v) => acc + v, 0) / Math.max(1, dataArray.length);
      const normalized = Math.min(1, avg / 90);
      setAudioLevel(normalized);
      rafRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [stream]);

  return audioLevel;
}
