/**
 * Cliente Supabase para el servidor (Server Components / Route Handlers).
 *
 * Lee la sesión de las cookies (Next 16: `cookies()` es asíncrono). Lanza si
 * no hay entorno configurado.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

export async function createSupabaseServerClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase no está configurado (faltan NEXT_PUBLIC_SUPABASE_URL/ANON_KEY)."
    );
  }
  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Llamado desde un Server Component (solo lectura): el refresco lo
          // hace `src/proxy.ts`.
        }
      },
    },
  });
}
