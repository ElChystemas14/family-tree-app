import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatYear,
  isValidISODate,
  parseISODateLocal,
} from "./dates";

describe("parseISODateLocal (AUD-CRIT-01)", () => {
  it("interpreta YYYY-MM-DD como medianoche local, sin desplazamiento UTC", () => {
    const date = parseISODateLocal("1954-08-17");
    expect(date.getFullYear()).toBe(1954);
    expect(date.getMonth()).toBe(7); // agosto = 7 (0-index)
    expect(date.getDate()).toBe(17);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it("cubre el borde 1 de enero (año no retrocede en UTC-5)", () => {
    const date = parseISODateLocal("2000-01-01");
    expect(date.getFullYear()).toBe(2000);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
    expect(formatYear("2000-01-01")).toBe("2000");
  });

  it("rechaza formatos inválidos o fechas inexistentes", () => {
    expect(() => parseISODateLocal("no-fecha")).toThrow();
    expect(() => parseISODateLocal("2024-02-30")).toThrow();
    expect(() => parseISODateLocal("2024-13-01")).toThrow();
    expect(() => parseISODateLocal("")).toThrow();
  });
});

describe("formatYear / formatDate", () => {
  it("Margaret 1954-08-17 mantiene día 17 y año 1954", () => {
    expect(formatYear("1954-08-17")).toBe("1954");
    const formatted = formatDate("1954-08-17");
    expect(formatted).toContain("1954");
    expect(formatted).toMatch(/(^|\D)17(\D|$)/);
    expect(formatted).not.toMatch(/(^|\D)16(\D|$)/);
  });

  it("devuelve '' con fecha vacía o ausente", () => {
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatYear(undefined)).toBe("");
  });
});

describe("isValidISODate", () => {
  it("valida YYYY-MM-DD reales y rechaza el resto", () => {
    expect(isValidISODate("2024-02-29")).toBe(true); // bisiesto
    expect(isValidISODate("2023-02-29")).toBe(false);
    expect(isValidISODate("2024-13-01")).toBe(false);
    expect(isValidISODate("hola")).toBe(false);
  });
});
