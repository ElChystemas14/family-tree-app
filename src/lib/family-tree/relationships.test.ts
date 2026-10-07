import { describe, expect, it } from "vitest";
import type { FamilyTreeData } from "@/types/family-tree";
import { familyTreeData, getFamilyRelationships } from "./mock-data";

describe("getFamilyRelationships con datos vivos (AUD-HIGH-05)", () => {
  it("usa los datos pasados, no el dataset estático", () => {
    const baby = {
      id: "bebe",
      firstName: "Bebé",
      lastName: "Prueba",
      gender: "other" as const,
      birthDate: "2026-01-01",
    };
    const live: FamilyTreeData = {
      persons: [...familyTreeData.persons, baby],
      unions: familyTreeData.unions,
      relationships: [
        ...familyTreeData.relationships,
        {
          id: "r-bebe",
          childId: "bebe",
          unionId: "u-margaret-james",
          type: "biological",
        },
      ],
    };

    const margaretLive = getFamilyRelationships("margaret", live);
    expect(margaretLive.children.some((c) => c.person.id === "bebe")).toBe(
      true
    );

    // Con el dataset estático el bebé no existe.
    const margaretStatic = getFamilyRelationships("margaret");
    expect(margaretStatic.children.some((c) => c.person.id === "bebe")).toBe(
      false
    );
  });

  it("deriva padres de unionId y de singleParentId", () => {
    const solo = {
      id: "solo",
      firstName: "Solo",
      lastName: "Uno",
      gender: "male" as const,
    };
    const hijo = {
      id: "hijito",
      firstName: "Hijo",
      lastName: "Uno",
      gender: "female" as const,
    };
    const live: FamilyTreeData = {
      persons: [solo, hijo],
      unions: [],
      relationships: [
        {
          id: "r-solo",
          childId: "hijito",
          singleParentId: "solo",
          type: "adopted",
        },
      ],
    };
    const fam = getFamilyRelationships("hijito", live);
    expect(fam.parents.map((p) => p.person.id)).toEqual(["solo"]);
    expect(fam.parents[0]?.relationship).toBe("adopted");
  });
});
