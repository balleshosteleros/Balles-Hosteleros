/**
 * Verifica que la migración 038 quedó bien aplicada.
 * Uso: npx tsx scripts/verify-carta-digital.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const content = fs.readFileSync(envPath, "utf-8");
for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function check(label: string, fn: () => Promise<{ error: unknown }>) {
  const res = await fn();
  if (res.error) {
    console.log(`❌ ${label}:`, res.error);
    return false;
  }
  console.log(`✅ ${label}`);
  return true;
}

async function main() {
  console.log("Verificando migración 038 — Carta Digital\n");

  await check("tabla carta_categorias", () =>
    supabase.from("carta_categorias").select("id").limit(1) as never,
  );
  await check("tabla carta_items", () =>
    supabase.from("carta_items").select("id").limit(1) as never,
  );
  await check("tabla carta_item_likes", () =>
    supabase.from("carta_item_likes").select("id").limit(1) as never,
  );
  await check("columna empresas.carta_slug", () =>
    supabase.from("empresas").select("id, carta_slug, carta_publicada, carta_descripcion").limit(1) as never,
  );

  const buckets = await supabase.storage.listBuckets();
  if (buckets.error) console.log("❌ storage list:", buckets.error.message);
  else {
    const has = buckets.data?.some((b) => b.id === "carta-fotos");
    console.log(has ? "✅ bucket carta-fotos" : "❌ falta bucket carta-fotos");
  }

  console.log("\n✨ Verificación completa.");
}

main();
