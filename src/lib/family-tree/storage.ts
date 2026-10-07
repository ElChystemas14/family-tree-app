/**
 * Persistencia local-first versionada + export/import JSON (Fase A2).
 *
 * Formato canónico: `{ version, persons, unions, relationships, posOverrides? }`.
 * La validación aquí es estructural y defensiva (nunca debe crashear la app);
 * la validación estricta con zod llega en A3 y reutilizará este shape.
 */

import type { FamilyTreeData } from "@/types/family-tree";
import { validateFamilyTreeData } from "./schema";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  if (!isRecord(raw))
    return { ok: false, errors: ["archivo: no es un objeto"] };
  if (raw.version !== STORAGE_VERSION)
    return {
      ok: false,
      errors: [`version: se esperaba ${STORAGE_VERSION}`],
    };
  // Validación del árbol (zod + coherencia) en schema.ts; aquí solo se añade
  // la envoltura versionada + posOverrides.
  const tree = validateFamilyTreeData(raw);
  const errors = [...tree.errors, ...validatePosOverrides(raw.posOverrides)];
  return { ok: errors.length === 0, errors };
}

export function loadStoredTree(
  storage: Pick<Storage, "getItem"> | undefined = typeof window !== "undefined"
    ? window.localStorage
    : undefined
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
    : undefined
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
  posOverrides: PosOverrides = {}
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
