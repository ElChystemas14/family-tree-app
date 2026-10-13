import { describe, expect, it } from "vitest";
import {
  loadActiveTreeId,
  loadSyncClock,
  mergeCollection,
  mergeTrees,
  parseSyncClock,
  saveActiveTreeId,
  saveSyncClock,
} from "./clock";
import {
  personToCsvRow,
  personsFromCsvRows,
  serializeCsv,
  PERSON_CSV_HEADERS,
} from "../family-tree/csv";
import { familyTreeData } from "../family-tree/mock-data";
import {
  personToRow,
  relationshipToRow,
  rowToPerson,
  rowToRelationship,
  rowToUnion,
  unionToRow,
} from "./mapping";

const T0 = "2026-10-01T00:00:00.000Z";
const T1 = "2026-10-08T00:00:00.000Z";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe("sync clock (E2)", () => {
  it("parsea reloj vacío y con tumbas", () => {
    expect(parseSyncClock(null)).toEqual({ rows: {}, deleted: {} });
    expect(
      parseSyncClock({ rows: { a: T0 }, deleted: { b: T1 }, extra: 1 })
    ).toEqual({ rows: { a: T0 }, deleted: { b: T1 }, pulledAt: undefined });
  });

  it("persiste por árbol en storage", () => {
    const storage = memoryStorage();
    expect(loadSyncClock("t1", storage)).toEqual({ rows: {}, deleted: {} });
    saveSyncClock("t1", { rows: { a: T0 }, deleted: { b: T1 } }, storage);
    expect(loadSyncClock("t1", storage)).toEqual({
      rows: { a: T0 },
      deleted: { b: T1 },
      pulledAt: undefined,
    });
    expect(loadSyncClock("otro", storage).rows).toEqual({});
  });

  it("recuerda el árbol activo", () => {
    const storage = memoryStorage();
    expect(loadActiveTreeId(storage)).toBeNull();
    saveActiveTreeId("t1", storage);
    expect(loadActiveTreeId(storage)).toBe("t1");
    saveActiveTreeId(null, storage);
    expect(loadActiveTreeId(storage)).toBeNull();
  });

  it("merge por fila: gana updatedAt mayor, en empate lo remoto", () => {
    const local = [{ id: "a", v: 1 }];
    const newer = [{ id: "a", updatedAt: T1, value: { id: "a", v: 2 } }];
    const res = mergeCollection(local, (x) => x.id, newer, { a: T0 }, T1);
    expect(res.merged).toEqual([{ id: "a", v: 2 }]);

    const older = [{ id: "a", updatedAt: T0, value: { id: "a", v: 0 } }];
    const res2 = mergeCollection(local, (x) => x.id, older, { a: T1 }, T1);
    expect(res2.merged).toEqual([{ id: "a", v: 1 }]);

    const tie = [{ id: "a", updatedAt: T1, value: { id: "a", v: 9 } }];
    expect(
      mergeCollection(local, (x) => x.id, tie, { a: T1 }, T1).merged
    ).toEqual([{ id: "a", v: 9 }]);
  });

  it("conserva filas solo-locales y solo-remotas", () => {
    const res = mergeCollection(
      [{ id: "a" }],
      (x) => x.id,
      [{ id: "b", updatedAt: T0, value: { id: "b" } }],
      {},
      T1
    );
    expect(res.merged).toEqual([{ id: "a" }, { id: "b" }]);
    expect(res.clock).toEqual({ a: T1, b: T0 });
  });

  it("las tumbas impiden resurrecciones", () => {
    const merged = mergeTrees(
      { persons: [], unions: [], relationships: [] },
      {
        persons: [
          { id: "x", updatedAt: T1, value: familyTreeData.persons[0]! },
        ],
        unions: [],
        relationships: [],
      },
      { rows: {}, deleted: { x: T1 } },
      T1
    );
    expect(merged.merged.persons).toEqual([]);
    expect(merged.changed).toBe(false);
  });
});

describe("mapping app ↔ Supabase (E2)", () => {
  it("persona/unión/relación sobreviven al round-trip", () => {
    const person = familyTreeData.persons[0]!;
    expect(rowToPerson(personToRow(person, "t", T0))).toEqual(person);
    const union = familyTreeData.unions[0]!;
    expect(rowToUnion(unionToRow(union, "t", T0))).toEqual(union);
    const rel = familyTreeData.relationships[0]!;
    expect(rowToRelationship(relationshipToRow(rel, "t", T0))).toEqual(rel);
  });

  it("normaliza vacíos a null y enums desconocidos", () => {
    const row = personToRow(
      {
        id: "x",
        firstName: "A",
        lastName: "B",
        gender: "other",
      },
      "t",
      T0
    );
    expect(row.birth_date).toBeNull();
    expect(row.attributes).toEqual({});
    expect(rowToPerson({ ...row, gender: "x" }).gender).toBe("other");
  });

  it("encaja con el CSV v1.0 (nombres ↔ snake_case)", () => {
    // La misma persona serializa igual vía CSV y vía Supabase.
    const person = familyTreeData.persons[4]!;
    const csv = serializeCsv([...PERSON_CSV_HEADERS], [personToCsvRow(person)]);
    expect(csv).toContain("Margaret");
    const back = personsFromCsvRows([
      { id: person.id, firstName: "Margaret", lastName: "Hawthorne" },
    ]);
    expect(back[0]).toMatchObject({ id: person.id, firstName: "Margaret" });
  });
});
