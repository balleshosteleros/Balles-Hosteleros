import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
const env = fs.readFileSync(".env.local", "utf-8");
for (const l of env.split("\n")) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
async function main() {
  const { data } = await s.from("escandallos_config_items").select("nombre, grupo_codigo, created_at").eq("empresa_id", "00000000-0000-0000-0000-000000000001").order("created_at", { ascending: false }).limit(15);
  console.table(data);
}
main().then(() => process.exit(0));
