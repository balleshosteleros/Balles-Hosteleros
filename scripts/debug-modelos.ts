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
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, user_id, empresa_id, full_name, nombre");
  console.log("Profiles:", JSON.stringify(profiles, null, 2));

  const { data: empresas } = await supabase.from("empresas").select("*");
  console.log("\nEmpresas:", JSON.stringify(empresas, null, 2));

  const { data: modelos } = await supabase.from("modelos_aeat").select("id, tipo, periodo, ejercicio, empresa_id");
  console.log(`\nModelos creados (${modelos?.length ?? 0}):`, modelos);
}
main();
