"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS } from "@/constants";
import { readStorageString, writeStorageString } from "@/utils/storage";

type Theme = "light" | "dark";
type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void; toggleTheme: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

function parseTheme(value: string | null): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const restored = useRef(false);

  useEffect(() => {
    const saved = parseTheme(readStorageString(STORAGE_KEYS.theme, 16));
    if (saved) setTheme(saved);
    restored.current = true;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    // Avoid overwriting a previously saved dark preference with the initial
    // light render before hydration has had a chance to restore it.
    if (restored.current) writeStorageString(STORAGE_KEYS.theme, theme, 16);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme: () => setTheme((current) => (current === "light" ? "dark" : "light")) }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
