import { useEffect, useMemo, useRef, useState } from "react";

export type AkiorVoiceState = "idle" | "listening" | "thinking" | "speaking";

export interface UseAkiorVoiceOptions {
  analyserFftSize?: number;
  speakingThreshold?: number;      // default 0.10
  listeningThreshold?: number;     // default 0.035
  silenceHoldMs?: number;          // default 900
  thinkingDebounceMs?: number;     // default 180
  smoothing?: number;              // default 0.82
  minActiveMs?: number;            // default 350
  disabled?: boolean;
}

export interface AkiorVoiceController {
  state: AkiorVoiceState;
  audioLevel: number;              // 0..1 smoothed
  rawLevel: number;                // 0..1 unsmoothed
  isMicActive: boolean;
  setThinking: (value: boolean) => void;
  setSpeaking: (value: boolean) => void;
  reset: () => void;
}

/**
 * Phase 5 live interaction hook.
 *
 * State priority:
 * speaking > thinking > listening > idle
 *
 * Intended use:
 * - mic open but quiet -> idle/listening
 * - user voice activity -> listening
 * - backend/tool request in flight -> thinking
 * - TTS playing -> speaking
 */
export function useAkiorVoiceState(
  stream?: MediaStream | null,
  options: UseAkiorVoiceOptions = {}
): AkiorVoiceController {
  const {
    analyserFftSize = 256,
    speakingThreshold = 0.10,
    listeningThreshold = 0.035,
    silenceHoldMs = 900,
    thinkingDebounceMs = 180,
    smoothing = 0.82,
    minActiveMs = 350,
    disabled = false,
  } = options;

  const [rawLevel, setRawLevel] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [state, setState] = useState<AkiorVoiceState>("idle");
  const [thinking, setThinkingState] = useState(false);
  const [speaking, setSpeakingState] = useState(false);

  const rafRef = useRef<number | null>(null);
  const lastActiveAtRef = useRef<number>(0);
  const listeningSinceRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (disabled || !stream) {
      setRawLevel(0);
      setAudioLevel(0);
      setState(thinking ? "thinking" : speaking ? "speaking" : "idle");
      return;
    }

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = analyserFftSize;
    analyser.smoothingTimeConstant = 0.7;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((acc, v) => acc + v, 0) / Math.max(1, data.length);
      const normalized = Math.min(1, avg / 110);

      setRawLevel(normalized);
      setAudioLevel(prev => (prev * smoothing) + (normalized * (1 - smoothing)));

      const now = performance.now();

      if (normalized >= listeningThreshold) {
        if (!listeningSinceRef.current) listeningSinceRef.current = now;
        lastActiveAtRef.current = now;
      }

      const activeRecently = (now - lastActiveAtRef.current) < silenceHoldMs;
      const listeningLongEnough =
        listeningSinceRef.current > 0 && (now - listeningSinceRef.current) >= minActiveMs;

      if (speaking || normalized >= speakingThreshold) {
        setState("speaking");
      } else if (thinking) {
        setState("thinking");
      } else if (activeRecently && listeningLongEnough) {
        setState("listening");
      } else {
        setState("idle");
        listeningSinceRef.current = 0;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      audioContext.close().catch(() => {});
      analyserRef.current = null;
      audioContextRef.current = null;
      listeningSinceRef.current = 0;
    };
  }, [
    stream,
    disabled,
    analyserFftSize,
    speakingThreshold,
    listeningThreshold,
    silenceHoldMs,
    smoothing,
    minActiveMs,
    thinking,
    speaking,
  ]);

  const setThinking = (value: boolean) => {
    if (value) {
      window.setTimeout(() => setThinkingState(true), thinkingDebounceMs);
    } else {
      setThinkingState(false);
    }
  };

  const setSpeaking = (value: boolean) => {
    setSpeakingState(value);
  };

  const reset = () => {
    setRawLevel(0);
    setAudioLevel(0);
    setState("idle");
    setThinkingState(false);
    setSpeakingState(false);
    listeningSinceRef.current = 0;
    lastActiveAtRef.current = 0;
  };

  return useMemo(
    () => ({
      state,
      audioLevel,
      rawLevel,
      isMicActive: !!stream && !disabled,
      setThinking,
      setSpeaking,
      reset,
    }),
    [state, audioLevel, rawLevel, stream, disabled]
  );
}
