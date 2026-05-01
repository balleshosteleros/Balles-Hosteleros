/**
 * Aplica la migración 046_fichas_config.sql — PRP-032.
 *
 * Estrategia:
 *  1) Si existe SUPABASE_ACCESS_TOKEN en .env.local → Management API
 *     (POST /v1/projects/{ref}/database/query).
 *  2) Si no, intenta exec_sql RPC (por si ya está instalado).
 *  3) Si ambos fallan → fallback manual con URL del SQL editor.
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1];
if (!projectRef) {
  console.error("❌ No se pudo extraer el project ref de NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/046_fichas_config.sql"
);
const sql = fs.readFileSync(migrationPath, "utf-8");

async function viaManagementApi(): Promise<{ ok: boolean; error?: string }> {
  if (!accessToken) return { ok: false, error: "SUPABASE_ACCESS_TOKEN no está definido" };
  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `${res.status} ${res.statusText}: ${body}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function viaExecSqlRpc(): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    const result = (await supabase.rpc("exec_sql", { sql })) as {
      error: { message: string } | null;
    };
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function main() {
  console.log("Aplicando migración 046 — Fichas Técnicas Config (Ajustes)...\n");

  // 1) Management API
  if (accessToken) {
    console.log("→ Intentando vía Supabase Management API...");
    const r1 = await viaManagementApi();
    if (r1.ok) {
      console.log("✅ Migración 046 aplicada correctamente (Management API).");
      return;
    }
    console.log(`   ⚠️  Falló: ${r1.error}\n`);
  } else {
    console.log("   ℹ️  SUPABASE_ACCESS_TOKEN no definido, salto Management API.\n");
  }

  // 2) exec_sql RPC
  console.log("→ Intentando vía exec_sql RPC...");
  const r2 = await viaExecSqlRpc();
  if (r2.ok) {
    console.log("✅ Migración 046 aplicada correctamente (exec_sql).");
    return;
  }
  console.log(`   ⚠️  Falló: ${r2.error}\n`);

  // 3) Fallback manual
  console.log("═════════════════════════════════════════════════════════════");
  console.log("⚠️  No pude aplicarla automáticamente. Opciones:");
  console.log("═════════════════════════════════════════════════════════════\n");
  console.log("A) Genera un Personal Access Token en:");
  console.log("   https://supabase.com/dashboard/account/tokens");
  console.log("   Y añade a .env.local:");
  console.log("     SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx\n");
  console.log("B) Aplícala manualmente una sola vez:");
  console.log(
    `   https://supabase.com/dashboard/project/${projectRef}/sql\n`
  );
  console.log(`   Archivo: supabase/migrations/046_fichas_config.sql`);
  console.log(`   Tamaño: ${sql.length} bytes · ${sql.split("\n").length} líneas\n`);
  process.exit(1);
}

main();
