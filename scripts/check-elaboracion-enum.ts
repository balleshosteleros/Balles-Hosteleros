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
  const { data: emp } = await supabase.from("empresas").select("id").limit(1).single();
  if (!emp) { console.log("No hay empresa"); return; }

  const { data, error } = await supabase.from("productos").insert({
    empresa_id: emp.id,
    tipo: "elaboracion",
    nombre: "__test_elab__",
    categoria: "Salsas",
    estado: "Activo",
    unidad: "kg",
  }).select("id").single();

  if (error) {
    console.log("❌ Falla:", error.message);
    return;
  }

  console.log("✓ Enum 'elaboracion' funciona. Creado id:", data.id);
  await supabase.from("productos").delete().eq("id", data.id);
  console.log("✓ Test row limpiado.");
}

main();
