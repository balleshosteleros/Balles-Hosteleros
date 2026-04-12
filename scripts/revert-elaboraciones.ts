import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const content = fs.readFileSync(envPath, "utf-8");
for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data, error } = await supabase
    .from("productos")
    .select("id, nombre")
    .eq("tipo", "elaboracion");
  if (error) { console.error(error); process.exit(1); }
  if (!data || data.length === 0) { console.log("No hay elaboraciones que revertir."); return; }

  const ids = data.map((p) => p.id);
  const { error: updErr } = await supabase
    .from("productos")
    .update({ tipo: "compra", categoria: "Sin categoría" })
    .in("id", ids);
  if (updErr) { console.error("❌", updErr.message); process.exit(1); }

  console.log(`✓ Revertidos ${data.length} productos a tipo='compra':`);
  for (const p of data) console.log(`  • ${p.nombre}`);
}

main();
