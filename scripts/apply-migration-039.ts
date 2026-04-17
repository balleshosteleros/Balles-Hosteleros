/**
 * Aplica la migración 039_rename_nuevos_platos.sql — renombrado NUEVOS PLATOS → NUEVAS RECETAS.
 * Uso: npx tsx scripts/apply-migration-039.ts
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/039_rename_nuevos_platos.sql",
);
const sql = fs.readFileSync(migrationPath, "utf-8");

async function main() {
  console.log("Aplicando migración 039 — rename nuevos_platos → nuevas_recetas...\n");

  let result: { error: { message: string } | null };
  try {
    result = (await supabase.rpc("exec_sql", { sql })) as { error: { message: string } | null };
  } catch (err) {
    result = { error: { message: (err as Error).message } };
  }

  if (result.error) {
    console.log("⚠️  No se pudo aplicar automáticamente.");
    console.log(`Error: ${result.error.message}\n`);
    console.log("👉  Aplica la migración manualmente desde Supabase Studio > SQL Editor:\n");
    console.log(
      `    https://supabase.com/dashboard/project/${url.match(/https:\/\/([^.]+)\./)?.[1] ?? "???"}/sql`,
    );
    console.log("\nArchivo: supabase/migrations/039_rename_nuevos_platos.sql");
    console.log(`Tamaño: ${sql.length} bytes · ${sql.split("\n").length} líneas\n`);
    process.exit(1);
  }

  console.log("✅ Migración 039 aplicada correctamente.");

  // Verificación
  const { data, error } = await supabase
    .from("nuevas_recetas")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.log(`⚠️  Verificación falló: ${error.message}`);
  } else {
    console.log("✅ Tabla public.nuevas_recetas accesible.");
  }
}

main();
