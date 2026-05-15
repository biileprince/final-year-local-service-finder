"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** User preference — "system" follows the OS. */
  theme: Theme;
  /** What's actually being applied right now (system resolved). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  /** Light ↔ dark; if currently on "system", flips to the opposite of resolved. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "lsf:theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to "system"; the inline pre-hydration script in the root layout
  // has already applied the right class so there's no flash either way.
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  // Read stored preference once on mount.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
    setSystemTheme(getSystemTheme());
  }, []);

  // Track OS preference changes while in "system" mode.
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      setSystemTheme(e.matches ? "dark" : "light");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  // Apply the resolved theme to the root element + persist preference.
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (next === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    // Pin the user to an explicit choice on first toggle so we don't keep
    // bouncing off OS changes.
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, toggle }),
    [theme, resolvedTheme, setTheme, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}

/**
 * Inline script content — runs before hydration so the correct theme is
 * applied on the first paint. Inject this verbatim via
 * `<script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />`.
 */
export const themeNoFlashScript = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolved = stored === 'dark' || stored === 'light'
      ? stored
      : (prefersDark ? 'dark' : 'light');
    if (resolved === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
