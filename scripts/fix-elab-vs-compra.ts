/**
 * Corrige duplicados entre productos tipo='compra' y tipo='elaboracion'.
 *
 * Regla: si un producto de compra tiene el mismo nombre (o muy similar) que una
 * elaboración, entonces NO debe existir como compra — debe ser solo elaboración.
 * En ese caso:
 *   1) Re-apuntamos todas las filas de `escandallos` (ingrediente_id = compra.id) a elaboracion.id
 *   2) Eliminamos el producto de compra duplicado.
 *
 * También detecta ingredientes de compra cuyo nombre claramente describe una
 * elaboración (comienza por "Salsa", "Mayonesa", "Chimichurri", etc.) y los
 * reclasifica sin más (por si alguno quedó como compra sin tener su ficha).
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
  const { data: all } = await supabase
    .from("productos")
    .select("id, nombre, tipo")
    .in("tipo", ["compra", "elaboracion"]);
  if (!all) return;

  const comprasByNombre = new Map<string, { id: string; nombre: string }>();
  const elabsByNombre = new Map<string, { id: string; nombre: string }>();
  for (const p of all) {
    const key = norm(p.nombre);
    if (p.tipo === "compra") comprasByNombre.set(key, { id: p.id, nombre: p.nombre });
    else elabsByNombre.set(key, { id: p.id, nombre: p.nombre });
  }

  // Paso 1 — duplicados compra vs elaboracion
  const toMerge: Array<{ compraId: string; elabId: string; nombre: string }> = [];
  for (const [key, compra] of comprasByNombre.entries()) {
    const elab = elabsByNombre.get(key);
    if (elab) toMerge.push({ compraId: compra.id, elabId: elab.id, nombre: compra.nombre });
  }

  console.log(`🔁 Duplicados compra↔elaboracion: ${toMerge.length}`);
  for (const m of toMerge) {
    // Redirect escandallos que apuntan a compra → elaboracion
    const { error: updErr } = await supabase
      .from("escandallos")
      .update({ ingrediente_id: m.elabId })
      .eq("ingrediente_id", m.compraId);
    if (updErr) { console.error(`  ⚠ redirect escandallos "${m.nombre}":`, updErr.message); continue; }

    // Borrar producto compra duplicado
    const { error: delErr } = await supabase.from("productos").delete().eq("id", m.compraId);
    if (delErr) console.error(`  ⚠ delete compra "${m.nombre}":`, delErr.message);
    else console.log(`  ✓ ${m.nombre} → solo como elaboración`);
  }

  // Paso 2 — compras con nombre obvio de elaboración (salsa, mayonesa, etc.)
  const ELAB_PREFIX = [
    "salsa ", "mayonesa ", "alioli", "vinagreta", "chimichurri", "mojo",
    "sofrito", "reduccion", "reducción", "pesto", "romesco", "guacamole",
    "hummus", "humus", "pico de gallo", "demiglace", "demi glace", "demi-glace",
    "bechamel", "holandesa", "tartara", "tártara", "barbacoa asiatica", "curry rojo",
    "espuma de", "aceite de", "caldo de", "fondo", "infusion", "infusión",
    "masa madre", "pan rallado", "picada",
  ];

  const { data: compras2 } = await supabase
    .from("productos")
    .select("id, nombre")
    .eq("tipo", "compra");

  const reclassify: Array<{ id: string; nombre: string }> = [];
  for (const c of compras2 ?? []) {
    const n = norm(c.nombre);
    if (ELAB_PREFIX.some((p) => n.startsWith(p) || n === p.trim())) {
      reclassify.push({ id: c.id, nombre: c.nombre });
    }
  }

  console.log(`\n🏷  Compras que son elaboraciones por nombre: ${reclassify.length}`);
  if (reclassify.length > 0) {
    const { error } = await supabase
      .from("productos")
      .update({ tipo: "elaboracion", categoria: "Salsas" })
      .in("id", reclassify.map((p) => p.id));
    if (error) console.error("  ⚠", error.message);
    else for (const r of reclassify) console.log(`  ✓ ${r.nombre}`);
  }

  // Resumen
  const { count: cCompra } = await supabase
    .from("productos").select("id", { count: "exact", head: true }).eq("tipo", "compra");
  const { count: cElab } = await supabase
    .from("productos").select("id", { count: "exact", head: true }).eq("tipo", "elaboracion");
  const { count: cVenta } = await supabase
    .from("productos").select("id", { count: "exact", head: true }).eq("tipo", "venta");

  console.log(`\n━━━ ESTADO FINAL ━━━`);
  console.log(`  Productos compra:       ${cCompra}`);
  console.log(`  Productos elaboración:  ${cElab}`);
  console.log(`  Productos venta:        ${cVenta}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
