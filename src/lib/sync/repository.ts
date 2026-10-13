/**
 * Repositorio Supabase (Fase E2).
 *
 * Toda la E/S remota pasa por aquí con mensajes en español. El mapeo y el
 * merge viven en `mapping.ts` / `clock.ts` (testeados sin red).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FamilyTreeData } from "@/types/family-tree";
import type { PosOverrides } from "../family-tree/storage";
import type { RemoteRow } from "./clock";
import {
  personToRow,
  relationshipToRow,
  rowToPerson,
  rowToRelationship,
  rowToUnion,
  unionToRow,
} from "./mapping";

export interface RemoteTreeItem {
  id: string;
  name: string;
  role: string;
  updatedAt?: string;
}

export interface PulledTree {
  data: FamilyTreeData;
  posOverrides: PosOverrides;
  persons: RemoteRow<FamilyTreeData["persons"][number]>[];
  unions: RemoteRow<FamilyTreeData["unions"][number]>[];
  relationships: RemoteRow<FamilyTreeData["relationships"][number]>[];
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}: ${error.message}`);
}

export async function listTrees(
  supabase: SupabaseClient,
  userId: string
): Promise<RemoteTreeItem[]> {
  const { data, error } = await supabase
    .from("tree_memberships")
    .select("role, trees(id, name, updated_at)")
    .eq("user_id", userId);
  if (error) fail("No se pudieron listar los árboles", error);
  const items: RemoteTreeItem[] = [];
  for (const row of (data ?? []) as Array<{
    role: unknown;
    trees: unknown;
  }>) {
    const joined = Array.isArray(row.trees) ? row.trees[0] : row.trees;
    if (!joined || typeof joined !== "object") continue;
    const tree = joined as {
      id: unknown;
      name: unknown;
      updated_at?: unknown;
    };
    if (typeof tree.id !== "string" || typeof tree.name !== "string") continue;
    items.push({
      id: tree.id,
      name: tree.name,
      role: typeof row.role === "string" ? row.role : "viewer",
      updatedAt:
        typeof tree.updated_at === "string" ? tree.updated_at : undefined,
    });
  }
  return items;
}

export async function createTree(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<string> {
  // RPC atómica (migración 0002): crea árbol + membership owner. Inserción
  // directa fallaría por RLS (el creador aún no es miembro). `userId` se
  // conserva en la firma por claridad (el RPC usa auth.uid()).
  void userId;
  const { data, error } = await supabase.rpc("create_tree", {
    p_name: name.trim() || "Mi árbol",
  });
  if (error) fail("No se pudo crear el árbol", error);
  if (typeof data !== "string" || data === "") {
    throw new Error("No se pudo crear el árbol: respuesta vacía.");
  }
  return data;
}

export async function pullTree(
  supabase: SupabaseClient,
  userId: string,
  treeId: string
): Promise<PulledTree> {
  const [personsRes, unionsRes, relsRes, settingsRes] = await Promise.all([
    supabase.from("persons").select("*").eq("tree_id", treeId),
    supabase.from("unions").select("*").eq("tree_id", treeId),
    supabase.from("relationships").select("*").eq("tree_id", treeId),
    supabase
      .from("user_tree_settings")
      .select("pos_overrides")
      .eq("user_id", userId)
      .eq("tree_id", treeId)
      .maybeSingle(),
  ]);
  if (personsRes.error) fail("No se pudo descargar el árbol", personsRes.error);
  if (unionsRes.error) fail("No se pudo descargar el árbol", unionsRes.error);
  if (relsRes.error) fail("No se pudo descargar el árbol", relsRes.error);

  const persons = (
    (personsRes.data ?? []) as Parameters<typeof rowToPerson>[0][]
  ).map((row) => ({
    id: row.id,
    updatedAt: row.updated_at,
    value: rowToPerson(row),
  }));
  const unions = (
    (unionsRes.data ?? []) as Parameters<typeof rowToUnion>[0][]
  ).map((row) => ({
    id: row.id,
    updatedAt: row.updated_at,
    value: rowToUnion(row),
  }));
  const relationships = (
    (relsRes.data ?? []) as Parameters<typeof rowToRelationship>[0][]
  ).map((row) => ({
    id: row.id,
    updatedAt: row.updated_at,
    value: rowToRelationship(row),
  }));
  const posOverrides = (settingsRes.data?.pos_overrides ?? {}) as PosOverrides;
  return {
    data: {
      persons: persons.map((p) => p.value),
      unions: unions.map((u) => u.value),
      relationships: relationships.map((r) => r.value),
    },
    posOverrides,
    persons,
    unions,
    relationships,
  };
}

export async function pushTree(
  supabase: SupabaseClient,
  userId: string,
  treeId: string,
  data: FamilyTreeData,
  posOverrides: PosOverrides,
  deletedPersonIds: string[]
): Promise<string> {
  const now = new Date().toISOString();
  const { error: personsError } = await supabase.from("persons").upsert(
    data.persons.map((person) => personToRow(person, treeId, now)),
    { onConflict: "id" }
  );
  if (personsError) fail("No se pudo subir el árbol", personsError);

  const { error: unionsError } = await supabase.from("unions").upsert(
    data.unions.map((union) => unionToRow(union, treeId, now)),
    { onConflict: "id" }
  );
  if (unionsError) fail("No se pudo subir el árbol", unionsError);

  const { error: relsError } = await supabase.from("relationships").upsert(
    data.relationships.map((relationship) =>
      relationshipToRow(relationship, treeId, now)
    ),
    { onConflict: "id" }
  );
  if (relsError) fail("No se pudo subir el árbol", relsError);

  if (deletedPersonIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("persons")
      .delete()
      .eq("tree_id", treeId)
      .in("id", deletedPersonIds);
    if (deleteError) fail("No se pudo subir el árbol", deleteError);
  }

  const { error: settingsError } = await supabase
    .from("user_tree_settings")
    .upsert(
      {
        user_id: userId,
        tree_id: treeId,
        pos_overrides: posOverrides,
        updated_at: now,
      },
      { onConflict: "user_id,tree_id" }
    );
  if (settingsError) fail("No se pudo subir el árbol", settingsError);

  const { error: touchError } = await supabase
    .from("trees")
    .update({ updated_at: now })
    .eq("id", treeId);
  if (touchError) fail("No se pudo subir el árbol", touchError);
  return now;
}
