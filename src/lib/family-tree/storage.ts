/**
 * Persistencia local-first versionada + export/import JSON (Fase A2).
 *
 * Formato canónico: `{ version, persons, unions, relationships, posOverrides? }`.
 * La validación aquí es estructural y defensiva (nunca debe crashear la app);
 * la validación estricta con zod llega en A3 y reutilizará este shape.
 */

import type {
  ChildRelationship,
  FamilyTreeData,
  Person,
  Union,
} from "@/types/family-tree";
import { isValidISODate } from "./dates";

export const STORAGE_KEY = "hawthorne-tree-v1";
export const STORAGE_VERSION = 1;

export type PosOverrides = Record<string, { x: number; y: number }>;

export interface StoredTreeData extends FamilyTreeData {
  version: number;
  posOverrides?: PosOverrides;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface LoadResult {
  data: StoredTreeData | null;
  error?: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  quota?: boolean;
}

export interface ImportSummary {
  persons: number;
  unions: number;
  relationships: number;
}

export interface ImportResult {
  ok: boolean;
  data?: StoredTreeData;
  summary?: ImportSummary;
  errors: string[];
}

const GENDERS: ReadonlySet<string> = new Set(["male", "female", "other"]);
const UNION_TYPES: ReadonlySet<string> = new Set([
  "marriage",
  "partnership",
  "domestic",
]);
const REL_TYPES: ReadonlySet<string> = new Set([
  "biological",
  "adopted",
  "step",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalISODate(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  return typeof value === "string" && isValidISODate(value);
}

function validatePerson(person: unknown, index: number): string[] {
  const errors: string[] = [];
  const where = `persona[${index}]`;
  if (!isRecord(person)) return [`${where}: no es un objeto`];
  if (!isNonEmptyString(person.id)) errors.push(`${where}.id: requerido`);
  if (!isNonEmptyString(person.firstName))
    errors.push(`${where}.firstName: requerido`);
  if (!isNonEmptyString(person.lastName))
    errors.push(`${where}.lastName: requerido`);
  if (typeof person.gender !== "string" || !GENDERS.has(person.gender))
    errors.push(`${where}.gender: debe ser male|female|other`);
  if (!isOptionalISODate(person.birthDate))
    errors.push(`${where}.birthDate: debe ser YYYY-MM-DD`);
  if (!isOptionalISODate(person.deathDate))
    errors.push(`${where}.deathDate: debe ser YYYY-MM-DD`);
  if (
    typeof person.birthDate === "string" &&
    person.birthDate !== "" &&
    typeof person.deathDate === "string" &&
    person.deathDate !== "" &&
    isValidISODate(person.birthDate) &&
    isValidISODate(person.deathDate) &&
    person.deathDate < person.birthDate
  ) {
    errors.push(`${where}: deathDate anterior a birthDate`);
  }
  if (
    person.photoUrl !== undefined &&
    person.photoUrl !== "" &&
    typeof person.photoUrl !== "string"
  ) {
    errors.push(`${where}.photoUrl: debe ser texto`);
  }
  return errors;
}

function validateUnion(union: unknown, index: number): string[] {
  const errors: string[] = [];
  const where = `union[${index}]`;
  if (!isRecord(union)) return [`${where}: no es un objeto`];
  if (!isNonEmptyString(union.id)) errors.push(`${where}.id: requerido`);
  if (!isNonEmptyString(union.partner1Id))
    errors.push(`${where}.partner1Id: requerido`);
  if (!isNonEmptyString(union.partner2Id))
    errors.push(`${where}.partner2Id: requerido`);
  if (
    isNonEmptyString(union.partner1Id) &&
    isNonEmptyString(union.partner2Id) &&
    union.partner1Id === union.partner2Id
  ) {
    errors.push(`${where}: partner1Id y partner2Id deben ser distintos`);
  }
  if (typeof union.unionType !== "string" || !UNION_TYPES.has(union.unionType))
    errors.push(`${where}.unionType: debe ser marriage|partnership|domestic`);
  if (!isOptionalISODate(union.startDate))
    errors.push(`${where}.startDate: debe ser YYYY-MM-DD`);
  if (!isOptionalISODate(union.endDate))
    errors.push(`${where}.endDate: debe ser YYYY-MM-DD`);
  return errors;
}

function validateRelationship(rel: unknown, index: number): string[] {
  const errors: string[] = [];
  const where = `relacion[${index}]`;
  if (!isRecord(rel)) return [`${where}: no es un objeto`];
  if (!isNonEmptyString(rel.id)) errors.push(`${where}.id: requerido`);
  if (!isNonEmptyString(rel.childId))
    errors.push(`${where}.childId: requerido`);
  if (typeof rel.type !== "string" || !REL_TYPES.has(rel.type))
    errors.push(`${where}.type: debe ser biological|adopted|step`);
  const hasUnion = isNonEmptyString(rel.unionId);
  const hasSingle = isNonEmptyString(rel.singleParentId);
  if (hasUnion && hasSingle)
    errors.push(`${where}: unionId y singleParentId son excluyentes`);
  if (!hasUnion && !hasSingle)
    errors.push(`${where}: falta unionId o singleParentId`);
  return errors;
}

function validatePosOverrides(value: unknown): string[] {
  if (value === undefined) return [];
  if (!isRecord(value)) return ["posOverrides: debe ser un objeto"];
  const errors: string[] = [];
  for (const [key, pos] of Object.entries(value)) {
    if (
      !isRecord(pos) ||
      typeof pos.x !== "number" ||
      typeof pos.y !== "number" ||
      !Number.isFinite(pos.x) ||
      !Number.isFinite(pos.y)
    ) {
      errors.push(`posOverrides.${key}: coordenadas x/y inválidas`);
    }
  }
  return errors;
}

export function validateStoredTree(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ["archivo: no es un objeto"] };
  if (raw.version !== STORAGE_VERSION)
    errors.push(`version: se esperaba ${STORAGE_VERSION}`);
  if (!Array.isArray(raw.persons))
    errors.push("persons: debe ser una lista");
  if (!Array.isArray(raw.unions)) errors.push("unions: debe ser una lista");
  if (!Array.isArray(raw.relationships))
    errors.push("relationships: debe ser una lista");
  if (errors.length > 0) return { ok: false, errors };

  const persons = raw.persons as unknown[];
  const unions = raw.unions as unknown[];
  const relationships = raw.relationships as unknown[];

  persons.forEach((p, i) => errors.push(...validatePerson(p, i)));
  unions.forEach((u, i) => errors.push(...validateUnion(u, i)));
  relationships.forEach((r, i) => errors.push(...validateRelationship(r, i)));
  errors.push(...validatePosOverrides(raw.posOverrides));

  // Unicidad de IDs dentro de cada colección.
  const checkUnique = (items: unknown[], label: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (isRecord(item) && typeof item.id === "string") {
        if (seen.has(item.id)) errors.push(`${label}: id duplicado ${item.id}`);
        seen.add(item.id);
      }
    }
  };
  checkUnique(persons, "persons");
  checkUnique(unions, "unions");
  checkUnique(relationships, "relationships");

  // Referencias existentes.
  const personIds = new Set(
    (persons as Person[]).filter((p) => isRecord(p)).map((p) => p.id),
  );
  const unionIds = new Set(
    (unions as Union[]).filter((u) => isRecord(u)).map((u) => u.id),
  );
  (unions as Union[]).forEach((u) => {
    if (!isRecord(u)) return;
    if (!personIds.has(u.partner1Id))
      errors.push(`union ${u.id}: partner1Id inexistente (${u.partner1Id})`);
    if (!personIds.has(u.partner2Id))
      errors.push(`union ${u.id}: partner2Id inexistente (${u.partner2Id})`);
  });
  (relationships as ChildRelationship[]).forEach((r) => {
    if (!isRecord(r)) return;
    if (!personIds.has(r.childId))
      errors.push(`relación ${r.id}: childId inexistente (${r.childId})`);
    if (r.unionId !== undefined && r.unionId !== "" && !unionIds.has(r.unionId))
      errors.push(`relación ${r.id}: unionId inexistente (${r.unionId})`);
    if (
      r.singleParentId !== undefined &&
      r.singleParentId !== "" &&
      !personIds.has(r.singleParentId)
    ) {
      errors.push(
        `relación ${r.id}: singleParentId inexistente (${r.singleParentId})`,
      );
    }
  });

  return { ok: errors.length === 0, errors };
}

export function loadStoredTree(
  storage: Pick<Storage, "getItem"> | undefined = typeof window !== "undefined"
    ? window.localStorage
    : undefined,
): LoadResult {
  if (!storage) return { data: null };
  let rawText: string | null;
  try {
    rawText = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: null, error: "No se pudo leer el guardado local." };
  }
  if (!rawText) return { data: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      data: null,
      error: "El guardado local está corrupto; se usa el archivo de prueba.",
    };
  }
  const validation = validateStoredTree(parsed);
  if (!validation.ok) {
    return {
      data: null,
      error: `El guardado local no es válido (${validation.errors[0]}); se usa el archivo de prueba.`,
    };
  }
  return { data: parsed as StoredTreeData };
}

export function saveStoredTree(
  data: FamilyTreeData,
  posOverrides: PosOverrides = {},
  storage: Pick<Storage, "setItem"> | undefined = typeof window !== "undefined"
    ? window.localStorage
    : undefined,
): SaveResult {
  if (!storage) return { ok: false, error: "Guardado no disponible." };
  const payload: StoredTreeData = {
    version: STORAGE_VERSION,
    persons: data.persons,
    unions: data.unions,
    relationships: data.relationships,
    posOverrides,
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    const quota =
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return {
      ok: false,
      quota,
      error: quota
        ? "Guardado local lleno: exporta el archivo como copia de seguridad."
        : "No se pudo guardar en local.",
    };
  }
}

export function buildExportFilename(from: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `arbol-${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}.json`;
}

export function buildExportPayload(
  data: FamilyTreeData,
  posOverrides: PosOverrides = {},
): StoredTreeData {
  return {
    version: STORAGE_VERSION,
    persons: data.persons,
    unions: data.unions,
    relationships: data.relationships,
    posOverrides,
  };
}

export function parseImportedJson(raw: unknown): ImportResult {
  const validation = validateStoredTree(raw);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  const data = raw as StoredTreeData;
  return {
    ok: true,
    data,
    summary: {
      persons: data.persons.length,
      unions: data.unions.length,
      relationships: data.relationships.length,
    },
    errors: [],
  };
}
