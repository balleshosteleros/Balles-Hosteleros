/**
 * Aplica la migración 20260619120000_fichajes_popup_config.sql
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

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260619120000_fichajes_popup_config.sql",
);
const sql = fs.readFileSync(migrationPath, "utf-8");

async function viaManagementApi(): Promise<{ ok: boolean; error?: string }> {
  if (!accessToken) return { ok: false, error: "SUPABASE_ACCESS_TOKEN no está definido" };
  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
      },
    );
    if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}: ${await res.text()}` };
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
  console.log("Aplicando migración fichajes-popup-config...\n");
  if (accessToken) {
    const r1 = await viaManagementApi();
    if (r1.ok) return console.log("✅ Aplicada (Management API).");
    console.log(`   ⚠️  Management API falló: ${r1.error}\n`);
  }
  const r2 = await viaExecSqlRpc();
  if (r2.ok) return console.log("✅ Aplicada (exec_sql).");
  console.log(`   ⚠️  exec_sql falló: ${r2.error}\n`);
  console.log(`Aplícala manualmente: https://supabase.com/dashboard/project/${projectRef}/sql`);
  process.exit(1);
}

main();
