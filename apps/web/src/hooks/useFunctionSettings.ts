'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'jarvis-function-settings';

export interface FunctionSettings {
  [functionName: string]: {
    enabled: boolean;
  };
}

/**
 * Hook to manage function enable/disable settings
 * Settings are persisted in localStorage
 */
export function useFunctionSettings() {
  const [settings, setSettings] = useState<FunctionSettings>(() => {
    if (typeof window === 'undefined') return {};
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load function settings:', error);
    }
    return {};
  });

  // Save to localStorage whenever settings change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error('Failed to save function settings:', error);
      }
    }
  }, [settings]);

  const isFunctionEnabled = (functionName: string): boolean => {
    // If no setting exists, default to enabled
    return settings[functionName]?.enabled !== false;
  };

  const toggleFunction = (functionName: string) => {
    setSettings(prev => ({
      ...prev,
      [functionName]: {
        enabled: !isFunctionEnabled(functionName)
      }
    }));
  };

  const setFunctionEnabled = (functionName: string, enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      [functionName]: {
        enabled
      }
    }));
  };

  const enableAll = (functionNames: string[]) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      functionNames.forEach(name => {
        newSettings[name] = { enabled: true };
      });
      return newSettings;
    });
  };

  const disableAll = (functionNames: string[]) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      functionNames.forEach(name => {
        newSettings[name] = { enabled: false };
      });
      return newSettings;
    });
  };

  return {
    settings,
    isFunctionEnabled,
    toggleFunction,
    setFunctionEnabled,
    enableAll,
    disableAll
  };
}

/**
 * Utility function to check if a function is enabled (for use outside React components)
 */
export function isFunctionEnabledSync(functionName: string): boolean {
  if (typeof window === 'undefined') return true;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const settings: FunctionSettings = JSON.parse(stored);
      return settings[functionName]?.enabled !== false;
    }
  } catch (error) {
    console.error('Failed to check function status:', error);
  }
  
  // Default to enabled
  return true;
}

