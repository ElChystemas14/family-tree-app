import { describe, expect, it } from "vitest";
import { getSupabaseEnv, isSupabaseConfigured } from "./env";

describe("getSupabaseEnv (E)", () => {
  it("devuelve null sin variables (modo local-first)", () => {
    expect(getSupabaseEnv({})).toBeNull();
    expect(isSupabaseConfigured({})).toBe(false);
  });

  it("acepta publishable key nueva y JWT legada", () => {
    const url = "https://xyzcompany.supabase.co";
    expect(
      getSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abc123XYZ456789",
      })
    ).toEqual({ url, anonKey: "sb_publishable_abc123XYZ456789" });
    expect(
      isSupabaseConfigured({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: `eyJ${"a".repeat(40)}`,
      })
    ).toBe(true);
  });

  it("sin argumento lee process.env (ruta que usa el cliente)", () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://xyz.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      "sb_publishable_abc123XYZ456789";
    try {
      expect(getSupabaseEnv()?.url).toBe("https://xyz.supabase.co");
    } finally {
      if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      if (prevKey === undefined)
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;
    }
  });

  it("tolera comillas y rechaza URL/key inválidas", () => {
    expect(
      getSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: '"https://xyz.supabase.co"',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "'sb_publishable_abc123XYZ456789'",
      })?.url
    ).toBe("https://xyz.supabase.co");
    expect(
      getSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:8000",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abc123XYZ456789",
      })
    ).toBeNull();
    expect(
      getSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://xyz.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "corta",
      })
    ).toBeNull();
  });
});
