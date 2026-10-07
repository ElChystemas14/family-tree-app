import { describe, expect, it } from "vitest";
import type { FamilyTreeData } from "@/types/family-tree";
import { familyTreeData } from "./mock-data";
import { transformFamilyToGraph } from "./transform";

const { persons, unions, relationships } = familyTreeData;

type TestGraph = ReturnType<typeof transformFamilyToGraph>;

function personData(graph: TestGraph, id: string) {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node || !("generation" in node.data))
    throw new Error(`no es persona: ${id}`);
  return node.data;
}

function generationOf(graph: TestGraph, id: string): number {
  return personData(graph, id).generation;
}

describe("transformFamilyToGraph (B2)", () => {
  it("genera nodos y aristas esperados del dataset Hawthorne", () => {
    const graph = transformFamilyToGraph(
      persons,
      unions,
      relationships,
      "vertical"
    );
    // 16 personas + 5 uniones; aristas: 5 uniones × 2 + 10 relaciones.
    expect(graph.nodes).toHaveLength(21);
    expect(graph.edges).toHaveLength(20);
    const lucyEdge = graph.edges.find((e) => e.id === "r-lucy");
    expect(lucyEdge).toMatchObject({
      source: "u-margaret-thomas",
      target: "lucy",
    });
  });

  it("calcula generaciones por linaje", () => {
    const graph = transformFamilyToGraph(
      persons,
      unions,
      relationships,
      "vertical"
    );
    expect(generationOf(graph, "ruth")).toBe(0);
    expect(generationOf(graph, "walter")).toBe(0);
    expect(generationOf(graph, "james")).toBe(0); // sin padres registrados
    expect(generationOf(graph, "margaret")).toBe(1);
    expect(generationOf(graph, "thomas")).toBe(1);
    expect(generationOf(graph, "lucy")).toBe(2);
    expect(generationOf(graph, "olivia")).toBe(2);
    expect(generationOf(graph, "nora")).toBe(2);
    expect(generationOf(graph, "clara")).toBe(2);
  });

  it("resalta linaje del seleccionado y atenúa el resto", () => {
    const graph = transformFamilyToGraph(
      persons,
      unions,
      relationships,
      "vertical",
      "lucy"
    );
    expect(personData(graph, "lucy").isSelected).toBe(true);
    expect(personData(graph, "ruth").isPathHighlighted).toBe(true);
    expect(personData(graph, "clara").isDimmed).toBe(true);
  });

  it("soporta relaciones monoparentales", () => {
    const data: FamilyTreeData = {
      persons,
      unions,
      relationships: [
        ...relationships,
        {
          id: "r-solo",
          childId: "henry",
          singleParentId: "james",
          type: "step",
        },
      ],
    };
    const graph = transformFamilyToGraph(
      data.persons,
      data.unions,
      data.relationships,
      "vertical"
    );
    const edge = graph.edges.find((e) => e.id === "r-solo");
    expect(edge).toMatchObject({ source: "james", target: "henry" });
  });

  it("no se cuelga ante ciclos (anti-ciclos)", () => {
    const cyclic: FamilyTreeData = {
      persons,
      unions: [
        ...unions,
        {
          id: "u-ciclo",
          partner1Id: "lucy",
          partner2Id: "ben",
          unionType: "partnership",
        },
      ],
      relationships: [
        ...relationships,
        {
          id: "r-ciclo",
          childId: "lucy",
          unionId: "u-ciclo",
          type: "biological",
        },
      ],
    };
    const graph = transformFamilyToGraph(
      cyclic.persons,
      cyclic.unions,
      cyclic.relationships,
      "vertical"
    );
    expect(graph.nodes).toHaveLength(22);
    expect(generationOf(graph, "lucy")).toBeGreaterThanOrEqual(0);
  });

  it("layout horizontal produce el mismo grafo con posiciones distintas", () => {
    const vertical = transformFamilyToGraph(
      persons,
      unions,
      relationships,
      "vertical"
    );
    const horizontal = transformFamilyToGraph(
      persons,
      unions,
      relationships,
      "horizontal"
    );
    expect(horizontal.nodes).toHaveLength(vertical.nodes.length);
    const vRuth = vertical.nodes.find((n) => n.id === "ruth");
    const hRuth = horizontal.nodes.find((n) => n.id === "ruth");
    expect(hRuth?.position).not.toEqual(vRuth?.position);
  });
});
