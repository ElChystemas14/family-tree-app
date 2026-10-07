import { describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  parseTheme,
  readStoredTheme,
  writeStoredTheme,
} from "./theme";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("theme (B4)", () => {
  it("parsea dark/light y rechaza el resto", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("sepia")).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });

  it("lee y escribe la preferencia sin crashear", () => {
    const storage = memoryStorage();
    expect(readStoredTheme(storage)).toBeNull();
    expect(writeStoredTheme("dark", storage)).toBe(true);
    expect(readStoredTheme(storage)).toBe("dark");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("tolera almacenamiento roto o ausente", () => {
    expect(readStoredTheme(undefined)).toBeNull();
    expect(writeStoredTheme("dark", undefined)).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error("denegado");
      },
      setItem: () => {
        throw new Error("lleno");
      },
    };
    expect(readStoredTheme(broken)).toBeNull();
    expect(writeStoredTheme("dark", broken)).toBe(false);
    const getItem = vi.fn(() => "light");
    expect(readStoredTheme({ getItem, setItem: vi.fn() })).toBe("light");
    expect(getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
  });
});
