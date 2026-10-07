import { describe, expect, it } from "vitest";
import { familyTreeData } from "./mock-data";
import {
  STORAGE_VERSION,
  buildExportFilename,
  parseImportedJson,
  validateStoredTree,
} from "./storage";

const validPayload = {
  version: STORAGE_VERSION,
  persons: familyTreeData.persons,
  unions: familyTreeData.unions,
  relationships: familyTreeData.relationships,
  posOverrides: { ruth: { x: 10, y: 20 } },
};

describe("validateStoredTree (A2)", () => {
  it("acepta el dataset Hawthorne con version vigente", () => {
    expect(validateStoredTree(validPayload)).toEqual({ ok: true, errors: [] });
  });

  it("rechaza version distinta, IDs duplicados y referencias rotas sin crashear", () => {
    expect(validateStoredTree({ ...validPayload, version: 999 }).ok).toBe(false);
    expect(validateStoredTree(null).ok).toBe(false);
    expect(validateStoredTree("hola").ok).toBe(false);

    const dup = {
      ...validPayload,
      persons: [validPayload.persons[0], validPayload.persons[0]],
    };
    const dupRes = validateStoredTree(dup);
    expect(dupRes.ok).toBe(false);
    expect(dupRes.errors.some((e) => e.includes("duplicado"))).toBe(true);

    const brokenUnion = {
      ...validPayload,
      unions: [
        {
          id: "u-x",
          partner1Id: "nadie",
          partner2Id: "tampoco",
          unionType: "marriage",
        },
      ],
    };
    expect(validateStoredTree(brokenUnion).ok).toBe(false);

    const bothParents = {
      ...validPayload,
      relationships: [
        {
          id: "r-x",
          childId: validPayload.persons[0].id,
          unionId: validPayload.unions[0].id,
          singleParentId: validPayload.persons[1].id,
          type: "biological",
        },
      ],
    };
    const bothRes = validateStoredTree(bothParents);
    expect(bothRes.ok).toBe(false);
    expect(bothRes.errors.some((e) => e.includes("excluyentes"))).toBe(true);
  });

  it("rechaza fechas imposibles y muerte anterior al nacimiento", () => {
    const badDate = {
      ...validPayload,
      persons: [
        { ...validPayload.persons[0], birthDate: "2024-02-30" },
        ...validPayload.persons.slice(1),
      ],
    };
    expect(validateStoredTree(badDate).ok).toBe(false);

    const inverted = {
      ...validPayload,
      persons: [
        {
          ...validPayload.persons[0],
          birthDate: "2000-01-02",
          deathDate: "2000-01-01",
        },
        ...validPayload.persons.slice(1),
      ],
    };
    const res = validateStoredTree(inverted);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes("anterior"))).toBe(true);
  });
});

describe("parseImportedJson / export filename", () => {
  it("resume N personas, M uniones al importar válido", () => {
    const res = parseImportedJson(validPayload);
    expect(res.ok).toBe(true);
    expect(res.summary).toEqual({
      persons: validPayload.persons.length,
      unions: validPayload.unions.length,
      relationships: validPayload.relationships.length,
    });
  });

  it("genera arbol-YYYY-MM-DD.json con fecha local", () => {
    expect(buildExportFilename(new Date(2026, 9, 7))).toBe(
      "arbol-2026-10-07.json",
    );
    expect(buildExportFilename()).toMatch(/^arbol-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
