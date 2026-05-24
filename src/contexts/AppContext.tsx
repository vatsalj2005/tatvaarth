import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import translations, { Language, TranslationKey } from '@/i18n/translations';

type ThemeType = 'dark' | 'soft-dark' | 'light' | 'sepia';

interface AppState {
  language: Language;
  theme: ThemeType;
  fontSize: number;
  lineSpacing: number;
  useSerif: boolean;
}

interface AppContextType extends AppState {
  t: (key: TranslationKey) => string;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: ThemeType) => void;
  setFontSize: (size: number) => void;
  setLineSpacing: (spacing: number) => void;
  setUseSerif: (use: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'tatvo-ka-arth-settings';

const themeClassMap: Record<ThemeType, string> = {
  dark: '',
  'soft-dark': 'theme-soft-dark',
  light: 'theme-light',
  sepia: 'theme-sepia',
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { language: 'hi', theme: 'dark', fontSize: 16, lineSpacing: 1.8, useSerif: false };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    Object.values(themeClassMap).forEach(cls => cls && root.classList.remove(cls));
    root.classList.remove('dark');
    
    const cls = themeClassMap[state.theme];
    if (cls) root.classList.add(cls);
    
    // Add Tailwind dark mode class for dark-based themes
    if (state.theme === 'dark' || state.theme === 'soft-dark') {
      root.classList.add('dark');
    }
    
    root.lang = state.language;
  }, [state.theme, state.language]);

  const t = useCallback((key: TranslationKey) => {
    return translations[state.language][key] || translations.hi[key] || key;
  }, [state.language]);

  const setLanguage = (language: Language) => setState(s => ({ ...s, language }));
  const setTheme = (theme: ThemeType) => setState(s => ({ ...s, theme }));
  const setFontSize = (fontSize: number) => setState(s => ({ ...s, fontSize }));
  const setLineSpacing = (lineSpacing: number) => setState(s => ({ ...s, lineSpacing }));
  const setUseSerif = (useSerif: boolean) => setState(s => ({ ...s, useSerif }));

  return (
    <AppContext.Provider value={{ ...state, t, setLanguage, setTheme, setFontSize, setLineSpacing, setUseSerif }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
