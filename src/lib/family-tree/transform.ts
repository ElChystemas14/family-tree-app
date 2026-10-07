import dagre from "@dagrejs/dagre";
import type {
  ChildRelationship,
  GraphData,
  LayoutMode,
  Person,
  Union,
} from "@/types/family-tree";

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
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: layout === "vertical" ? "TB" : "LR",
    nodesep: 90,
    ranksep: 150,
    marginx: 80,
    marginy: 70,
  });
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
  const nodes = persons.map((person) => {
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
        layout,
        isSelected: person.id === selectedId,
        isSearchFocused: false,
        isDimmed: !!selectedId && !isHighlighted(person.id),
        isPathHighlighted: isHighlighted(person.id),
        onQuickAction: (action: "parent" | "spouse" | "child") =>
          onPersonAction?.(person.id, action),
      },
      position: { x: point.x - 130, y: point.y - 58 },
      width: 260,
      height: 116,
    };
  });
  const unionNodes = unions.map((union) => {
    const point = graph.node(union.id);
    const highlighted =
      isHighlighted(union.partner1Id) || isHighlighted(union.partner2Id);
    return {
      id: union.id,
      type: "union" as const,
      data: {
        id: union.id,
        partner1Id: union.partner1Id,
        partner2Id: union.partner2Id,
        layout,
        isDimmed: !!selectedId && !highlighted,
        isPathHighlighted: highlighted,
        onAddChild: () => onUnionChild?.(union.id),
      },
      position: { x: point.x - 11, y: point.y - 11 },
      width: 22,
      height: 22,
    };
  });
  const edges = [
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
  return { nodes: [...nodes, ...unionNodes], edges };
}
