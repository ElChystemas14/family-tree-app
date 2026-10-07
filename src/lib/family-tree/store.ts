/**
 * Store del árbol genealógico (Fase B1).
 *
 * - Las acciones son funciones puras (`apply*`): reciben el estado y devuelven
 *   el estado nuevo + resultado. Los IDs se generan fuera de los setters de
 *   React y nunca hay `setState` dentro de updaters.
 * - `useFamilyTree` es la envoltura React (hook) que usa el canvas.
 * - La persistencia sigue desacoplada: el canvas suscribe `data`/`posOverrides`
 *   y guarda/carga (A2) sin que el store sepa de `localStorage`.
 */

import { useCallback, useState } from "react";
import type {
  ChildRelationship,
  FamilyTreeData,
  LayoutMode,
  Person,
  Union,
} from "@/types/family-tree";
import { familyTreeData } from "./mock-data";
import type { PosOverrides } from "./storage";

export function getParentIds(
  childId: string,
  unions: Union[],
  relationships: ChildRelationship[]
): string[] {
  const ids = new Set<string>();
  relationships
    .filter((rel) => rel.childId === childId)
    .forEach((rel) => {
      const union = rel.unionId
        ? unions.find((item) => item.id === rel.unionId)
        : undefined;
      if (union) {
        ids.add(union.partner1Id);
        ids.add(union.partner2Id);
      } else if (rel.singleParentId) ids.add(rel.singleParentId);
    });
  return [...ids];
}

export function isAncestorOf(
  ancestorId: string,
  descendantId: string,
  unions: Union[],
  relationships: ChildRelationship[]
): boolean {
  const visited = new Set<string>([descendantId]);
  const queue = [descendantId];
  while (queue.length) {
    const current = queue.pop()!;
    const parents = getParentIds(current, unions, relationships);
    if (parents.includes(ancestorId)) return true;
    parents.forEach((parent) => {
      if (!visited.has(parent)) {
        visited.add(parent);
        queue.push(parent);
      }
    });
  }
  return false;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface AddPersonResult extends ActionResult {
  /** Persona creada o vinculada (solo si `ok`). */
  person?: Person;
  /** `true` cuando solo hay que seleccionar (vincular sin relación). */
  selectOnly?: boolean;
}

export interface AddPersonArgs {
  personInput: Omit<Person, "id">;
  existingId?: string;
  relationship?: "parent" | "spouse" | "child";
  anchorId?: string;
  unionId?: string;
}

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

/** Añadir persona o vincular existente (reglas actuales del canvas). */
export function applyAddPerson(
  state: FamilyTreeData,
  args: AddPersonArgs
): { state: FamilyTreeData; result: AddPersonResult } {
  const { personInput, existingId, relationship, anchorId, unionId } = args;
  const personId = existingId ?? newId("person");
  const person = existingId
    ? state.persons.find((item) => item.id === existingId)
    : { ...personInput, id: personId };
  if (!person)
    return { state, result: { ok: false, error: "La persona no existe." } };
  if (existingId && !relationship)
    return { state, result: { ok: true, person, selectOnly: true } };

  let unions = [...state.unions];
  let relationships = [...state.relationships];

  if (relationship === "spouse" && anchorId) {
    if (personId === anchorId)
      return {
        state,
        result: {
          ok: false,
          error: "Una persona no puede ser pareja de sí misma.",
        },
      };
    if (
      unions.some(
        (item) =>
          [item.partner1Id, item.partner2Id].includes(anchorId) &&
          [item.partner1Id, item.partner2Id].includes(personId)
      )
    )
      return {
        state,
        result: { ok: false, error: "Estas personas ya son pareja." },
      };
    unions = [
      ...unions,
      {
        id: newId("union"),
        partner1Id: anchorId,
        partner2Id: personId,
        unionType: "marriage",
      },
    ];
  }
  if (relationship === "parent" && anchorId) {
    if (personId === anchorId)
      return {
        state,
        result: {
          ok: false,
          error: "Una persona no puede ser su propio padre/madre.",
        },
      };
    if (getParentIds(anchorId, state.unions, state.relationships).length > 0)
      return {
        state,
        result: {
          ok: false,
          error: "Esta persona ya tiene padres registrados.",
        },
      };
    const childUnionId = newId("union");
    unions = [
      ...unions,
      {
        id: childUnionId,
        partner1Id: personId,
        partner2Id: anchorId,
        unionType: "partnership",
      },
    ];
    relationships = [
      ...relationships,
      {
        id: newId("rel"),
        childId: anchorId,
        unionId: childUnionId,
        type: "biological",
      },
    ];
  }
  if (relationship === "child" && (anchorId || unionId)) {
    if (anchorId && personId === anchorId)
      return {
        state,
        result: {
          ok: false,
          error: "Una persona no puede ser su propio hijo/a.",
        },
      };
    if (getParentIds(personId, state.unions, state.relationships).length > 0)
      return {
        state,
        result: {
          ok: false,
          error: "Esta persona ya tiene padres registrados.",
        },
      };
    const union = unionId
      ? unions.find((item) => item.id === unionId)
      : unions.find(
          (item) => item.partner1Id === anchorId || item.partner2Id === anchorId
        );
    if (unionId && !union)
      return {
        state,
        result: { ok: false, error: "La unión seleccionada ya no existe." },
      };
    relationships = [
      ...relationships,
      {
        id: newId("rel"),
        childId: personId,
        unionId: union?.id,
        singleParentId: !union && anchorId ? anchorId : undefined,
        type: "biological",
      },
    ];
  }

  const persons = existingId ? state.persons : [...state.persons, person];
  return {
    state: { persons, unions, relationships },
    result: { ok: true, person },
  };
}

/** Conectar dos ramas con una unión de pareja (reglas actuales del canvas). */
export function applyConnectUnion(
  state: FamilyTreeData,
  sourceId: string,
  targetId: string
): { state: FamilyTreeData; result: ActionResult } {
  if (sourceId === targetId)
    return {
      state,
      result: {
        ok: false,
        error: "Una persona no puede vincularse consigo misma.",
      },
    };
  if (
    state.unions.some(
      (union) =>
        [union.partner1Id, union.partner2Id].includes(sourceId) &&
        [union.partner1Id, union.partner2Id].includes(targetId)
    )
  )
    return {
      state,
      result: { ok: false, error: "Estas personas ya están conectadas." },
    };
  if (
    isAncestorOf(sourceId, targetId, state.unions, state.relationships) ||
    isAncestorOf(targetId, sourceId, state.unions, state.relationships)
  )
    return {
      state,
      result: {
        ok: false,
        error: "No se puede crear una unión entre parientes directos.",
      },
    };
  const union: Union = {
    id: newId("union"),
    partner1Id: sourceId,
    partner2Id: targetId,
    unionType: "partnership",
  };
  return {
    state: { ...state, unions: [...state.unions, union] },
    result: { ok: true },
  };
}

/** Eliminar/desvincular persona (bloqueado si tiene pareja o hijos). */
export function applyRemovePerson(
  state: FamilyTreeData,
  personId: string
): { state: FamilyTreeData; result: ActionResult } {
  const hasPartners = state.unions.some(
    (union) => union.partner1Id === personId || union.partner2Id === personId
  );
  const hasChildren = state.relationships.some((rel) =>
    getParentIds(rel.childId, state.unions, state.relationships).includes(
      personId
    )
  );
  if (hasPartners || hasChildren)
    return {
      state,
      result: {
        ok: false,
        error: "No se puede eliminar: primero desvincula a su pareja e hijos.",
      },
    };
  return {
    state: {
      persons: state.persons.filter((person) => person.id !== personId),
      unions: state.unions.filter(
        (union) =>
          union.partner1Id !== personId && union.partner2Id !== personId
      ),
      relationships: state.relationships.filter(
        (rel) => rel.childId !== personId
      ),
    },
    result: { ok: true },
  };
}

/** Actualizar datos básicos de una persona (sin tocar conexiones). */
export function applyUpdatePerson(
  state: FamilyTreeData,
  updated: Person
): { state: FamilyTreeData; result: ActionResult } {
  if (!state.persons.some((person) => person.id === updated.id))
    return {
      state,
      result: { ok: false, error: "La persona no existe." },
    };
  return {
    state: {
      ...state,
      persons: state.persons.map((person) =>
        person.id === updated.id ? updated : person
      ),
    },
    result: { ok: true },
  };
}

export interface FamilyTreeStore {
  data: FamilyTreeData;
  posOverrides: PosOverrides;
  layout: LayoutMode;
  addPerson: (args: AddPersonArgs) => AddPersonResult;
  connectUnion: (sourceId: string, targetId: string) => ActionResult;
  removePerson: (personId: string) => ActionResult;
  updatePerson: (updated: Person) => ActionResult;
  moveNode: (nodeId: string, position: { x: number; y: number }) => void;
  setLayout: (mode: LayoutMode) => void;
  importData: (tree: FamilyTreeData, overrides?: PosOverrides) => void;
}

/** Hook React del store: estado + acciones. Persistencia desacoplada (A2). */
export function useFamilyTree(
  initial: FamilyTreeData = familyTreeData
): FamilyTreeStore {
  const [data, setData] = useState<FamilyTreeData>(initial);
  const [posOverrides, setPosOverrides] = useState<PosOverrides>({});
  const [layout, setLayoutState] = useState<LayoutMode>("vertical");

  const addPerson = useCallback(
    (args: AddPersonArgs): AddPersonResult => {
      const { state, result } = applyAddPerson(data, args);
      if (result.ok && state !== data) setData(state);
      return result;
    },
    [data]
  );

  const connectUnion = useCallback(
    (sourceId: string, targetId: string): ActionResult => {
      const { state, result } = applyConnectUnion(data, sourceId, targetId);
      if (result.ok) setData(state);
      return result;
    },
    [data]
  );

  const removePerson = useCallback(
    (personId: string): ActionResult => {
      const { state, result } = applyRemovePerson(data, personId);
      if (result.ok) setData(state);
      return result;
    },
    [data]
  );

  const updatePerson = useCallback(
    (updated: Person): ActionResult => {
      const { state, result } = applyUpdatePerson(data, updated);
      if (result.ok) setData(state);
      return result;
    },
    [data]
  );

  const moveNode = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      setPosOverrides((prev) => ({ ...prev, [nodeId]: position }));
    },
    []
  );

  const setLayout = useCallback((mode: LayoutMode) => {
    setPosOverrides({});
    setLayoutState(mode);
  }, []);

  const importData = useCallback(
    (tree: FamilyTreeData, overrides: PosOverrides = {}) => {
      setData({
        persons: tree.persons,
        unions: tree.unions,
        relationships: tree.relationships,
      });
      setPosOverrides(overrides);
    },
    []
  );

  const store: FamilyTreeStore = {
    data,
    posOverrides,
    layout,
    addPerson,
    connectUnion,
    removePerson,
    updatePerson,
    moveNode,
    setLayout,
    importData,
  };
  return store;
}
