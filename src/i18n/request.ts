import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";

/**
 * Configuración next-intl (requerida por el plugin). El catálogo se carga por
 * locale en `src/i18n/config.ts`; `es` es el locale por defecto.
 */
export default getRequestConfig(async () => ({
  locale: defaultLocale,
}));
