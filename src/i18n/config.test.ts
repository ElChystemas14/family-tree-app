import { describe, expect, it } from "vitest";
import { defaultLocale, getMessages, locales } from "./config";

const EXPECTED_NAMESPACES = [
  "metadata",
  "header",
  "onboarding",
  "controls",
  "personNode",
  "unionNode",
  "detail",
  "addRelative",
  "editDialog",
  "unionDialog",
  "help",
  "importJson",
  "importCsv",
  "exportDialog",
  "toasts",
];

function assertNonEmptyStrings(value: unknown, path: string): void {
  if (typeof value === "string") {
    expect(value.trim(), `cadena vacía en ${path}`).not.toBe("");
    return;
  }
  expect(typeof value, `no es objeto en ${path}`).toBe("object");
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    assertNonEmptyStrings(child, `${path}.${key}`);
  }
}

describe("i18n (C4)", () => {
  it("es es el locale por defecto y su catálogo está completo", async () => {
    expect(defaultLocale).toBe("es");
    expect(locales).toContain("es");
    const messages = await getMessages("es");
    for (const namespace of EXPECTED_NAMESPACES) {
      expect(messages[namespace], `falta namespace ${namespace}`).toBeDefined();
    }
    assertNonEmptyStrings(messages, "es");
  });
});
