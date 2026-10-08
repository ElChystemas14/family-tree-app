/**
 * Configuración Supabase (Fase E).
 *
 * Sin variables → `null` y la app sigue 100% local-first (A2). Nunca lanza al
 * importar: el login/sync solo aparecen cuando hay entorno configurado.
 * Tolera comillas envolventes (`KEY="valor"`) y acepta la publishable key
 * nueva (`sb_publishable_…`) o la legada JWT (`eyJ…`).
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

export function getSupabaseEnv(
  env: Record<string, string | undefined> = process.env
): SupabaseEnv | null {
  const url = clean(env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = clean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !/^https:\/\/.+/.test(url)) return null;
  if (!anonKey || anonKey.length < 20) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return getSupabaseEnv(env) !== null;
}
