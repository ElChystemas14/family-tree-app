import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { familyTreeData } from "./mock-data";
import { validateFamilyTreeData } from "./schema";
import {
  CsvParseError,
  buildCsvFilename,
  buildPersonTemplate,
  buildRelationshipTemplate,
  buildUnionTemplate,
  hasLivingPersons,
  parseCsvText,
  personToCsvRow,
  personsFromCsvRows,
  relationshipToCsvRow,
  relationshipsFromCsvRows,
  serializeCsv,
  unionToCsvRow,
  unionsFromCsvRows,
} from "./csv";

describe("parseCsvText (C1)", () => {
  it("parsea cabecera, comillas, comas internas y CRLF+BOM", () => {
    const text =
      '﻿id,firstName,bio\r\np1,Ana,"Madre, de Sofía"\r\np2,Luis,"Dice ""hola"""\r\n';
    const parsed = parseCsvText(text);
    expect(parsed.delimiter).toBe(",");
    expect(parsed.headers).toEqual(["id", "firstName", "bio"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toEqual({
      line: 2,
      values: { id: "p1", firstName: "Ana", bio: "Madre, de Sofía" },
    });
    expect(parsed.rows[1]?.values.bio).toBe('Dice "hola"');
  });

  it("autodetecta ; (Excel ES) e ignora líneas vacías", () => {
    const parsed = parseCsvText("id;firstName\n\np1;Ana\n");
    expect(parsed.delimiter).toBe(";");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toEqual({
      line: 3,
      values: { id: "p1", firstName: "Ana" },
    });
  });

  it("rechaza comilla sin cerrar y CSV sin cabecera", () => {
    expect(() => parseCsvText('id\n"abc')).toThrow(CsvParseError);
    expect(() => parseCsvText("")).toThrow(CsvParseError);
  });
});

describe("serializeCsv (C1)", () => {
  it("entrecomilla comas, comillas y saltos (round-trip)", () => {
    const headers = ["id", "bio"];
    const rows = [{ id: "p1", bio: 'Madre, dice "hola"\ny adiós' }];
    const text = serializeCsv(headers, rows);
    const back = parseCsvText(text);
    expect(back.rows[0]?.values).toEqual(rows[0]);
  });
});

describe("mapeo Hawthorne ↔ CSV (C1)", () => {
  it("serializa y reimporta el dataset idéntico", () => {
    const personsCsv = serializeCsv(
      [
        "id",
        "firstName",
        "lastName",
        "gender",
        "birthDate",
        "deathDate",
        "photoUrl",
        "bio",
        "attributes",
      ],
      familyTreeData.persons.map(personToCsvRow)
    );
    const parsed = parseCsvText(personsCsv);
    const back = personsFromCsvRows(parsed.rows.map((r) => r.values));
    expect(back).toEqual(familyTreeData.persons);

    const unionsCsv = serializeCsv(
      ["id", "partner1Id", "partner2Id", "unionType", "startDate", "endDate"],
      familyTreeData.unions.map(unionToCsvRow)
    );
    expect(
      unionsFromCsvRows(parseCsvText(unionsCsv).rows.map((r) => r.values))
    ).toEqual(familyTreeData.unions);

    const relsCsv = serializeCsv(
      ["id", "childId", "unionId", "singleParentId", "type"],
      familyTreeData.relationships.map(relationshipToCsvRow)
    );
    const rels = relationshipsFromCsvRows(
      parseCsvText(relsCsv).rows.map((r) => r.values)
    );
    expect(rels).toEqual(familyTreeData.relationships);
    expect(
      validateFamilyTreeData({
        persons: back,
        unions: unionsFromCsvRows(
          parseCsvText(unionsCsv).rows.map((r) => r.values)
        ),
        relationships: rels,
      }).ok
    ).toBe(true);
  });
});

describe("plantillas v1.0 (C1)", () => {
  it("public/ es byte-idéntico a los builders", () => {
    expect(readFileSync("public/plantilla-personas.csv", "utf8")).toBe(
      buildPersonTemplate()
    );
    expect(readFileSync("public/plantilla-uniones.csv", "utf8")).toBe(
      buildUnionTemplate()
    );
    expect(readFileSync("public/plantilla-relaciones.csv", "utf8")).toBe(
      buildRelationshipTemplate()
    );
  });

  it("las plantillas importan sin errores en árbol vacío", () => {
    const persons = personsFromCsvRows(
      parseCsvText(buildPersonTemplate()).rows.map((r) => r.values)
    );
    const unions = unionsFromCsvRows(
      parseCsvText(buildUnionTemplate()).rows.map((r) => r.values)
    );
    const relationships = relationshipsFromCsvRows(
      parseCsvText(buildRelationshipTemplate()).rows.map((r) => r.values)
    );
    expect(persons).toHaveLength(3);
    const result = validateFamilyTreeData({ persons, unions, relationships });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("exportación CSV espejo (C3)", () => {
  it("nombres personas|uniones|relaciones-AAAA-MM-DD.csv con fecha local", () => {
    expect(buildCsvFilename("personas", new Date(2026, 9, 7))).toBe(
      "personas-2026-10-07.csv"
    );
    expect(buildCsvFilename("uniones")).toMatch(
      /^uniones-\d{4}-\d{2}-\d{2}\.csv$/
    );
    expect(buildCsvFilename("relaciones")).toMatch(
      /^relaciones-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });

  it("detecta personas vivas para el aviso de privacidad", () => {
    expect(hasLivingPersons(familyTreeData.persons)).toBe(true);
    expect(
      hasLivingPersons(familyTreeData.persons.filter((p) => p.deathDate))
    ).toBe(false);
    expect(hasLivingPersons([])).toBe(false);
  });
});
