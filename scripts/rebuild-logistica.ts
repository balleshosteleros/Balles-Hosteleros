/**
 * Reset completo de Logística y reingestión limpia:
 *   1) Borra escandallos + productos (compra/venta/elaboracion) de la empresa.
 *   2) Reingiere proveedores + productos venta/compra + escandallos de platos (run-ingest).
 *   3) Reingiere elaboraciones (sheets del Excel de elaboraciones).
 *   4) Fusiona duplicados exactos compra↔elaboración (solo match de nombre normalizado exacto).
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

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

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

async function main() {
  const { data: emp } = await supabase.from("empresas").select("id").limit(1).single();
  if (!emp) throw new Error("No hay empresa");
  const empresaId = emp.id;

  console.log("🧹 Reset de datos...");
  // Borrar escandallos (cascade al borrar productos, pero explícito para reset limpio)
  const { data: prods } = await supabase
    .from("productos").select("id").eq("empresa_id", empresaId);
  if (prods && prods.length > 0) {
    const ids = prods.map((p) => p.id);
    await supabase.from("escandallos").delete().in("producto_venta_id", ids);
    await supabase.from("escandallos").delete().in("ingrediente_id", ids);
    await supabase.from("productos").delete().in("id", ids);
    console.log(`  ✓ Borrados ${ids.length} productos y sus escandallos`);
  }

  console.log("\n▶ Ejecutando run-ingest.ts (proveedores + venta + compra + escandallos de platos)...");
  execSync("npx tsx src/features/logistica/services/ingest-from-pdfs/run-ingest.ts", {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  console.log("\n▶ Ejecutando ingest-elaboraciones.ts...");
  execSync("npx tsx scripts/ingest-elaboraciones.ts", {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  // Fusionar solo duplicados EXACTOS (misma palabra normalizada)
  console.log("\n🔁 Fusionando duplicados exactos compra↔elaboración...");
  const { data: compras } = await supabase
    .from("productos").select("id, nombre").eq("tipo", "compra");
  const { data: elabs } = await supabase
    .from("productos").select("id, nombre").eq("tipo", "elaboracion");

  const elabByNorm = new Map<string, string>();
  for (const e of elabs ?? []) elabByNorm.set(norm(e.nombre), e.id);

  const toMerge: Array<{ compraId: string; elabId: string; nombre: string }> = [];
  for (const c of compras ?? []) {
    const eid = elabByNorm.get(norm(c.nombre));
    if (eid) toMerge.push({ compraId: c.id, elabId: eid, nombre: c.nombre });
  }

  for (const m of toMerge) {
    const { data: dup } = await supabase
      .from("escandallos").select("producto_venta_id").eq("ingrediente_id", m.compraId);
    if (dup && dup.length > 0) {
      for (const d of dup) {
        const { data: ex } = await supabase
          .from("escandallos").select("id")
          .eq("ingrediente_id", m.elabId)
          .eq("producto_venta_id", d.producto_venta_id)
          .maybeSingle();
        if (ex) {
          await supabase.from("escandallos").delete()
            .eq("ingrediente_id", m.compraId)
            .eq("producto_venta_id", d.producto_venta_id);
        } else {
          await supabase.from("escandallos").update({ ingrediente_id: m.elabId })
            .eq("ingrediente_id", m.compraId)
            .eq("producto_venta_id", d.producto_venta_id);
        }
      }
    }
    await supabase.from("productos").delete().eq("id", m.compraId);
    console.log(`  ✓ ${m.nombre} (merged)`);
  }

  const { count: cCompra } = await supabase
    .from("productos").select("id", { count: "exact", head: true }).eq("tipo", "compra");
  const { count: cElab } = await supabase
    .from("productos").select("id", { count: "exact", head: true }).eq("tipo", "elaboracion");
  const { count: cVenta } = await supabase
    .from("productos").select("id", { count: "exact", head: true }).eq("tipo", "venta");
  const { count: cEsc } = await supabase
    .from("escandallos").select("id", { count: "exact", head: true });

  console.log(`\n━━━ ESTADO FINAL ━━━`);
  console.log(`  Productos compra:       ${cCompra}`);
  console.log(`  Productos elaboración:  ${cElab}`);
  console.log(`  Productos venta:        ${cVenta}`);
  console.log(`  Escandallos totales:    ${cEsc}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
