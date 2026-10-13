/**
 * Mapeo app ↔ Supabase (Fase E2, spec en docs/guides/phase-d-multiuser.md).
 *
 * Tablas en snake_case; la app sigue en camelCase. `photo_path` (Storage
 * privado) se preserva en remoto pero no entra al modelo local hasta E3:
 * el push no lo toca y el pull lo ignora.
 */

import type {
  ChildRelationship,
  FamilyTreeData,
  Person,
  Union,
} from "@/types/family-tree";

export interface DbPersonRow {
  id: string;
  tree_id: string;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: string | null;
  death_date: string | null;
  photo_url: string | null;
  bio: string | null;
  attributes: Record<string, unknown>;
  updated_at: string;
}

export interface DbUnionRow {
  id: string;
  tree_id: string;
  partner1_id: string;
  partner2_id: string;
  union_type: string;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
}

export interface DbRelationshipRow {
  id: string;
  tree_id: string;
  child_id: string;
  union_id: string | null;
  single_parent_id: string | null;
  type: string;
  updated_at: string;
}

const emptyToNull = (value?: string): string | null =>
  value === undefined || value === "" ? null : value;

const nullToUndefined = (value: string | null): string | undefined =>
  value === null ? undefined : value;

export function personToRow(
  person: Person,
  treeId: string,
  updatedAt: string
): DbPersonRow {
  return {
    id: person.id,
    tree_id: treeId,
    first_name: person.firstName,
    last_name: person.lastName,
    gender: person.gender,
    birth_date: emptyToNull(person.birthDate),
    death_date: emptyToNull(person.deathDate),
    photo_url: emptyToNull(person.photoUrl),
    bio: person.bio ?? null,
    attributes: person.attributes ?? {},
    updated_at: updatedAt,
  };
}

export function unionToRow(
  union: Union,
  treeId: string,
  updatedAt: string
): DbUnionRow {
  return {
    id: union.id,
    tree_id: treeId,
    partner1_id: union.partner1Id,
    partner2_id: union.partner2Id,
    union_type: union.unionType,
    start_date: emptyToNull(union.startDate),
    end_date: emptyToNull(union.endDate),
    updated_at: updatedAt,
  };
}

export function relationshipToRow(
  relationship: ChildRelationship,
  treeId: string,
  updatedAt: string
): DbRelationshipRow {
  return {
    id: relationship.id,
    tree_id: treeId,
    child_id: relationship.childId,
    union_id: relationship.unionId ?? null,
    single_parent_id: relationship.singleParentId ?? null,
    type: relationship.type,
    updated_at: updatedAt,
  };
}

export function rowToPerson(row: DbPersonRow): Person {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    gender:
      row.gender === "male" || row.gender === "female" ? row.gender : "other",
    birthDate: nullToUndefined(row.birth_date),
    deathDate: nullToUndefined(row.death_date),
    photoUrl: nullToUndefined(row.photo_url),
    bio: nullToUndefined(row.bio),
    attributes:
      row.attributes && Object.keys(row.attributes).length > 0
        ? row.attributes
        : undefined,
  };
}

export function rowToUnion(row: DbUnionRow): Union {
  return {
    id: row.id,
    partner1Id: row.partner1_id,
    partner2Id: row.partner2_id,
    unionType:
      row.union_type === "marriage" || row.union_type === "domestic"
        ? row.union_type
        : "partnership",
    startDate: nullToUndefined(row.start_date),
    endDate: nullToUndefined(row.end_date),
  };
}

export function rowToRelationship(row: DbRelationshipRow): ChildRelationship {
  return {
    id: row.id,
    childId: row.child_id,
    unionId: nullToUndefined(row.union_id),
    singleParentId: nullToUndefined(row.single_parent_id),
    type:
      row.type === "adopted" || row.type === "step" ? row.type : "biological",
  };
}

export function rowsToTree(
  persons: DbPersonRow[],
  unions: DbUnionRow[],
  relationships: DbRelationshipRow[]
): FamilyTreeData {
  return {
    persons: persons.map(rowToPerson),
    unions: unions.map(rowToUnion),
    relationships: relationships.map(rowToRelationship),
  };
}
