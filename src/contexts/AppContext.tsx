import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import translations, { Language, TranslationKey } from '@/i18n/translations';

export type ThemeType = 'dark' | 'light';

interface AppState {
  language: Language;
  theme: ThemeType;
}

interface AppContextType extends AppState {
  t: (key: TranslationKey) => string;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: ThemeType) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'tatvo-ka-arth-settings';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        return {
          language: saved.language === 'en' ? 'en' : 'hi',
          theme: saved.theme === 'light' ? 'light' : 'dark',
        };
      }
    } catch {}
    return { language: 'hi', theme: 'dark' };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-soft-dark', 'theme-sepia');
    root.classList.remove('dark');
    
    if (state.theme === 'light') {
      root.classList.add('theme-light');
    } else {
      root.classList.add('dark');
    }
    
    root.lang = state.language;
  }, [state.theme, state.language]);

  const t = useCallback((key: TranslationKey) => {
    return translations[state.language][key] || translations.hi[key] || key;
  }, [state.language]);

  const setLanguage = (language: Language) => setState(s => ({ ...s, language }));
  const setTheme = (theme: ThemeType) => setState(s => ({ ...s, theme }));

  return (
    <AppContext.Provider value={{ ...state, t, setLanguage, setTheme }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
