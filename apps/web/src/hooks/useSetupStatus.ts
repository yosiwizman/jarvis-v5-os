/**
 * Setup Status Hook
 * 
 * Monitors system setup status by fetching /api/health/status.
 * Returns setup state and health level for gating features.
 * 
 * Used to prevent premature API calls and show "Setup Required" UI.
 */

import { useState, useEffect, useCallback } from 'react';
import { buildServerUrl } from '@/lib/api';

export type SetupStatus = {
  setupRequired: boolean;
  pinConfigured: boolean;
  llmConfigured: boolean;
  llmProvider: 'openai-cloud' | 'local-compatible' | null;
  level: 'healthy' | 'setup_required' | 'degraded' | 'error';
  reasons: string[];
  loading: boolean;
  error: string | null;
};

const initialState: SetupStatus = {
  setupRequired: true, // Default to requiring setup for safety
  pinConfigured: false,
  llmConfigured: false,
  llmProvider: null,
  level: 'setup_required',
  reasons: [],
  loading: true,
  error: null,
};

export function useSetupStatus() {
  const [state, setState] = useState<SetupStatus>(initialState);

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch(buildServerUrl('/api/health/status'), {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        setState({
          setupRequired: data.level === 'setup_required',
          pinConfigured: Boolean(data.setup?.ownerPin),
          llmConfigured: Boolean(data.setup?.llm),
          llmProvider: data.setup?.llmProvider || null,
          level: data.level || 'setup_required',
          reasons: Array.isArray(data.reasons) ? data.reasons : [],
          loading: false,
          error: null,
        });
      } else {
        setState({
          ...initialState,
          loading: false,
          error: 'Failed to fetch setup status',
        });
      }
    } catch (error) {
      setState({
        ...initialState,
        loading: false,
        error: error instanceof Error ? error.message : 'Network error',
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
  };
}
