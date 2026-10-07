import dagre from "@dagrejs/dagre";
import type {
  ChildRelationship,
  GraphData,
  LayoutMode,
  Person,
  Union,
} from "@/types/family-tree";

/** Nodo con posición calculada por dagre, sin resaltado ni callbacks. */
export interface LayoutPersonNode {
  id: string;
  type: "person";
  position: { x: number; y: number };
  width: number;
  height: number;
  data: {
    id: string;
    firstName: string;
    lastName: string;
    birthDate?: string;
    deathDate?: string;
    gender: Person["gender"];
    photoUrl?: string;
    generation: number;
    layout: LayoutMode;
  };
}

/** Nodo de unión con posición calculada por dagre, sin resaltado. */
export interface LayoutUnionNode {
  id: string;
  type: "union";
  position: { x: number; y: number };
  width: number;
  height: number;
  data: {
    id: string;
    partner1Id: string;
    partner2Id: string;
    layout: LayoutMode;
  };
}

export interface FamilyLayout {
  nodes: Array<LayoutPersonNode | LayoutUnionNode>;
  edges: Array<{ id: string; source: string; target: string }>;
}

export interface SelectionOptions {
  layout: LayoutMode;
  selectedId?: string;
  search?: string;
  onPersonAction?: (
    personId: string,
    action: "parent" | "spouse" | "child"
  ) => void;
  onUnionChild?: (unionId: string) => void;
}

let layoutRuns = 0;

function buildParentsByChild(
  unions: Union[],
  relationships: ChildRelationship[]
): Map<string, string[]> {
  const parentsByChild = new Map<string, string[]>();
  relationships.forEach((relationship) => {
    const union = unions.find((item) => item.id === relationship.unionId);
    parentsByChild.set(
      relationship.childId,
      union
        ? [union.partner1Id, union.partner2Id]
        : relationship.singleParentId
          ? [relationship.singleParentId]
          : []
    );
  });
  return parentsByChild;
}

/**
 * Ejecuta dagre una sola vez por (estructura + modo). El canvas memoiza su
 * resultado excluyendo selección/búsqueda (Fase B5, AUD-MED-04).
 */
export function layoutFamilyToGraph(
  persons: Person[],
  unions: Union[],
  relationships: ChildRelationship[],
  layoutMode: LayoutMode = "vertical"
): FamilyLayout {
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: layoutMode === "vertical" ? "TB" : "LR",
    nodesep: 90,
    ranksep: 150,
    marginx: 80,
    marginy: 70,
  });
  const parentsByChild = buildParentsByChild(unions, relationships);
  const generations = new Map<string, number>();
  const getGeneration = (id: string, visiting = new Set<string>()): number => {
    if (generations.has(id)) return generations.get(id)!;
    if (visiting.has(id)) return 0;
    const parents = parentsByChild.get(id) ?? [];
    const value = parents.length
      ? Math.max(
          ...parents.map((parent) =>
            getGeneration(parent, new Set([...visiting, id]))
          )
        ) + 1
      : 0;
    generations.set(id, value);
    return value;
  };
  persons.forEach((person) => {
    getGeneration(person.id);
    graph.setNode(person.id, { width: 260, height: 116 });
  });
  unions.forEach((union) => {
    graph.setNode(union.id, { width: 22, height: 22 });
    graph.setEdge(union.partner1Id, union.id);
    graph.setEdge(union.partner2Id, union.id);
  });
  relationships.forEach((relationship) => {
    const source = relationship.unionId ?? relationship.singleParentId;
    if (source) graph.setEdge(source, relationship.childId);
  });
  dagre.layout(graph);
  layoutRuns += 1;
  if (process.env.NODE_ENV === "development") {
    console.debug(`[layout] dagre ejecutado (${layoutRuns})`);
  }

  const nodes: FamilyLayout["nodes"] = persons.map((person) => {
    const point = graph.node(person.id);
    return {
      id: person.id,
      type: "person" as const,
      data: {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        birthDate: person.birthDate,
        deathDate: person.deathDate,
        gender: person.gender,
        photoUrl: person.photoUrl,
        generation: generations.get(person.id) ?? 0,
        layout: layoutMode,
      },
      position: { x: point.x - 130, y: point.y - 58 },
      width: 260,
      height: 116,
    };
  });
  const unionNodes: LayoutUnionNode[] = unions.map((union) => {
    const point = graph.node(union.id);
    return {
      id: union.id,
      type: "union" as const,
      data: {
        id: union.id,
        partner1Id: union.partner1Id,
        partner2Id: union.partner2Id,
        layout: layoutMode,
      },
      position: { x: point.x - 11, y: point.y - 11 },
      width: 22,
      height: 22,
    };
  });
  const edges: FamilyLayout["edges"] = [
    ...unions.flatMap((u) => [
      { id: `${u.id}-${u.partner1Id}`, source: u.partner1Id, target: u.id },
      { id: `${u.id}-${u.partner2Id}`, source: u.partner2Id, target: u.id },
    ]),
    ...relationships.map((r) => ({
      id: r.id,
      source: r.unionId ?? r.singleParentId ?? "",
      target: r.childId,
    })),
  ];
  return { nodes: [...nodes, ...unionNodes], edges };
}

/**
 * Deriva resaltado/búsqueda/callbacks sobre un layout ya calculado, sin
 * re-ejecutar dagre. Barato: se re-ejecuta al seleccionar o buscar.
 */
export function withGraphSelection(
  base: FamilyLayout,
  source: { unions: Union[]; relationships: ChildRelationship[] },
  opts: SelectionOptions
): GraphData {
  const { unions, relationships } = source;
  const {
    layout,
    selectedId,
    search = "",
    onPersonAction,
    onUnionChild,
  } = opts;
  const parentsByChild = buildParentsByChild(unions, relationships);
  const ancestors = new Set<string>();
  const descendants = new Set<string>();
  const partners = new Set<string>();
  if (selectedId) {
    const visitParents = (id: string) =>
      (parentsByChild.get(id) ?? []).forEach((parent) => {
        if (!ancestors.has(parent)) {
          ancestors.add(parent);
          visitParents(parent);
        }
      });
    const visitChildren = (id: string) =>
      relationships
        .filter((r) => (parentsByChild.get(r.childId) ?? []).includes(id))
        .forEach((r) => {
          if (!descendants.has(r.childId)) {
            descendants.add(r.childId);
            visitChildren(r.childId);
          }
        });
    visitParents(selectedId);
    visitChildren(selectedId);
    unions
      .filter((u) => u.partner1Id === selectedId || u.partner2Id === selectedId)
      .forEach((u) =>
        partners.add(u.partner1Id === selectedId ? u.partner2Id : u.partner1Id)
      );
  }
  const isHighlighted = (id: string) =>
    !!selectedId &&
    (id === selectedId ||
      ancestors.has(id) ||
      descendants.has(id) ||
      partners.has(id));
  const matchesSearch = (firstName: string, lastName: string) =>
    !!search &&
    `${firstName} ${lastName}`.toLowerCase().includes(search.toLowerCase());

  const nodes: GraphData["nodes"] = base.nodes.map((node) => {
    if (node.type === "union") {
      const highlighted =
        isHighlighted(node.data.partner1Id) ||
        isHighlighted(node.data.partner2Id);
      return {
        ...node,
        data: {
          ...node.data,
          layout,
          isDimmed: !!selectedId && !highlighted,
          isPathHighlighted: highlighted,
          onAddChild: () => onUnionChild?.(node.id),
        },
      };
    }
    return {
      ...node,
      data: {
        ...node.data,
        layout,
        isSelected: node.id === selectedId,
        isSearchFocused: matchesSearch(node.data.firstName, node.data.lastName),
        isDimmed: !!selectedId && !isHighlighted(node.id),
        isPathHighlighted: isHighlighted(node.id),
        onQuickAction: (action: "parent" | "spouse" | "child") =>
          onPersonAction?.(node.id, action),
      },
    };
  });
  const edges: GraphData["edges"] = [
    ...unions.flatMap((u) => [
      {
        id: `${u.id}-${u.partner1Id}`,
        source: u.partner1Id,
        target: u.id,
        animated: isHighlighted(u.partner1Id) && isHighlighted(u.partner2Id),
      },
      {
        id: `${u.id}-${u.partner2Id}`,
        source: u.partner2Id,
        target: u.id,
        animated: isHighlighted(u.partner1Id) && isHighlighted(u.partner2Id),
      },
    ]),
    ...relationships.map((r) => ({
      id: r.id,
      source: r.unionId ?? r.singleParentId ?? "",
      target: r.childId,
      animated: isHighlighted(r.childId),
    })),
  ];
  return { nodes, edges };
}

export function transformFamilyToGraph(
  persons: Person[],
  unions: Union[],
  relationships: ChildRelationship[],
  layout: LayoutMode = "vertical",
  selectedId?: string,
  onPersonAction?: (
    personId: string,
    action: "parent" | "spouse" | "child"
  ) => void,
  onUnionChild?: (unionId: string) => void
): GraphData {
  return withGraphSelection(
    layoutFamilyToGraph(persons, unions, relationships, layout),
    { unions, relationships },
    { layout, selectedId, search: "", onPersonAction, onUnionChild }
  );
}
