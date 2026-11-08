import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./Icons.tsx";
import { applyTheme, ensureTheme, persistTheme, storedTheme, systemTheme, type Theme } from "../lib/theme.ts";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => ensureTheme());

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (storedTheme()) return;
      const next = systemTheme();
      applyTheme(next);
      setTheme(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const dark = theme === "dark";
  const label = dark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      className="no-print inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-black bg-white text-ink hover:bg-soft"
      aria-pressed={dark}
      aria-label={label}
      title={label}
      onClick={() => {
        const next: Theme = dark ? "light" : "dark";
        persistTheme(next);
        setTheme(next);
      }}
    >
      {dark ? <MoonIcon className="h-[18px] w-[18px]" /> : <SunIcon className="h-[18px] w-[18px]" />}
    </button>
  );
}
