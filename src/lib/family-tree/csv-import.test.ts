import { describe, expect, it } from "vitest";
import { emptyTreeData, familyTreeData } from "./mock-data";
import {
  PERSON_CSV_HEADERS,
  RELATIONSHIP_CSV_HEADERS,
  UNION_CSV_HEADERS,
  personToCsvRow,
  planCsvImport,
  relationshipToCsvRow,
  serializeCsv,
  unionToCsvRow,
} from "./csv";

function hawthorneCsv() {
  return {
    personasText: serializeCsv(
      [...PERSON_CSV_HEADERS],
      familyTreeData.persons.map(personToCsvRow)
    ),
    unionesText: serializeCsv(
      [...UNION_CSV_HEADERS],
      familyTreeData.unions.map(unionToCsvRow)
    ),
    relacionesText: serializeCsv(
      [...RELATIONSHIP_CSV_HEADERS],
      familyTreeData.relationships.map(relationshipToCsvRow)
    ),
  };
}

describe("planCsvImport (C2)", () => {
  it("importa Hawthorne en CSV y reproduce el árbol (aceptación C2)", () => {
    const plan = planCsvImport(hawthorneCsv(), emptyTreeData);
    expect(plan.rejected).toEqual([]);
    expect(plan.applied).toEqual(familyTreeData);
    expect(plan.summary.persons).toEqual({ applied: 16, rejected: 0 });
    expect(plan.summary.unions).toEqual({ applied: 5, rejected: 0 });
    expect(plan.summary.relationships).toEqual({ applied: 10, rejected: 0 });
  });

  it("modo parcial: aplica válidas y reporta línea+campo+motivo", () => {
    const personasText = [
      "id,firstName,lastName,gender,birthDate",
      "p1,Ana,Ruiz,female,1970-05-02",
      "p2,,Ruiz,male,1968-11-19",
      "p3,Sofía,Ruiz,female,2024-02-30",
      "p1,Duplicada,X,female,2000-01-01",
    ].join("\n");
    const unionesText = [
      "id,partner1Id,partner2Id,unionType",
      "u1,p1,p9,marriage",
      "u2,p1,p1,marriage",
      "u3,p1,px,partnership",
    ].join("\n");
    const relacionesText = [
      "id,childId,unionId,singleParentId,type",
      "r1,p1,u1,,biological",
      "r2,p1,u1,u2,biological",
    ].join("\n");
    const plan = planCsvImport(
      { personasText, unionesText, relacionesText },
      emptyTreeData
    );
    // Solo Ana es válida; u1 cae por p9, u2 por auto-pareja, u3 por ref rota.
    expect(plan.applied.persons.map((p) => p.id)).toEqual(["p1"]);
    expect(plan.applied.unions).toEqual([]);
    expect(plan.applied.relationships).toEqual([]);
    const byLine = (file: string, line: number) =>
      plan.rejected.filter((r) => r.file === file && r.line === line);
    expect(byLine("personas", 3)[0]?.field).toBe("firstName");
    expect(byLine("personas", 4)[0]?.field).toBe("birthDate");
    expect(byLine("personas", 5)[0]?.message).toContain("duplicado");
    expect(byLine("uniones", 2)[0]?.field).toBe("partner2Id");
    expect(byLine("uniones", 3)[0]?.message).toContain("distintos");
    expect(byLine("relaciones", 2)[0]?.field).toBe("unionId");
    expect(byLine("relaciones", 3)[0]?.message).toContain("excluyentes");
  });

  it("detecta duplicados contra el árbol actual", () => {
    const plan = planCsvImport(hawthorneCsv(), familyTreeData);
    expect(plan.applied.persons).toEqual([]);
    expect(
      plan.rejected.some((r) => r.message.includes("ya existe en el árbol"))
    ).toBe(true);
  });

  it("falta personas.csv y CSV malformado dan error de archivo", () => {
    const missing = planCsvImport({}, emptyTreeData);
    expect(missing.applied.persons).toEqual([]);
    expect(missing.rejected[0]).toMatchObject({ file: "personas", line: 0 });

    const broken = planCsvImport(
      { personasText: 'id,firstName\n"sin cerrar' },
      emptyTreeData
    );
    expect(broken.applied.persons).toEqual([]);
    expect(broken.rejected[0]?.file).toBe("personas");
    expect(typeof broken.rejected[0]?.line).toBe("number");
  });
});
