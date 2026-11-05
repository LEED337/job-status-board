/** Keep in sync with the inline script in index.html. */
export const THEME_STORAGE_KEY = "job-board-theme";

export type Theme = "light" | "dark";

const PAGE: Record<Theme, string> = {
  light: "#2a2d32",
  dark: "#0e1014",
};

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* localStorage can throw in private mode */
  }
  return null;
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.style.backgroundColor = PAGE[theme];
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PAGE[theme]);
}

export function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
  applyTheme(theme);
}

/** Use a theme already chosen before paint; otherwise follow the saved or system choice. */
export function ensureTheme(): Theme {
  const current = document.documentElement.dataset.theme;
  if (current === "light" || current === "dark") return current;
  const theme = storedTheme() ?? systemTheme();
  applyTheme(theme);
  return theme;
}
