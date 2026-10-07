/**
 * Esquemas zod + validación en español (Fase A3).
 *
 * - `personSchema` / `unionSchema` / `relationshipSchema`: forma de cada entidad.
 * - `validatePersonForm`: valida el formulario crear/editar (mensajes por campo).
 * - `validateFamilyTreeData`: valida un árbol completo (unicidad + referencias +
 *   coherencia). `storage.ts` lo reutiliza para carga/importación.
 *
 * Nota: los mensajes en español se generan en nuestras funciones (no dependen de
 * la versión de zod); zod solo comprueba forma/tipos/enums.
 */

import { z } from "zod";
import type { FamilyTreeData } from "@/types/family-tree";
import { isValidISODate } from "./dates";

export const genderSchema = z.enum(["male", "female", "other"]);
export const unionTypeSchema = z.enum(["marriage", "partnership", "domestic"]);
export const relationshipTypeSchema = z.enum([
  "biological",
  "adopted",
  "step",
]);

const isoDateFormat = /^\d{4}-\d{2}-\d{2}$/;

export const personSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  gender: genderSchema,
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  photoUrl: z.string().optional(),
  bio: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

export const unionSchema = z.object({
  id: z.string(),
  partner1Id: z.string(),
  partner2Id: z.string(),
  unionType: unionTypeSchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const relationshipSchema = z.object({
  id: z.string(),
  childId: z.string(),
  unionId: z.string().optional(),
  singleParentId: z.string().optional(),
  type: relationshipTypeSchema,
});

export interface PersonFormInput {
  firstName: string;
  lastName: string;
  gender: string;
  birthDate?: string;
  deathDate?: string;
  photoUrl?: string;
  bio?: string;
}

export type PersonFormErrors = Partial<
  Record<
    | "firstName"
    | "lastName"
    | "gender"
    | "birthDate"
    | "deathDate"
    | "photoUrl"
    | "bio",
    string
  >
>;

export interface PersonFormResult {
  ok: boolean;
  errors: PersonFormErrors;
  value?: {
    firstName: string;
    lastName: string;
    gender: "male" | "female" | "other";
    birthDate?: string;
    deathDate?: string;
    photoUrl?: string;
    bio?: string;
  };
}

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

function checkDateField(
  value: unknown,
  field: "birthDate" | "deathDate",
  errors: PersonFormErrors,
): string | undefined {
  const normalized = emptyToUndefined(value) as string | undefined;
  if (normalized === undefined) return undefined;
  if (typeof normalized !== "string" || !isoDateFormat.test(normalized)) {
    errors[field] = "La fecha debe tener formato AAAA-MM-DD.";
    return undefined;
  }
  if (!isValidISODate(normalized)) {
    errors[field] = "La fecha no existe (revisa día y mes).";
    return undefined;
  }
  return normalized;
}

/** Valida el formulario de crear/editar persona. Mensajes en español por campo. */
export function validatePersonForm(input: PersonFormInput): PersonFormResult {
  const errors: PersonFormErrors = {};

  const firstName =
    typeof input.firstName === "string" ? input.firstName.trim() : "";
  const lastName =
    typeof input.lastName === "string" ? input.lastName.trim() : "";
  if (!firstName) errors.firstName = "El nombre es obligatorio.";
  if (!lastName) errors.lastName = "Los apellidos son obligatorios.";

  const gender =
    input.gender === "male" ||
    input.gender === "female" ||
    input.gender === "other"
      ? input.gender
      : undefined;
  if (!gender) errors.gender = "El género no es válido.";

  const birthDate = checkDateField(input.birthDate ?? "", "birthDate", errors);
  const deathDate = checkDateField(input.deathDate ?? "", "deathDate", errors);
  if (
    birthDate &&
    deathDate &&
    !errors.birthDate &&
    !errors.deathDate &&
    deathDate < birthDate
  ) {
    errors.deathDate = "El fallecimiento no puede ser anterior al nacimiento.";
  }

  const photoRaw = emptyToUndefined(input.photoUrl) as string | undefined;
  let photoUrl: string | undefined;
  if (photoRaw !== undefined) {
    if (
      typeof photoRaw !== "string" ||
      (!photoRaw.startsWith("https://") && !photoRaw.startsWith("/"))
    ) {
      errors.photoUrl = "La foto debe ser una URL https:// o una ruta /…";
    } else {
      photoUrl = photoRaw;
    }
  }

  const bioRaw = typeof input.bio === "string" ? input.bio.trim() : "";
  if (bioRaw.length > 2000) {
    errors.bio = "La biografía es demasiado larga (máx. 2000 caracteres).";
  }

  if (Object.keys(errors).length > 0 || !gender) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    errors: {},
    value: {
      firstName,
      lastName,
      gender,
      birthDate,
      deathDate,
      photoUrl,
      bio: bioRaw || undefined,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Valida un árbol completo `{ persons, unions, relationships }`.
 * Devuelve errores en español (prefijo `persona[i]` / `union[i]` / `relacion[i]`).
 */
export function validateFamilyTreeData(raw: unknown): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ["archivo: no es un objeto"] };
  if (!Array.isArray(raw.persons))
    errors.push("persons: debe ser una lista");
  if (!Array.isArray(raw.unions)) errors.push("unions: debe ser una lista");
  if (!Array.isArray(raw.relationships))
    errors.push("relationships: debe ser una lista");
  if (errors.length > 0) return { ok: false, errors };

  const persons = raw.persons as unknown[];
  const unions = raw.unions as unknown[];
  const relationships = raw.relationships as unknown[];

  persons.forEach((p, i) => {
    const where = `persona[${i}]`;
    const parsed = personSchema.safeParse(p);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(
          issue.path[issue.path.length - 1] ?? "valor",
        );
        errors.push(`${where}.${field}: no válido`);
      }
      return;
    }
    const v = parsed.data;
    if (!isNonEmptyString(v.id)) errors.push(`${where}.id: requerido`);
    if (!v.firstName.trim()) errors.push(`${where}.firstName: requerido`);
    if (!v.lastName.trim()) errors.push(`${where}.lastName: requerido`);
    for (const [field, val] of [
      ["birthDate", v.birthDate],
      ["deathDate", v.deathDate],
    ] as const) {
      if (val !== undefined && val !== "") {
        if (!isoDateFormat.test(val) || !isValidISODate(val))
          errors.push(`${where}.${field}: debe ser YYYY-MM-DD`);
      }
    }
    if (
      v.birthDate &&
      v.deathDate &&
      isValidISODate(v.birthDate) &&
      isValidISODate(v.deathDate) &&
      v.deathDate < v.birthDate
    ) {
      errors.push(`${where}: deathDate anterior a birthDate`);
    }
    if (v.photoUrl !== undefined && v.photoUrl !== "") {
      if (!v.photoUrl.startsWith("https://") && !v.photoUrl.startsWith("/"))
        errors.push(`${where}.photoUrl: debe ser https:// o ruta /`);
    }
  });

  unions.forEach((u, i) => {
    const where = `union[${i}]`;
    const parsed = unionSchema.safeParse(u);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(
          issue.path[issue.path.length - 1] ?? "valor",
        );
        errors.push(`${where}.${field}: no válido`);
      }
      return;
    }
    const v = parsed.data;
    if (!isNonEmptyString(v.id)) errors.push(`${where}.id: requerido`);
    if (!isNonEmptyString(v.partner1Id))
      errors.push(`${where}.partner1Id: requerido`);
    if (!isNonEmptyString(v.partner2Id))
      errors.push(`${where}.partner2Id: requerido`);
    if (
      isNonEmptyString(v.partner1Id) &&
      isNonEmptyString(v.partner2Id) &&
      v.partner1Id === v.partner2Id
    ) {
      errors.push(`${where}: partner1Id y partner2Id deben ser distintos`);
    }
    for (const [field, val] of [
      ["startDate", v.startDate],
      ["endDate", v.endDate],
    ] as const) {
      if (val !== undefined && val !== "") {
        if (!isoDateFormat.test(val) || !isValidISODate(val))
          errors.push(`${where}.${field}: debe ser YYYY-MM-DD`);
      }
    }
    if (
      v.startDate &&
      v.endDate &&
      isValidISODate(v.startDate) &&
      isValidISODate(v.endDate) &&
      v.endDate < v.startDate
    ) {
      errors.push(`${where}: endDate anterior a startDate`);
    }
  });

  relationships.forEach((r, i) => {
    const where = `relacion[${i}]`;
    const parsed = relationshipSchema.safeParse(r);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = String(
          issue.path[issue.path.length - 1] ?? "valor",
        );
        errors.push(`${where}.${field}: no válido`);
      }
      return;
    }
    const v = parsed.data;
    if (!isNonEmptyString(v.id)) errors.push(`${where}.id: requerido`);
    if (!isNonEmptyString(v.childId))
      errors.push(`${where}.childId: requerido`);
    const hasUnion = isNonEmptyString(v.unionId);
    const hasSingle = isNonEmptyString(v.singleParentId);
    if (hasUnion && hasSingle)
      errors.push(`${where}: unionId y singleParentId son excluyentes`);
    if (!hasUnion && !hasSingle)
      errors.push(`${where}: falta unionId o singleParentId`);
  });

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

  const personIds = new Set<string>();
  for (const p of persons) {
    if (isRecord(p) && typeof p.id === "string") personIds.add(p.id);
  }
  const unionIds = new Set<string>();
  for (const u of unions) {
    if (isRecord(u) && typeof u.id === "string") unionIds.add(u.id);
  }
  for (const u of unions) {
    if (!isRecord(u)) continue;
    const id = String(u.id);
    if (typeof u.partner1Id === "string" && !personIds.has(u.partner1Id))
      errors.push(`union ${id}: partner1Id inexistente (${u.partner1Id})`);
    if (typeof u.partner2Id === "string" && !personIds.has(u.partner2Id))
      errors.push(`union ${id}: partner2Id inexistente (${u.partner2Id})`);
  }
  for (const r of relationships) {
    if (!isRecord(r)) continue;
    const id = String(r.id);
    if (typeof r.childId === "string" && !personIds.has(r.childId))
      errors.push(`relación ${id}: childId inexistente (${r.childId})`);
    if (
      typeof r.unionId === "string" &&
      r.unionId !== "" &&
      !unionIds.has(r.unionId)
    )
      errors.push(`relación ${id}: unionId inexistente (${r.unionId})`);
    if (
      typeof r.singleParentId === "string" &&
      r.singleParentId !== "" &&
      !personIds.has(r.singleParentId)
    ) {
      errors.push(
        `relación ${id}: singleParentId inexistente (${r.singleParentId})`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

export type ValidatedFamilyTree = FamilyTreeData;
