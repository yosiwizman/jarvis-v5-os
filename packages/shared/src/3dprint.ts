/**
 * 3D Print / Bambu Labs integration types
 */

export interface TokenStatusResponse {
  ok: boolean;
  loggedIn: boolean;
  connected: boolean;
  provider: string;
  hasToken: boolean;
  error: string | null;
}
