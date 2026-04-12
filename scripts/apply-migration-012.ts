/**
 * Aplica la migración 012 añadiendo 'elaboracion' al enum producto_tipo.
 * Uso: npx tsx scripts/apply-migration-012.ts
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
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const sql = `alter type public.producto_tipo add value if not exists 'elaboracion';`;
  const { error } = await supabase.rpc("exec_sql", { sql }).catch(() => ({ error: { message: "rpc no existe" } }));
  if (error) {
    console.log("ℹ️  exec_sql no disponible. Aplica manualmente desde el dashboard SQL:");
    console.log("   " + sql);
    console.log("\nO ejecuta en Supabase Studio > SQL Editor.");
    process.exit(0);
  }
  console.log("✓ Migración 012 aplicada.");
}

main();
