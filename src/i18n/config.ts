export const locales = ["es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "es";

/**
 * Añadir un idioma = añadir `src/i18n/messages/<locale>.json` y listarlo en
 * `locales`. El layout carga el catálogo por nombre (sin rutas por idioma;
 * `es` es el locale por defecto).
 */
export async function getMessages(locale: Locale) {
  return (await import(`./messages/${locale}.json`)).default;
}
