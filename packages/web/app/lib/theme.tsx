import { useEffect, useState, useCallback } from "react";
import { Moon, Sun } from "lucide-react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "hg.theme";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Inline script injected into <head> before hydration so the correct
 * color-scheme is applied before paint (no theme flash).
 */
export const themeBootstrapScript = `
(function(){try{
  var t=localStorage.getItem("${STORAGE_KEY}");
  if(t!=="light"&&t!=="dark"){
    t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  }
  document.documentElement.setAttribute("data-theme",t);
}catch(_){}})();
`;

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    const attr = document.documentElement.getAttribute("data-theme");
    return attr === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const toggle = useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  return { theme, setTheme: setThemeState, toggle };
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-sm text-ink-muted hover:text-ink transition-colors ${className}`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}
