/**
 * Reloj de sincronización + merge last-write-wins por fila (Fase E2).
 *
 * El modelo local no lleva `updated_at`; este módulo lo recuerda por id
 * (`rowClocks`) y lo persiste en `localStorage`. Al fusionar, gana el
 * `updated_at` mayor; en empate gana lo remoto (convergencia).
 */

import type { FamilyTreeData } from "@/types/family-tree";

export const SYNC_CLOCK_KEY = "hawthorne-sync-v1";
export const ACTIVE_TREE_KEY = "hawthorne-active-tree";

export function loadActiveTreeId(
  storage?: Pick<Storage, "getItem">
): string | null {
  const store =
    storage ??
    (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return null;
  try {
    return store.getItem(ACTIVE_TREE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveTreeId(
  treeId: string | null,
  storage?: Pick<Storage, "setItem" | "removeItem">
): void {
  const store =
    storage ??
    (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return;
  try {
    if (treeId) store.setItem(ACTIVE_TREE_KEY, treeId);
    else store.removeItem(ACTIVE_TREE_KEY);
  } catch {
    // Sin persistencia el sync sigue funcionando en memoria.
  }
}

export type RowClocks = Record<string, string>;

export interface SyncClock {
  rows: RowClocks;
  /** Ids eliminados en local pendientes de borrar en remoto (anti-zombis). */
  deleted: RowClocks;
  pulledAt?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRowMap(value: unknown): RowClocks {
  const rows: RowClocks = {};
  if (isRecord(value)) {
    for (const [id, entry] of Object.entries(value)) {
      if (typeof entry === "string") rows[id] = entry;
    }
  }
  return rows;
}

function emptyClock(): SyncClock {
  return { rows: {}, deleted: {} };
}

export function parseSyncClock(raw: unknown): SyncClock {
  if (!isRecord(raw)) return emptyClock();
  return {
    rows: parseRowMap(raw.rows),
    deleted: parseRowMap(raw.deleted),
    pulledAt: typeof raw.pulledAt === "string" ? raw.pulledAt : undefined,
  };
}

export function loadSyncClock(
  treeId: string,
  storage?: Pick<Storage, "getItem">
): SyncClock {
  const store =
    storage ??
    (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return emptyClock();
  try {
    const rawText = store.getItem(`${SYNC_CLOCK_KEY}:${treeId}`);
    if (!rawText) return emptyClock();
    return parseSyncClock(JSON.parse(rawText));
  } catch {
    return emptyClock();
  }
}

export function saveSyncClock(
  treeId: string,
  clock: SyncClock,
  storage?: Pick<Storage, "setItem">
): void {
  const store =
    storage ??
    (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return;
  try {
    store.setItem(`${SYNC_CLOCK_KEY}:${treeId}`, JSON.stringify(clock));
  } catch {
    // Cupo lleno o modo privado: el sync sigue funcionando en memoria.
  }
}

export interface RemoteRow<T> {
  id: string;
  updatedAt: string;
  value: T;
}

export interface MergeResult<T> {
  merged: T[];
  clock: RowClocks;
}

/**
 * Fusiona una colección local con la remota por id. Gana `updatedAt` mayor;
 * en empate, lo remoto. Devuelve el reloj actualizado.
 */
export function mergeCollection<T>(
  local: T[],
  getId: (item: T) => string,
  remote: RemoteRow<T>[],
  clock: RowClocks,
  now: string
): MergeResult<T> {
  const remoteById = new Map(remote.map((row) => [row.id, row]));
  const merged: T[] = [];
  const nextClock: RowClocks = { ...clock };

  for (const item of local) {
    const id = getId(item);
    const incoming = remoteById.get(id);
    if (!incoming) {
      merged.push(item);
      nextClock[id] = now;
      continue;
    }
    const known = clock[id];
    if (!known || incoming.updatedAt >= known) {
      merged.push(incoming.value);
      nextClock[id] = incoming.updatedAt;
    } else {
      merged.push(item);
      nextClock[id] = now;
    }
    remoteById.delete(id);
  }
  for (const incoming of remoteById.values()) {
    merged.push(incoming.value);
    nextClock[incoming.id] = incoming.updatedAt;
  }
  return { merged, clock: nextClock };
}

export interface TreeMerge {
  merged: FamilyTreeData;
  clock: RowClocks;
  changed: boolean;
}

/** Fusiona un árbol completo colección por colección. */
export function mergeTrees(
  local: FamilyTreeData,
  remote: {
    persons: RemoteRow<FamilyTreeData["persons"][number]>[];
    unions: RemoteRow<FamilyTreeData["unions"][number]>[];
    relationships: RemoteRow<FamilyTreeData["relationships"][number]>[];
  },
  clock: SyncClock,
  now: string
): TreeMerge {
  // Las filas con tumba no resucitan aunque sigan en remoto.
  const live = <T extends { id: string }>(rows: RemoteRow<T>[]) =>
    rows.filter((row) => !(row.id in clock.deleted));
  const persons = mergeCollection(
    local.persons,
    (p) => p.id,
    live(remote.persons),
    clock.rows,
    now
  );
  const unions = mergeCollection(
    local.unions,
    (u) => u.id,
    live(remote.unions),
    persons.clock,
    now
  );
  const relationships = mergeCollection(
    local.relationships,
    (r) => r.id,
    live(remote.relationships),
    unions.clock,
    now
  );
  const merged = {
    persons: persons.merged,
    unions: unions.merged,
    relationships: relationships.merged,
  };
  const changed =
    JSON.stringify(merged) !==
    JSON.stringify({
      persons: local.persons,
      unions: local.unions,
      relationships: local.relationships,
    });
  return {
    merged,
    clock: relationships.clock,
    changed,
  };
}
