/**
 * Diagnóstico de por qué /carta/{slug} devuelve 404.
 * Uso: npx tsx scripts/check-carta-slug.ts bacanal
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

const slug = process.argv[2] ?? "bacanal";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  console.log(`\n🔍 Buscando carta con slug="${slug}"\n`);

  console.log("1. Empresas con cualquier slug definido (admin/service):");
  const all = await admin
    .from("empresas")
    .select("id, nombre, carta_slug, carta_publicada")
    .not("carta_slug", "is", null);
  console.table(all.data ?? []);
  if (all.error) console.log("error:", all.error.message);

  console.log(`\n2. Empresa con slug exacto "${slug}" (admin):`);
  const exact = await admin
    .from("empresas")
    .select("id, nombre, carta_slug, carta_publicada, carta_descripcion")
    .eq("carta_slug", slug)
    .maybeSingle();
  console.log(exact.data ?? "(ninguna)");
  if (exact.error) console.log("error:", exact.error.message);

  console.log(`\n3. Lectura ANÓNIMA con publicada=true (lo que hace la página pública):`);
  const pub = await anon
    .from("empresas")
    .select("id, nombre, carta_slug, carta_publicada")
    .eq("carta_slug", slug)
    .eq("carta_publicada", true)
    .maybeSingle();
  console.log(pub.data ?? "(ninguna — por eso 404)");
  if (pub.error) console.log("error:", pub.error.message);

  if (exact.data && !exact.data.carta_publicada) {
    console.log(
      "\n⚠️  La empresa existe con ese slug PERO carta_publicada=false. Activa 'Publicar carta' en el admin.",
    );
  }
  if (!exact.data) {
    console.log(
      `\n⚠️  Ninguna empresa tiene carta_slug="${slug}". Guárdalo desde /marketing/carta-digital.`,
    );
  }
}

main();
