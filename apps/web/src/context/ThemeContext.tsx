'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';
type ColorTheme = 'cyber-blue' | 'midnight-purple' | 'solar-flare' | 'digital-rain' | 'ice-crystal';

interface ThemeState {
  mode: ThemeMode;
  colorTheme: ColorTheme;
}

interface ThemeContextValue {
  theme: ThemeMode; // Legacy compatibility
  colorTheme: ColorTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
  themeState: ThemeState;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'jarvis-v5-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeState, setThemeStateInternal] = useState<ThemeState>({
    mode: 'dark',
    colorTheme: 'cyber-blue'
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ThemeState>;
        setThemeStateInternal({
          mode: (parsed.mode === 'light' || parsed.mode === 'dark') ? parsed.mode : 'dark',
          colorTheme: parsed.colorTheme || 'cyber-blue'
        });
      }
    } catch {
      // ignore - use defaults
    }
  }, []);

  // Persist & update <html> classes when theme changes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    
    // Update mode class (light/dark)
    root.classList.remove('light', 'dark');
    root.classList.add(themeState.mode);
    
    // Update color theme class
    root.classList.remove('theme-cyber-blue', 'theme-midnight-purple', 'theme-solar-flare', 'theme-digital-rain', 'theme-ice-crystal');
    root.classList.add(`theme-${themeState.colorTheme}`);
    
    // Persist to localStorage
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeState));
    } catch {
      // ignore
    }
  }, [themeState]);

  const setTheme = (mode: ThemeMode) => {
    setThemeStateInternal(prev => ({ ...prev, mode }));
  };

  const toggleTheme = () => {
    setThemeStateInternal(prev => ({
      ...prev,
      mode: prev.mode === 'dark' ? 'light' : 'dark'
    }));
  };

  const setColorTheme = (colorTheme: ColorTheme) => {
    setThemeStateInternal(prev => ({ ...prev, colorTheme }));
  };

  const value: ThemeContextValue = {
    theme: themeState.mode, // Legacy compat
    colorTheme: themeState.colorTheme,
    setTheme,
    toggleTheme,
    setColorTheme,
    themeState
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
