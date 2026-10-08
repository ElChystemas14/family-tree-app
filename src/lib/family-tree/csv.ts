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

import type { ChildRelationship, Person, Union } from "@/types/family-tree";

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
