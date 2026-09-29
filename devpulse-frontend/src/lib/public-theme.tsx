import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/** Light/dark theme for the public site (landing, About, Privacy, Terms).
 * The signed-in app is always dark and ignores this. */
export type PublicTheme = "light" | "dark";

const STORAGE_KEY = "devpulse:public-theme";

function readStoredTheme(): PublicTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be blocked (private mode, strict cookie settings).
  }
  return "light";
}

const ThemeContext = createContext<{ theme: PublicTheme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function PublicThemeProvider({ children }: { children: (theme: PublicTheme) => ReactNode }) {
  const [theme, setTheme] = useState<PublicTheme>(readStoredTheme);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Not persisting is fine; the toggle still works for this visit.
      }
      return next;
    });
  }, []);

  // index.html and index.css are set up for the dark app; match the page
  // chrome (overscroll, scrollbars, form controls) to the public theme
  // while a public page is mounted.
  useEffect(() => {
    const root = document.documentElement;
    const previous = { bg: root.style.backgroundColor, scheme: root.style.colorScheme };
    root.style.backgroundColor = theme === "light" ? "#ffffff" : "#07090e";
    root.style.colorScheme = theme;
    return () => {
      root.style.backgroundColor = previous.bg;
      root.style.colorScheme = previous.scheme;
    };
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children(theme)}</ThemeContext.Provider>;
}

export function usePublicTheme() {
  return useContext(ThemeContext);
}
