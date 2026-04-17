/**
 * Aplica la migración 036_direccion_presentaciones.sql.
 * Uso: npx tsx scripts/apply-migration-036.ts
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
  "supabase/migrations/036_direccion_presentaciones.sql",
);
const sql = fs.readFileSync(migrationPath, "utf-8");

async function main() {
  console.log("Aplicando migración 036 — Dirección/Presentaciones...\n");

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
    console.log("\nArchivo: supabase/migrations/036_direccion_presentaciones.sql");
    console.log(`Tamaño: ${sql.length} bytes · ${sql.split("\n").length} líneas\n`);
    process.exit(1);
  }

  console.log("✅ Migración 036 aplicada correctamente.");
}

main();
