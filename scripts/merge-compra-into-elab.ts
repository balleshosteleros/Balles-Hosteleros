/**
 * Busca productos tipo='compra' que en realidad son duplicados conceptuales de
 * una elaboración existente (match fuzzy por nombre) y los fusiona:
 *   1) Redirige filas de `escandallos` donde ingrediente_id = compra.id → elab.id.
 *   2) Elimina el producto de compra.
 *
 * Match fuzzy:
 *   - nombre normalizado de compra contiene el nombre normalizado de elab
 *   - o elab contiene compra (menos común)
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
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(norm(s).split(" ").filter((t) => t.length > 2));
}

function matchScore(a: string, b: string): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const minSize = Math.min(ta.size, tb.size);
  const overlap = shared / minSize;
  // Require high overlap AND some meaningful tokens
  if (overlap >= 0.75 && shared >= 2) return overlap;
  return 0;
}

async function main() {
  const { data: compras } = await supabase
    .from("productos").select("id, nombre").eq("tipo", "compra");
  const { data: elabs } = await supabase
    .from("productos").select("id, nombre").eq("tipo", "elaboracion");
  if (!compras || !elabs) return;

  const merges: Array<{ compraId: string; compraNombre: string; elabId: string; elabNombre: string; score: number }> = [];
  for (const c of compras) {
    let best: { elab: typeof elabs[0]; score: number } | null = null;
    for (const e of elabs) {
      const s = matchScore(c.nombre, e.nombre);
      if (s > 0 && (!best || s > best.score)) best = { elab: e, score: s };
    }
    if (best && best.score >= 0.75) {
      merges.push({
        compraId: c.id, compraNombre: c.nombre,
        elabId: best.elab.id, elabNombre: best.elab.nombre,
        score: best.score,
      });
    }
  }

  console.log(`🔁 Duplicados compra → elaboración detectados: ${merges.length}\n`);
  for (const m of merges) {
    console.log(`  "${m.compraNombre}"  →  "${m.elabNombre}"  (score ${m.score.toFixed(2)})`);
  }

  if (merges.length === 0) { console.log("Nada que fusionar."); return; }

  console.log("\nAplicando fusiones...\n");

  for (const m of merges) {
    // Redirect escandallos, evitando conflicto único (producto_venta_id + ingrediente_id)
    // Si ya existe un escandallo con esa combinación, borramos el de compra en vez de duplicar.
    const { data: duplicados } = await supabase
      .from("producto_composicion")
      .select("producto_venta_id")
      .eq("ingrediente_id", m.compraId);

    if (duplicados && duplicados.length > 0) {
      const ventaIds = duplicados.map((d) => d.producto_venta_id);
      const { data: existing } = await supabase
        .from("producto_composicion")
        .select("producto_venta_id")
        .eq("ingrediente_id", m.elabId)
        .in("producto_venta_id", ventaIds);
      const conflictSet = new Set((existing ?? []).map((e) => e.producto_venta_id));

      for (const d of duplicados) {
        if (conflictSet.has(d.producto_venta_id)) {
          // Borrar duplicado
          await supabase
            .from("producto_composicion")
            .delete()
            .eq("ingrediente_id", m.compraId)
            .eq("producto_venta_id", d.producto_venta_id);
        } else {
          // Redirigir
          await supabase
            .from("producto_composicion")
            .update({ ingrediente_id: m.elabId })
            .eq("ingrediente_id", m.compraId)
            .eq("producto_venta_id", d.producto_venta_id);
        }
      }
    }

    // Borrar producto compra
    const { error: dErr } = await supabase.from("productos").delete().eq("id", m.compraId);
    if (dErr) console.error(`  ⚠ delete "${m.compraNombre}":`, dErr.message);
    else console.log(`  ✓ Fusionado "${m.compraNombre}" → "${m.elabNombre}"`);
  }

  const { count: cCompra } = await supabase
    .from("productos").select("id", { count: "exact", head: true }).eq("tipo", "compra");
  const { count: cElab } = await supabase
    .from("productos").select("id", { count: "exact", head: true }).eq("tipo", "elaboracion");

  console.log(`\n━━━ ESTADO FINAL ━━━`);
  console.log(`  Compra:       ${cCompra}`);
  console.log(`  Elaboración:  ${cElab}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
