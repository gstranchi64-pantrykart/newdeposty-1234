import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ThemePalette, APP_THEMES, DEFAULT_THEME_ID, getThemeById, applyThemeToDom } from '../theme/themeConfig';
import { api } from '../services/api';

interface ThemeContextType {
  currentTheme: ThemePalette;
  themeId: string;
  themes: ThemePalette[];
  changeTheme: (newThemeId: string) => Promise<void>;
  isApplying: boolean;
}

const THEME_STORAGE_KEY = 'pantrymaster_active_theme';

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: getThemeById(DEFAULT_THEME_ID),
  themeId: DEFAULT_THEME_ID,
  themes: APP_THEMES,
  changeTheme: async () => {},
  isApplying: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Determine initial theme: check localStorage first, then fallback to DEFAULT_THEME_ID ('yellow-amber')
  const [themeId, setThemeId] = useState<string>(() => {
    try {
      const cached = localStorage.getItem(THEME_STORAGE_KEY);
      if (cached && APP_THEMES.some((t) => t.id === cached)) {
        return cached;
      }
    } catch {}
    return DEFAULT_THEME_ID;
  });

  const [isApplying, setIsApplying] = useState(false);

  // Apply theme immediately to DOM on mount and when themeId changes
  useEffect(() => {
    const active = getThemeById(themeId);
    applyThemeToDom(active);
  }, [themeId]);

  // Load persisted theme from server settings on initial boot
  useEffect(() => {
    let mounted = true;
    api
      .getSettings()
      .then((settings) => {
        if (!mounted) return;
        if (settings?.activeThemeId && APP_THEMES.some((t) => t.id === settings.activeThemeId)) {
          setThemeId(settings.activeThemeId);
          try {
            localStorage.setItem(THEME_STORAGE_KEY, settings.activeThemeId);
          } catch {}
          applyThemeToDom(getThemeById(settings.activeThemeId));
        }
      })
      .catch(() => {
        // Fallback already active
      });

    // Listen for storage changes across tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        if (APP_THEMES.some((t) => t.id === e.newValue)) {
          setThemeId(e.newValue);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      mounted = false;
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const changeTheme = useCallback(async (newThemeId: string) => {
    const selected = getThemeById(newThemeId);
    setThemeId(selected.id);
    applyThemeToDom(selected);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, selected.id);
    } catch {}

    setIsApplying(true);
    try {
      const currentSettings = await api.getSettings().catch(() => null);
      if (currentSettings) {
        await api.updateSettings({
          ...currentSettings,
          activeThemeId: selected.id,
        });
      }
    } catch (err) {
      console.warn('Could not persist theme to server settings:', err);
    } finally {
      setIsApplying(false);
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme: getThemeById(themeId),
        themeId,
        themes: APP_THEMES,
        changeTheme,
        isApplying,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
