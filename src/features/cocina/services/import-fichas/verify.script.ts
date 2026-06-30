/**
 * Script de verificación (no test runner — el proyecto no tiene vitest/jest).
 * Ejercita el módulo REAL contra el Excel real + candidatos de BACANAL.
 *
 * Uso:
 *   npx tsx src/features/cocina/services/import-fichas/verify.script.ts
 *
 * Lee .env.local para SUPABASE_SERVICE_ROLE_KEY (solo lectura).
 * NO escribe nada en la BD.
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { parseFichasBuffer } from "./parser";
import { construirPreview } from "./preview";
import type { Candidato } from "./types";

const EXCEL = path.resolve(
  "docs/fichas-tecnicas/BACANAL - FICHAS TECNICAS PRODUCTO.xlsx"
);

function loadEnv() {
  const p = path.resolve(".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: emp } = await sb
    .from("empresas")
    .select("id,nombre")
    .ilike("nombre", "BACANAL")
    .limit(1);
  const empresaId = emp![0].id as string;

  const { data: prods } = await sb
    .from("productos")
    .select("id,nombre,tipo,categoria")
    .eq("empresa_id", empresaId)
    .in("tipo", ["compra", "elaboracion"]);

  const candidatos: Candidato[] = (prods ?? []).map((p) => ({
    id: p.id as string,
    nombre: p.nombre as string,
    tipo: p.tipo as "compra" | "elaboracion",
    categoria: (p.categoria as string) ?? null,
  }));

  // Parsear el Excel real con el parser de producción.
  const buf = fs.readFileSync(EXCEL);
  const parsed = parseFichasBuffer(new Uint8Array(buf));

  const preview = construirPreview(empresaId, parsed, candidatos);
  const r = preview.resumen;

  console.log("=== PRP-071 Fase 1 — verificación ===");
  console.log("Empresa: BACANAL  | candidatos:", candidatos.length,
    `(compra ${candidatos.filter(c=>c.tipo==="compra").length}, elaboracion ${candidatos.filter(c=>c.tipo==="elaboracion").length})`);
  console.log("Platos parseados:", r.platos, "| Hojas saltadas:", preview.saltadas.length);
  console.log("Ingredientes únicos:", r.ingredientesUnicos);
  console.log("");
  console.log("  ✅ exacto   :", r.exacto);
  console.log("  🟡 probable :", r.probable);
  console.log("  🔴 dudoso   :", r.dudoso);
  console.log("  ⚪ sin cand.:", r.sinCandidato);
  console.log("");

  // Aserciones mínimas (fallan ruidosamente si el parser se rompe).
  const errores: string[] = [];
  if (r.platos < 50) errores.push(`esperaba ≥50 platos, hubo ${r.platos}`);
  if (r.ingredientesUnicos < 100) errores.push(`esperaba ≥100 ingredientes, hubo ${r.ingredientesUnicos}`);
  if (r.exacto < 20) errores.push(`esperaba ≥20 exactos, hubo ${r.exacto}`);

  // Muestra de probables (lo que el usuario confirmaría).
  console.log("=== Muestra de PROBABLES (Excel → sugerido) ===");
  preview.lineas
    .filter((l) => l.match.tipo === "probable")
    .slice(0, 12)
    .forEach((l) =>
      console.log(`  "${l.ingrediente}" → "${l.match.candidato?.nombre}" [${l.match.candidato?.tipo}] (${Math.round(l.match.score * 100)}%)`)
    );

  if (errores.length) {
    console.error("\n❌ FALLOS:", errores.join(" · "));
    process.exit(1);
  }
  console.log("\n✅ Verificación OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
