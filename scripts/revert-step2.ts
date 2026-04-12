/**
 * Revierte el Paso 2 del fix: los 17 productos reclasificados por heurística
 * de nombre. Solo deben ser elaboraciones las que tienen ficha en el Excel.
 *
 * Lista canónica de elaboraciones = hojas del Excel "FICHAS TECNICAS - ELABORACIONES".
 * Cualquier producto tipo='elaboracion' que NO esté en esa lista (por nombre
 * normalizado) vuelve a tipo='compra'.
 */
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
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

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const wb = XLSX.readFile("/Users/ivanballesteros/Desktop/SAAS/Logistica/FICHAS TECNICAS - ELABORACIONES (1).xlsx");
  const canonicas = new Set(wb.SheetNames.map((n) => norm(n)));
  console.log(`📗 Elaboraciones canónicas (Excel): ${canonicas.size}`);

  const { data: elabs } = await supabase
    .from("productos")
    .select("id, nombre")
    .eq("tipo", "elaboracion");

  const aRevertir = (elabs ?? []).filter((p) => !canonicas.has(norm(p.nombre)));
  console.log(`🔄 Elaboraciones a revertir a compra: ${aRevertir.length}`);

  for (const p of aRevertir) console.log(`  • ${p.nombre}`);

  if (aRevertir.length > 0) {
    const { error } = await supabase
      .from("productos")
      .update({ tipo: "compra", categoria: "Sin categoría" })
      .in("id", aRevertir.map((p) => p.id));
    if (error) { console.error("❌", error.message); process.exit(1); }
  }

  const { count: cCompra } = await supabase
    .from("productos").select("id", { count: "exact", head: true }).eq("tipo", "compra");
  const { count: cElab } = await supabase
    .from("productos").select("id", { count: "exact", head: true }).eq("tipo", "elaboracion");

  console.log(`\n━━━ ESTADO ━━━`);
  console.log(`  Compra:       ${cCompra}`);
  console.log(`  Elaboración:  ${cElab}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
