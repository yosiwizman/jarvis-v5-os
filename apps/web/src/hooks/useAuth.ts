/**
 * Auth Hook
 * 
 * Manages authentication state for the frontend.
 * Fetches state from /api/auth/me and provides admin status.
 * 
 * SECURITY: No sensitive data stored client-side.
 */

import { useState, useEffect, useCallback } from 'react';

export type AuthState = {
  admin: boolean;
  pinConfigured: boolean;
  loading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  admin: false,
  pinConfigured: false,
  loading: true,
  error: null,
};

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState);

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setState({
          admin: Boolean(data.admin),
          pinConfigured: Boolean(data.pinConfigured),
          loading: false,
          error: null,
        });
      } else {
        setState({
          admin: false,
          pinConfigured: false,
          loading: false,
          error: 'Failed to fetch auth state',
        });
      }
    } catch (error) {
      setState({
        admin: false,
        pinConfigured: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Network error',
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (pin: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/pin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.ok) {
        // Refresh state after successful login
        await refresh();
        return { ok: true };
      }
      
      return { ok: false, error: data.error || 'Login failed' };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  }, [refresh]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await fetch('/api/auth/pin/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore errors on logout
    }
    
    // Clear local state
    setState(prev => ({ ...prev, admin: false }));
  }, []);

  const setPin = useCallback(async (pin: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/pin/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.ok) {
        // Refresh state after setting PIN
        await refresh();
        return { ok: true };
      }
      
      return { ok: false, error: data.error || 'Failed to set PIN' };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  }, [refresh]);

  return {
    ...state,
    refresh,
    login,
    logout,
    setPin,
  };
}
