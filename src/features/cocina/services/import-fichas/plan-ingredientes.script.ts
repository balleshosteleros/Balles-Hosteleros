/**
 * DRY-RUN: para los escandallos ya enlazados de BACANAL, empareja TODOS sus
 * ingredientes del Excel contra productos de compra + elaboración.
 * Muestra el plan (exacto/probable/dudoso/sin candidato). NO escribe nada.
 *
 *   npx tsx src/features/cocina/services/import-fichas/plan-ingredientes.script.ts
 */
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { parseFichasBuffer } from "./parser";
import { prepararCandidatos, emparejar } from "./matcher";
import { normalizar } from "./matcher";
import type { Candidato } from "./types";

function loadEnv() {
  const p = path.resolve(".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// Empareja nombre de plato del Excel ↔ nombre de escandallo enlazado.
function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]+/g, " ").trim();
}

async function main() {
  loadEnv();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: emp } = await sb.from("empresas").select("id").ilike("nombre", "BACANAL").limit(1);
  const empresaId = emp![0].id as string;

  const { data: prods } = await sb.from("productos").select("id,nombre,tipo,categoria").eq("empresa_id", empresaId).in("tipo", ["compra", "elaboracion"]);
  const candidatos: Candidato[] = (prods ?? []).map((p) => ({ id: p.id as string, nombre: p.nombre as string, tipo: p.tipo as "compra" | "elaboracion", categoria: (p.categoria as string) ?? null }));
  const prep = prepararCandidatos(candidatos);

  // Escandallos enlazados existentes (para saber qué platos tocar y su nombre normalizado).
  const { data: escs } = await sb.from("escandallos").select("nombre").eq("empresa_id", empresaId).not("producto_id", "is", null);
  const nombresEsc = new Set((escs ?? []).map((e) => norm(String(e.nombre))));

  const buf = fs.readFileSync(path.resolve("docs/fichas-tecnicas/BACANAL - FICHAS TECNICAS PRODUCTO.xlsx"));
  const parsed = parseFichasBuffer(new Uint8Array(buf));

  let totalIng = 0, ex = 0, pr = 0, du = 0, sc = 0;
  const dudosos: string[] = [];
  const sinCand: string[] = [];

  for (const ficha of parsed.fichas) {
    // Solo los platos cuyo escandallo está enlazado (por nombre aproximado).
    const nf = norm(ficha.plato);
    const enlazado = [...nombresEsc].some((n) => n === nf || n.includes(nf) || nf.includes(n));
    if (!enlazado) continue;

    for (const ing of ficha.ingredientes) {
      totalIng++;
      const m = emparejar(ing.nombre, prep);
      if (m.tipo === "exacto") ex++;
      else if (m.tipo === "probable") { pr++; dudosos.push(`  🟡 "${ing.nombre}" → "${m.candidato?.nombre}" [${m.candidato?.tipo}] (${Math.round(m.score * 100)}%)`); }
      else if (m.tipo === "dudoso") { du++; dudosos.push(`  🔴 "${ing.nombre}" → ¿"${m.candidato?.nombre}"? (${Math.round(m.score * 100)}%)`); }
      else { sc++; sinCand.push(`  ⚪ "${ing.nombre}"`); }
    }
  }

  console.log("=== PLAN: ingredientes de los escandallos enlazados (BACANAL) ===\n");
  console.log(`Ingredientes totales: ${totalIng}`);
  console.log(`  ✅ exacto (auto):   ${ex}`);
  console.log(`  🟡 probable:        ${pr}`);
  console.log(`  🔴 dudoso:          ${du}`);
  console.log(`  ⚪ sin candidato:   ${sc}`);
  console.log("\n=== PROBABLES + DUDOSOS (a confirmar) ===");
  dudosos.slice(0, 60).forEach((d) => console.log(d));
  console.log("\n=== SIN CANDIDATO (no existe en compra ni elaboración) ===");
  [...new Set(sinCand)].forEach((s) => console.log(s));
  console.log("\n(NO se ha escrito nada.)");
}
main().catch((e) => { console.error(e); process.exit(1); });
