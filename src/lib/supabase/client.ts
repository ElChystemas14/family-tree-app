/**
 * Cliente Supabase para el navegador (Fase E).
 *
 * Sesión en cookies (la comparte con el servidor vía `proxy.ts`). Instancia
 * única. Lanza si no hay entorno: comprobar antes con `isSupabaseConfigured()`.
 */

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserClient | undefined;

export function createSupabaseBrowserClient(): BrowserClient {
  if (browserClient) return browserClient;
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase no está configurado (faltan NEXT_PUBLIC_SUPABASE_URL/ANON_KEY)."
    );
  }
  browserClient = createBrowserClient(env.url, env.anonKey);
  return browserClient;
}

export { isSupabaseConfigured };
