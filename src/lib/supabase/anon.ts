/**
 * Cliente Supabase anónimo para rutas públicas (sin sesión).
 * Usado por la Carta Digital pública (PRP-028).
 *
 * NUNCA mezclar con server.ts (que lee cookies de sesión).
 * Las RLS deben permitir explícitamente `to anon` para que esto funcione.
 */
import { createClient } from "@supabase/supabase-js";

export function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-client-info": "carta-digital-public" } },
  });
}
