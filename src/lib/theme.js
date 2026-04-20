export const AVAILABLE_THEMES = ["light", "dark", "sand"];

export function getThemeStorageKey(username) {
  return `day2day-theme:${String(username || "").trim().toLowerCase()}`;
}

export function getStoredTheme(username) {
  if (typeof window === "undefined" || !username) {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(getThemeStorageKey(username));
  return AVAILABLE_THEMES.includes(storedTheme) ? storedTheme : "light";
}
