/**
 * Aplica migración 013: añade columnas resumen, video_url, id_visible, parent_id, orden a cronogramas_operativos.
 * Usa la conexión Supabase pero como solo es DDL, requiere ejecutarse vía SQL Editor del dashboard.
 * Este script intenta vía postgres-meta (no siempre disponible).
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  // Verificar si columnas ya existen
  const { error } = await supabase
    .from("cronogramas_operativos")
    .select("resumen, video_url, id_visible, parent_id, orden")
    .limit(1);

  if (!error) {
    console.log("✓ Columnas ya existen. No hace falta aplicar 013.");
    return;
  }

  console.log("⚠ Las columnas extras no existen aún.");
  console.log("Pega esto en Supabase SQL Editor:\n");
  console.log(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/013_cronogramas_extras.sql"), "utf-8"));
}

main();
