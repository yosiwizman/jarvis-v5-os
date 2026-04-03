export type AkiorUIState = "idle" | "listening" | "thinking" | "speaking";

export interface AkiorTransitionInput {
  micOpen: boolean;
  userVoiceDetected: boolean;
  requestInFlight: boolean;
  ttsPlaying: boolean;
}

export function resolveAkiorState(input: AkiorTransitionInput): AkiorUIState {
  if (input.ttsPlaying) return "speaking";
  if (input.requestInFlight) return "thinking";
  if (input.micOpen && input.userVoiceDetected) return "listening";
  return "idle";
}

/**
 * Recommended transition rules:
 * - speaking wins over everything
 * - thinking wins over listening
 * - listening only when user voice is present, not merely mic-open
 * - idle is default
 */
