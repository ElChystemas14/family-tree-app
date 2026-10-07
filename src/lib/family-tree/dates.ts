/**
 * Helpers de fechas ISO (YYYY-MM-DD) interpretadas como fecha LOCAL.
 *
 * NUNCA usar `new Date("YYYY-MM-DD")`: se interpreta como medianoche UTC y
 * desplaza el día al formatear en zonas UTC-X (AUD-CRIT-01).
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODateLocal(iso: string): Date {
  const match = ISO_DATE_RE.exec(iso.trim());
  if (!match)
    throw new Error(`Fecha inválida (se esperaba YYYY-MM-DD): ${iso}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Fecha inexistente: ${iso}`);
  }
  return date;
}

export function isValidISODate(iso: string): boolean {
  try {
    parseISODateLocal(iso);
    return true;
  } catch {
    return false;
  }
}

export const formatYear = (date?: string): string => {
  if (!date) return "";
  return parseISODateLocal(date).getFullYear().toString();
};

export const formatDate = (date?: string): string => {
  if (!date) return "";
  return parseISODateLocal(date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
