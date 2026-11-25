// Shared with the portfolio and every app: same storage key, same three themes,
// Midnight by default. Everything on one domain shares the choice.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeKey = "midnight" | "navy" | "white";

export const THEMES: { key: ThemeKey; label: string; swatch: string; dark: boolean }[] = [
  { key: "midnight", label: "Midnight", swatch: "#bef264", dark: true },
  { key: "navy", label: "Navy", swatch: "#67e8f9", dark: true },
  { key: "white", label: "White", swatch: "#3730a3", dark: false },
];

export const STORAGE_KEY = "vk-theme";
export const DEFAULT_THEME: ThemeKey = "midnight";

const isTheme = (v: unknown): v is ThemeKey => v === "midnight" || v === "navy" || v === "white";

export function readStoredTheme(): ThemeKey {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // storage can be blocked (private mode, cookies off)
  }
  return DEFAULT_THEME;
}

type ThemeContextValue = { theme: ThemeKey; isDark: boolean; setTheme: (key: ThemeKey) => void };

const ThemeContext = createContext<ThemeContextValue>({ theme: DEFAULT_THEME, isDark: true, setTheme: () => undefined });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeKey>(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  // follow a theme picked in another tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isTheme(e.newValue)) setTheme(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isDark = THEMES.find((t) => t.key === theme)?.dark ?? true;
  return <ThemeContext.Provider value={{ theme, isDark, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
