/**
 * Simula createConfigItem con el mismo cliente que usa la app en DEV_BYPASS.
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
  // 1) Primera empresa (igual que getAppContext con bypass)
  const { data: emp } = await supa.from("empresas").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  console.log("Empresa:", emp);

  if (!emp) return;

  // 2) Calcular siguiente orden
  const { data: ultimo } = await supa
    .from("escandallos_config_items")
    .select("orden")
    .eq("empresa_id", emp.id)
    .eq("grupo_codigo", "categorias")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log("Último orden:", ultimo);

  const nextOrden = (ultimo?.orden ?? 0) + 1;

  // 3) Insert
  const nombreTest = `TEST_DEBUG_${Date.now()}`;
  const { data, error } = await supa
    .from("escandallos_config_items")
    .insert({
      empresa_id: emp.id,
      grupo_codigo: "categorias",
      nombre: nombreTest,
      activa: true,
      orden: nextOrden,
    })
    .select()
    .single();

  if (error) console.error("INSERT ERROR:", JSON.stringify(error, null, 2));
  else console.log("INSERT OK:", data);

  // 4) Cleanup
  if (data) {
    await supa.from("escandallos_config_items").delete().eq("id", data.id);
    console.log("Limpiado.");
  }
}

main().then(() => process.exit(0));
