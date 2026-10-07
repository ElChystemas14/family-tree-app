import { describe, expect, it } from "vitest";
import type { FamilyTreeData, Person } from "@/types/family-tree";
import { emptyTreeData, familyTreeData } from "./mock-data";
import {
  applyAddPerson,
  applyConnectUnion,
  applyRemovePerson,
  applyUpdatePerson,
  getParentIds,
  isAncestorOf,
} from "./store";

const solo: Person = {
  id: "solo",
  firstName: "Solo",
  lastName: "Uno",
  gender: "male",
};
const otra: Person = {
  id: "otra",
  firstName: "Otra",
  lastName: "Dos",
  gender: "female",
};
const empty: FamilyTreeData = {
  persons: [solo, otra],
  unions: [],
  relationships: [],
};

describe("applyAddPerson (B1)", () => {
  it("crea la primera persona desde el árbol vacío (B6)", () => {
    expect(emptyTreeData.persons).toHaveLength(0);
    const { state, result } = applyAddPerson(emptyTreeData, {
      personInput: {
        firstName: "Primera",
        lastName: "Persona",
        gender: "female",
      },
    });
    expect(result.ok).toBe(true);
    expect(result.person?.id).toBeTruthy();
    expect(state.persons).toHaveLength(1);
    expect(state.unions).toHaveLength(0);
    expect(state.relationships).toHaveLength(0);
  });

  it("crea persona suelta sin relaciones", () => {
    const { state, result } = applyAddPerson(empty, {
      personInput: {
        firstName: solo.firstName,
        lastName: solo.lastName,
        gender: solo.gender,
      },
    });
    expect(result.ok).toBe(true);
    expect(state.persons).toHaveLength(3);
  });

  it("crea pareja con unión marriage y rechaza duplicados o auto-pareja", () => {
    const first = applyAddPerson(empty, {
      personInput: solo,
      relationship: "spouse",
      anchorId: "otra",
    });
    expect(first.result.ok).toBe(true);
    expect(first.state.unions).toHaveLength(1);
    expect(first.state.unions[0]?.unionType).toBe("marriage");

    const dup = applyAddPerson(first.state, {
      personInput: solo,
      existingId: first.state.persons[2]?.id,
      relationship: "spouse",
      anchorId: "otra",
    });
    expect(dup.result.ok).toBe(false);
    expect(dup.result.error).toContain("ya son pareja");

    const self = applyAddPerson(empty, {
      personInput: solo,
      existingId: "solo",
      relationship: "spouse",
      anchorId: "solo",
    });
    expect(self.result.ok).toBe(false);
  });

  it("solo selecciona al vincular existente sin relación", () => {
    const { state, result } = applyAddPerson(empty, {
      personInput: solo,
      existingId: "otra",
    });
    expect(result.ok).toBe(true);
    expect(result.selectOnly).toBe(true);
    expect(result.person?.id).toBe("otra");
    expect(state).toBe(empty);
  });

  it("bloquea segundos padres para quien ya los tiene", () => {
    const res = applyAddPerson(familyTreeData, {
      personInput: solo,
      relationship: "parent",
      anchorId: "lucy",
    });
    expect(res.result.ok).toBe(false);
    expect(res.result.error).toContain("ya tiene padres");
  });
});

describe("applyConnectUnion / parentesco (B1)", () => {
  it("conecta ramas y bloquea parientes directos", () => {
    const ok = applyConnectUnion(empty, "solo", "otra");
    expect(ok.result.ok).toBe(true);
    expect(ok.state.unions).toHaveLength(1);

    const blocked = applyConnectUnion(familyTreeData, "margaret", "lucy");
    expect(blocked.result.ok).toBe(false);
    expect(blocked.result.error).toContain("parientes directos");
  });

  it("getParentIds e isAncestorOf con uniones y monoparental", () => {
    expect(
      getParentIds("lucy", familyTreeData.unions, familyTreeData.relationships)
    ).toContain("margaret");
    expect(
      isAncestorOf(
        "ruth",
        "lucy",
        familyTreeData.unions,
        familyTreeData.relationships
      )
    ).toBe(true);
    expect(
      isAncestorOf(
        "lucy",
        "ruth",
        familyTreeData.unions,
        familyTreeData.relationships
      )
    ).toBe(false);
  });
});

describe("applyRemovePerson / applyUpdatePerson (B1)", () => {
  it("bloquea borrar con pareja/hijos y permite persona suelta", () => {
    const blocked = applyRemovePerson(familyTreeData, "margaret");
    expect(blocked.result.ok).toBe(false);
    expect(blocked.result.error).toContain("desvincula");

    const withSolo = {
      ...empty,
      persons: [...empty.persons, { ...solo, id: "suelta" }],
    };
    const ok = applyRemovePerson(withSolo, "suelta");
    expect(ok.result.ok).toBe(true);
    expect(ok.state.persons.some((p) => p.id === "suelta")).toBe(false);
  });

  it("actualiza datos sin tocar conexiones", () => {
    const updated = { ...solo, firstName: "Soloedit" };
    const { state, result } = applyUpdatePerson(empty, updated);
    expect(result.ok).toBe(true);
    expect(state.persons.find((p) => p.id === "solo")?.firstName).toBe(
      "Soloedit"
    );
    expect(applyUpdatePerson(empty, { ...solo, id: "nadie" }).result.ok).toBe(
      false
    );
  });
});
