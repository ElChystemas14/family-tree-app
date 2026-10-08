/**
 * CSV v1.0: parseo/serializado RFC 4180 + mapeo al modelo (Fase C1).
 *
 * - `parseCsvText`: autodetecta `,`/`;` por la cabecera, ignora BOM y líneas
 *   vacías, devuelve filas con su nº de línea (para el reporte de C2).
 * - `serializeCsv`: siempre con `,` (separador primario de la spec).
 * - `personToCsvRow` / `personsFromCsvRows` (+ uniones/relaciones): mapeo con
 *   los defaults de la spec (`other`, `partnership`, `biological`, ids
 *   generados si vacíos). La validación la hace `validateFamilyTreeData`.
 * - `build*Template`: plantillas descargables (byte-idénticas a `public/`).
 */

import type {
  ChildRelationship,
  FamilyTreeData,
  Person,
  Union,
} from "@/types/family-tree";
import { isValidISODate } from "./dates";
import { validatePersonForm } from "./schema";
import { isAncestorOf } from "./store";

export type CsvDelimiter = "," | ";";

export interface CsvRow {
  /** Nº de línea física en el fichero (cabecera = 1). */
  line: number;
  values: Record<string, string>;
}

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
  delimiter: CsvDelimiter;
}

export class CsvParseError extends Error {
  line?: number;
  constructor(message: string, line?: number) {
    super(message);
    this.name = "CsvParseError";
    this.line = line;
  }
}

export const PERSON_CSV_HEADERS = [
  "id",
  "firstName",
  "lastName",
  "gender",
  "birthDate",
  "deathDate",
  "photoUrl",
  "bio",
  "attributes",
] as const;

export const UNION_CSV_HEADERS = [
  "id",
  "partner1Id",
  "partner2Id",
  "unionType",
  "startDate",
  "endDate",
] as const;

export const RELATIONSHIP_CSV_HEADERS = [
  "id",
  "childId",
  "unionId",
  "singleParentId",
  "type",
] as const;

function countChar(line: string, char: string): number {
  return line.split(char).length - 1;
}

export function detectDelimiter(headerLine: string): CsvDelimiter {
  return countChar(headerLine, ";") > countChar(headerLine, ",") ? ";" : ",";
}

/** Parsea CSV RFC 4180 (comillas, `""` escapado, multilínea entrecomillada). */
export function parseCsvText(text: string): ParsedCsv {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const firstLine = src.split("\n", 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);

  const records: { line: number; fields: string[] }[] = [];
  let field = "";
  let fields: string[] = [];
  let inQuotes = false;
  let line = 1;
  let recordStartLine = 1;
  let hasContent = false;

  const pushRecord = () => {
    fields.push(field);
    if (hasContent) records.push({ line: recordStartLine, fields });
    field = "";
    fields = [];
    hasContent = false;
    recordStartLine = line + 1;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      if (ch !== '"') hasContent = hasContent || ch.trim() !== "";
      else hasContent = true;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      hasContent = true;
    } else if (ch === delimiter) {
      fields.push(field);
      field = "";
    } else if (ch === "\n") {
      pushRecord();
      line++;
    } else {
      field += ch;
      if (ch.trim() !== "") hasContent = true;
    }
  }
  if (inQuotes) throw new CsvParseError("Comilla sin cerrar", line);
  if (hasContent || fields.length > 0) pushRecord();

  if (records.length === 0)
    throw new CsvParseError("CSV vacío o sin cabecera", 1);
  const headers = records[0]!.fields.map((h) => h.trim());
  if (headers.length === 0 || headers.every((h) => h === "")) {
    throw new CsvParseError("CSV sin cabecera", 1);
  }
  const rows: CsvRow[] = records.slice(1).map((record) => {
    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      values[header] = (record.fields[index] ?? "").trim();
    });
    return { line: record.line, values };
  });
  return { headers, rows, delimiter };
}

function needsQuoting(value: string): boolean {
  return (
    value.includes(",") ||
    value.includes(";") ||
    value.includes('"') ||
    value.includes("\n") ||
    value !== value.trim()
  );
}

function escapeField(value: string): string {
  const raw = value;
  if (!needsQuoting(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

/** Serializa con `,` (separador primario v1.0) y `\n` final. */
export function serializeCsv(
  headers: readonly string[],
  rows: Record<string, string | undefined>[]
): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeField(row[h] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}

// --- Mapeo modelo ↔ filas (defaults de la spec v1.0) ---

const newId = () => crypto.randomUUID();

export function personToCsvRow(person: Person): Record<string, string> {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    gender: person.gender,
    birthDate: person.birthDate ?? "",
    deathDate: person.deathDate ?? "",
    photoUrl: person.photoUrl ?? "",
    bio: person.bio ?? "",
    attributes:
      person.attributes && Object.keys(person.attributes).length > 0
        ? JSON.stringify(person.attributes)
        : "",
  };
}

export function unionToCsvRow(union: Union): Record<string, string> {
  return {
    id: union.id,
    partner1Id: union.partner1Id,
    partner2Id: union.partner2Id,
    unionType: union.unionType,
    startDate: union.startDate ?? "",
    endDate: union.endDate ?? "",
  };
}

export function relationshipToCsvRow(
  relationship: ChildRelationship
): Record<string, string> {
  return {
    id: relationship.id,
    childId: relationship.childId,
    unionId: relationship.unionId ?? "",
    singleParentId: relationship.singleParentId ?? "",
    type: relationship.type,
  };
}

function parseAttributes(raw: string): Record<string, unknown> | undefined {
  if (raw.trim() === "") return undefined;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("attributes: debe ser un objeto JSON");
  }
  return parsed as Record<string, unknown>;
}

function orUndefined(value: string): string | undefined {
  return value.trim() === "" ? undefined : value;
}

export function personsFromCsvRows(rows: Record<string, string>[]): Person[] {
  return rows.map((row) => ({
    id: row.id?.trim() || newId(),
    firstName: row.firstName?.trim() ?? "",
    lastName: row.lastName?.trim() ?? "",
    gender:
      row.gender === "male" || row.gender === "female" ? row.gender : "other",
    birthDate: orUndefined(row.birthDate ?? ""),
    deathDate: orUndefined(row.deathDate ?? ""),
    photoUrl: orUndefined(row.photoUrl ?? ""),
    bio: orUndefined(row.bio ?? ""),
    attributes: row.attributes ? parseAttributes(row.attributes) : undefined,
  }));
}

export function unionsFromCsvRows(rows: Record<string, string>[]): Union[] {
  return rows.map((row) => ({
    id: row.id?.trim() || newId(),
    partner1Id: row.partner1Id?.trim() ?? "",
    partner2Id: row.partner2Id?.trim() ?? "",
    unionType:
      row.unionType === "marriage" || row.unionType === "domestic"
        ? row.unionType
        : "partnership",
    startDate: orUndefined(row.startDate ?? ""),
    endDate: orUndefined(row.endDate ?? ""),
  }));
}

export function relationshipsFromCsvRows(
  rows: Record<string, string>[]
): ChildRelationship[] {
  return rows.map((row) => ({
    id: row.id?.trim() || newId(),
    childId: row.childId?.trim() ?? "",
    unionId: orUndefined(row.unionId ?? ""),
    singleParentId: orUndefined(row.singleParentId ?? ""),
    type:
      row.type === "adopted" || row.type === "step" ? row.type : "biological",
  }));
}

// --- Plantillas descargables v1.0 (byte-idénticas a public/) ---

export function buildPersonTemplate(): string {
  return serializeCsv(
    [...PERSON_CSV_HEADERS],
    [
      {
        id: "p1",
        firstName: "Ana",
        lastName: "Ruiz",
        gender: "female",
        birthDate: "1970-05-02",
        bio: "Madre de Sofía",
      },
      {
        id: "p2",
        firstName: "Luis",
        lastName: "Ruiz",
        gender: "male",
        birthDate: "1968-11-19",
        bio: "Padre de Sofía",
      },
      {
        id: "p3",
        firstName: "Sofía",
        lastName: "Ruiz",
        gender: "female",
        birthDate: "1998-02-10",
        bio: "Hija de Ana y Luis",
      },
    ]
  );
}

export function buildUnionTemplate(): string {
  return serializeCsv(
    [...UNION_CSV_HEADERS],
    [
      {
        id: "u1",
        partner1Id: "p1",
        partner2Id: "p2",
        unionType: "marriage",
        startDate: "1995-06-10",
      },
    ]
  );
}

export function buildRelationshipTemplate(): string {
  return serializeCsv(
    [...RELATIONSHIP_CSV_HEADERS],
    [{ id: "r1", childId: "p3", unionId: "u1", type: "biological" }]
  );
}

// --- Importador con reporte por fila (C2, modo parcial v1.0) ---

export type CsvFileKind = "personas" | "uniones" | "relaciones";

export interface CsvRowError {
  file: CsvFileKind;
  line: number;
  field?: string;
  message: string;
}

export interface CsvImportPlan {
  applied: FamilyTreeData;
  rejected: CsvRowError[];
  summary: {
    persons: { applied: number; rejected: number };
    unions: { applied: number; rejected: number };
    relationships: { applied: number; rejected: number };
  };
}

export interface CsvImportInput {
  personasText?: string;
  unionesText?: string;
  relacionesText?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function checkDateCell(
  raw: string,
  file: CsvFileKind,
  line: number,
  field: string,
  errors: CsvRowError[]
): string | undefined {
  const value = raw.trim();
  if (value === "") return undefined;
  if (!ISO_DATE_RE.test(value) || !isValidISODate(value)) {
    errors.push({
      file,
      line,
      field,
      message: "Debe ser una fecha YYYY-MM-DD válida.",
    });
    return undefined;
  }
  return value;
}

/**
 * Planifica la importación (no muta nada): las filas válidas van a `applied`
 * y cada fila inválida a `rejected` con `línea + campo + motivo`.
 * Las referencias pueden resolverse en el archivo o en el árbol actual.
 */
export function planCsvImport(
  input: CsvImportInput,
  current: FamilyTreeData
): CsvImportPlan {
  const rejected: CsvRowError[] = [];
  const persons: Person[] = [];
  const unions: Union[] = [];
  const relationships: ChildRelationship[] = [];

  if (!input.personasText || input.personasText.trim() === "") {
    rejected.push({
      file: "personas",
      line: 0,
      message: "Falta el archivo personas.csv (obligatorio).",
    });
    return emptyPlan(rejected);
  }

  let personRows: CsvRow[];
  try {
    personRows = parseCsvText(input.personasText).rows;
  } catch (error) {
    rejected.push(fileError("personas", error));
    return emptyPlan(rejected);
  }

  const currentPersonIds = new Set(current.persons.map((p) => p.id));
  const seenPersonIds = new Set<string>();
  for (const row of personRows) {
    const v = row.values;
    const fail = (field: string | undefined, message: string) => {
      rejected.push({ file: "personas", line: row.line, field, message });
    };
    const genderRaw = (v.gender ?? "").trim();
    const form = validatePersonForm({
      firstName: v.firstName ?? "",
      lastName: v.lastName ?? "",
      gender: genderRaw === "" ? "other" : genderRaw,
      birthDate: v.birthDate ?? "",
      deathDate: v.deathDate ?? "",
      photoUrl: v.photoUrl ?? "",
      bio: v.bio ?? "",
    });
    if (!form.ok || !form.value) {
      for (const [field, message] of Object.entries(form.errors)) {
        if (message) fail(field, message);
      }
      continue;
    }
    let attributes: Record<string, unknown> | undefined;
    try {
      attributes =
        v.attributes && v.attributes.trim() !== ""
          ? parseAttributes(v.attributes)
          : undefined;
    } catch {
      fail("attributes", "Debe ser un objeto JSON.");
      continue;
    }
    const id = v.id?.trim() || newId();
    if (seenPersonIds.has(id)) {
      fail(undefined, `id duplicado en el archivo: ${id}.`);
      continue;
    }
    if (currentPersonIds.has(id)) {
      fail(undefined, `id ya existe en el árbol: ${id}.`);
      continue;
    }
    seenPersonIds.add(id);
    persons.push({ ...form.value, id, attributes });
  }

  if (input.unionesText && input.unionesText.trim() !== "") {
    let unionRows: CsvRow[];
    try {
      unionRows = parseCsvText(input.unionesText).rows;
    } catch (error) {
      rejected.push(fileError("uniones", error));
      return finishPlan(persons, unions, relationships, rejected);
    }
    const personPool = new Set([
      ...persons.map((p) => p.id),
      ...currentPersonIds,
    ]);
    const currentUnionIds = new Set(current.unions.map((u) => u.id));
    const seenUnionIds = new Set<string>();
    for (const row of unionRows) {
      const v = row.values;
      const fail = (field: string | undefined, message: string) => {
        rejected.push({ file: "uniones", line: row.line, field, message });
      };
      const id = v.id?.trim() || newId();
      if (seenUnionIds.has(id) || currentUnionIds.has(id)) {
        fail(undefined, `id duplicado: ${id}.`);
        continue;
      }
      const partner1Id = (v.partner1Id ?? "").trim();
      const partner2Id = (v.partner2Id ?? "").trim();
      if (!partner1Id) {
        fail("partner1Id", "Obligatorio.");
        continue;
      }
      if (!partner2Id) {
        fail("partner2Id", "Obligatorio.");
        continue;
      }
      if (partner1Id === partner2Id) {
        fail(undefined, "partner1Id y partner2Id deben ser distintos.");
        continue;
      }
      const unionTypeRaw = (v.unionType ?? "").trim();
      if (
        unionTypeRaw !== "" &&
        unionTypeRaw !== "marriage" &&
        unionTypeRaw !== "partnership" &&
        unionTypeRaw !== "domestic"
      ) {
        fail("unionType", "Debe ser marriage, partnership o domestic.");
        continue;
      }
      const unionErrors: CsvRowError[] = [];
      const startDate = checkDateCell(
        v.startDate ?? "",
        "uniones",
        row.line,
        "startDate",
        unionErrors
      );
      const endDate = checkDateCell(
        v.endDate ?? "",
        "uniones",
        row.line,
        "endDate",
        unionErrors
      );
      if (unionErrors.length > 0) {
        rejected.push(...unionErrors);
        continue;
      }
      if (startDate && endDate && endDate < startDate) {
        fail("endDate", "No puede ser anterior a startDate.");
        continue;
      }
      if (!personPool.has(partner1Id)) {
        fail("partner1Id", "No existe (ni en el archivo ni en el árbol).");
        continue;
      }
      if (!personPool.has(partner2Id)) {
        fail("partner2Id", "No existe (ni en el archivo ni en el árbol).");
        continue;
      }
      const bothExist =
        currentPersonIds.has(partner1Id) && currentPersonIds.has(partner2Id);
      if (bothExist) {
        if (
          current.unions.some(
            (u) =>
              [u.partner1Id, u.partner2Id].includes(partner1Id) &&
              [u.partner1Id, u.partner2Id].includes(partner2Id)
          )
        ) {
          fail(undefined, "Estas personas ya están conectadas.");
          continue;
        }
        if (
          isAncestorOf(
            partner1Id,
            partner2Id,
            current.unions,
            current.relationships
          ) ||
          isAncestorOf(
            partner2Id,
            partner1Id,
            current.unions,
            current.relationships
          )
        ) {
          fail(undefined, "No se puede unir parientes directos.");
          continue;
        }
      }
      seenUnionIds.add(id);
      unions.push({
        id,
        partner1Id,
        partner2Id,
        unionType:
          unionTypeRaw === "marriage" || unionTypeRaw === "domestic"
            ? unionTypeRaw
            : "partnership",
        startDate,
        endDate,
      });
    }
  }

  if (input.relacionesText && input.relacionesText.trim() !== "") {
    let relRows: CsvRow[];
    try {
      relRows = parseCsvText(input.relacionesText).rows;
    } catch (error) {
      rejected.push(fileError("relaciones", error));
      return finishPlan(persons, unions, relationships, rejected);
    }
    const importedPersonIds = new Set(persons.map((p) => p.id));
    const importedUnionIds = new Set(unions.map((u) => u.id));
    const unionById = new Map(unions.map((u) => [u.id, u]));
    const personPool = new Set([...importedPersonIds, ...currentPersonIds]);
    const currentRelIds = new Set(current.relationships.map((r) => r.id));
    const seenRelIds = new Set<string>();
    for (const row of relRows) {
      const v = row.values;
      const fail = (field: string | undefined, message: string) => {
        rejected.push({ file: "relaciones", line: row.line, field, message });
      };
      const id = v.id?.trim() || newId();
      if (seenRelIds.has(id) || currentRelIds.has(id)) {
        fail(undefined, `id duplicado: ${id}.`);
        continue;
      }
      const childId = (v.childId ?? "").trim();
      if (!childId) {
        fail("childId", "Obligatorio.");
        continue;
      }
      if (!importedPersonIds.has(childId)) {
        fail("childId", "Debe ser una persona del archivo personas.csv.");
        continue;
      }
      const typeRaw = (v.type ?? "").trim();
      if (
        typeRaw !== "" &&
        typeRaw !== "biological" &&
        typeRaw !== "adopted" &&
        typeRaw !== "step"
      ) {
        fail("type", "Debe ser biological, adopted o step.");
        continue;
      }
      const unionId = (v.unionId ?? "").trim() || undefined;
      const singleParentId = (v.singleParentId ?? "").trim() || undefined;
      if (unionId && singleParentId) {
        fail(undefined, "unionId y singleParentId son excluyentes.");
        continue;
      }
      if (!unionId && !singleParentId) {
        fail(undefined, "Falta unionId o singleParentId.");
        continue;
      }
      if (unionId && !importedUnionIds.has(unionId)) {
        fail("unionId", "No existe en el archivo uniones.csv.");
        continue;
      }
      if (singleParentId && !personPool.has(singleParentId)) {
        fail("singleParentId", "No existe (ni en el archivo ni en el árbol).");
        continue;
      }
      const parents = unionId
        ? (() => {
            const u = unionById.get(unionId)!;
            return [u.partner1Id, u.partner2Id];
          })()
        : [singleParentId!];
      if (parents.includes(childId)) {
        fail(undefined, "Una persona no puede ser hija de sí misma.");
        continue;
      }
      seenRelIds.add(id);
      relationships.push({
        id,
        childId,
        unionId,
        singleParentId,
        type:
          typeRaw === "adopted" || typeRaw === "step" ? typeRaw : "biological",
      });
    }
  }

  return finishPlan(persons, unions, relationships, rejected);
}

function fileError(file: CsvFileKind, error: unknown): CsvRowError {
  const line =
    error instanceof CsvParseError && typeof error.line === "number"
      ? error.line
      : 0;
  const message =
    error instanceof Error
      ? `No se pudo leer el archivo: ${error.message}`
      : "No se pudo leer el archivo.";
  return { file, line, message };
}

function emptyPlan(rejected: CsvRowError[]): CsvImportPlan {
  return finishPlan([], [], [], rejected);
}

function finishPlan(
  persons: Person[],
  unions: Union[],
  relationships: ChildRelationship[],
  rejected: CsvRowError[]
): CsvImportPlan {
  const count = (file: CsvFileKind) =>
    rejected.filter((r) => r.file === file).length;
  return {
    applied: { persons, unions, relationships },
    rejected,
    summary: {
      persons: { applied: persons.length, rejected: count("personas") },
      unions: { applied: unions.length, rejected: count("uniones") },
      relationships: {
        applied: relationships.length,
        rejected: count("relaciones"),
      },
    },
  };
}

// --- Exportación CSV espejo v1.0 (C3) ---

/** `personas-AAAA-MM-DD.csv` (fecha local, como el export JSON). */
export function buildCsvFilename(
  kind: CsvFileKind,
  from: Date = new Date()
): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${kind}-${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}.csv`;
}

/** ¿Hay personas vivas (sin `deathDate`)? Para el aviso de privacidad (C3). */
export function hasLivingPersons(persons: Person[]): boolean {
  return persons.some((person) => !person.deathDate);
}
