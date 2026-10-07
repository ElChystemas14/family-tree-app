/**
 * Preferencia de tema claro/oscuro (Fase B4, AUD-MED-05).
 *
 * Sin dependencias: se guarda en `localStorage` y un script bloqueante en el
 * layout aplica la clase antes del primer pintado (sin flash inicial).
 */

export const THEME_STORAGE_KEY = "hawthorne-theme";

export type Theme = "dark" | "light";

export function parseTheme(value: unknown): Theme | null {
  return value === "dark" || value === "light" ? value : null;
}

interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StringStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readStoredTheme(
  storage: StringStorage | undefined = defaultStorage()
): Theme | null {
  if (!storage) return null;
  try {
    return parseTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredTheme(
  theme: Theme,
  storage: StringStorage | undefined = defaultStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}
