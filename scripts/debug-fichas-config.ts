/**
 * Diagnóstico rápido de escandallos_config_items y empresas.
 * Usa SUPABASE_SERVICE_ROLE_KEY (bypassa RLS).
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
const supa = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("== empresas ==");
  const { data: emps, error: e1 } = await supa.from("empresas").select("id, nombre").limit(20);
  if (e1) console.error("empresas err:", e1.message);
  else console.table(emps);

  console.log("\n== escandallos_config_grupos ==");
  const { data: grupos, error: e2 } = await supa.from("escandallos_config_grupos").select("*");
  if (e2) console.error("grupos err:", e2.message);
  else console.table(grupos);

  console.log("\n== escandallos_config_items count por (empresa_id, grupo_codigo) ==");
  const { data: items, error: e3 } = await supa
    .from("escandallos_config_items")
    .select("empresa_id, grupo_codigo")
    .limit(2000);
  if (e3) console.error("items err:", e3.message);
  else {
    const counts: Record<string, number> = {};
    for (const it of items ?? []) {
      const k = `${it.empresa_id}::${it.grupo_codigo}`;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    console.table(Object.entries(counts).map(([k, v]) => {
      const [empresa_id, grupo] = k.split("::");
      return { empresa_id, grupo, count: v };
    }));
    console.log(`Total items: ${items?.length ?? 0}`);
  }

  console.log("\n== profiles (empresa_id por user) ==");
  const { data: profs, error: e4 } = await supa.from("profiles").select("user_id, empresa_id").limit(20);
  if (e4) console.error("profiles err:", e4.message);
  else console.table(profs);
}

main().then(() => process.exit(0));
