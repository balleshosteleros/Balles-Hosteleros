#!/usr/bin/env node
// Clasifica las 87 líneas de escandallo para la Fase 3 del PRP-080.
// NO toca la base de datos: lee el volcado tmp_escandallos.json y produce
//   - migración SQL con SOLO las conversiones seguras (misma dimensión),
//   - tabla de revisión a ojo (markdown),
//   - lista de líneas EN CONFLICTO que necesitan decisión de Iván.
//
// Regla: la unidad la manda el producto (DECISIÓN 3). Una línea es convertible
// solo si su unidad y la medida del producto son de la MISMA dimensión
// (masa/masa, cuenta/cuenta, volumen/volumen). Gramos→Kg es masa/masa con
// factor 1/1000. Masa↔cuenta (p. ej. "gramos" de un producto en Unidades) NO
// es convertible sin saber el peso por unidad: eso es de Iván.
import fs from "node:fs";
import path from "node:path";

// Consume un volcado JSON de escandallo_ingredientes (id, cantidad, unidad, escandallo,
// ingrediente, prod_medida, prod_tipo). Se pasa la ruta como argumento; NO se versiona
// el volcado (es un dato puntual de producción). Uso:
//   node scripts/_clasificar_unidades_escandallo.mjs <ruta-volcado.json>
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dumpPath = process.argv[2] || path.join(root, "tmp_escandallos.json");
const raw = JSON.parse(fs.readFileSync(dumpPath, "utf8"));

// ── Normalizador de grafías → {dim, aProductoFactor por dimensión} ──
// dim: "masa" | "cuenta" | "volumen" | null
function clasificarUnidad(u) {
  const s = String(u ?? "").trim().toLowerCase();
  if (["g", "gr", "grs", "gramo", "gramos"].includes(s)) return { dim: "masa", base: "g" };
  if (["kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos"].includes(s)) return { dim: "masa", base: "kg" };
  if (["ud", "u", "uni", "und", "unidad", "unidades", "pax", "pcs"].includes(s)) return { dim: "cuenta", base: "ud" };
  if (["l", "lt", "lts", "litro", "litros", "cl", "ml"].includes(s)) return { dim: "volumen", base: cl_ml(s) };
  return { dim: null, base: null };
}
function cl_ml(s) { return s === "cl" ? "cl" : s === "ml" ? "ml" : "l"; }

// La medida del producto (p.medida) viene ya en forma canónica larga.
function dimDeMedida(m) {
  const c = clasificarUnidad(m);
  return c.dim;
}
// Factor para pasar la cantidad de la unidad de LÍNEA a la unidad del PRODUCTO,
// dentro de la misma dimensión. Devuelve null si no es convertible mecánicamente.
function factorAProducto(uLinea, medidaProd) {
  const a = clasificarUnidad(uLinea);
  const b = clasificarUnidad(medidaProd);
  if (!a.dim || !b.dim || a.dim !== b.dim) return null;
  if (a.dim === "masa") {
    const enGramos = { g: 1, kg: 1000 };
    const destino = b.base === "kg" ? 1000 : 1;
    return enGramos[a.base] / destino; // p.ej. g→kg = 1/1000
  }
  if (a.dim === "volumen") {
    const enMl = { ml: 1, cl: 10, l: 1000 };
    const destino = b.base === "l" ? 1000 : b.base === "cl" ? 10 : 1;
    return enMl[a.base] / destino;
  }
  return 1; // cuenta→cuenta
}

const convertir = [];   // conversión segura (factor != 1): gramos→Kg
const relabel = [];     // misma unidad, solo homogeneizar grafía a la del producto
const cero = [];        // cantidad 0: placeholder, se relabela sin riesgo
const conflicto = [];   // dimensión distinta y cantidad>0: DECISIÓN DE IVÁN
const huerfana = [];    // sin producto vinculado

for (const r of raw) {
  const cant = Number(r.cantidad);
  const linea = { ...r, cant };
  if (!r.prod_medida) { huerfana.push(linea); continue; }
  const f = factorAProducto(r.unidad, r.prod_medida);
  if (f === null) {
    if (cant === 0) { cero.push(linea); } else { conflicto.push(linea); }
    continue;
  }
  if (cant === 0) { cero.push({ ...linea, factor: f }); continue; }
  if (Math.abs(f - 1) < 1e-9) { relabel.push({ ...linea, factor: 1 }); }
  else { convertir.push({ ...linea, factor: f, nuevaCant: +(cant * f).toFixed(6) }); }
}

const resumen = { total: raw.length, convertir: convertir.length, relabel: relabel.length, cero: cero.length, conflicto: conflicto.length, huerfana: huerfana.length };
console.error("RESUMEN", JSON.stringify(resumen));

// ── Tabla de revisión a ojo (markdown) ──
const md = [];
md.push("# Revisión Fase 3 — conversión de unidades de escandallo\n");
md.push(`Total ${resumen.total} líneas · **convertir ${resumen.convertir}** · relabel ${resumen.relabel} · placeholders(0) ${resumen.cero} · **conflicto ${resumen.conflicto}** · huérfana ${resumen.huerfana}\n`);
md.push("## ✅ Conversión gramos → Kg (revisar antes de aplicar)\n");
md.push("| escandallo | ingrediente | antes | después |");
md.push("|---|---|---|---|");
for (const r of convertir.sort((a,b)=>a.escandallo.localeCompare(b.escandallo)))
  md.push(`| ${r.escandallo} | ${r.ingrediente} | ${r.cant} ${r.unidad} | **${r.nuevaCant} ${r.prod_medida}** |`);
md.push("\n## 🟡 Solo homogeneizar grafía (misma unidad)\n");
md.push("| escandallo | ingrediente | antes | después |");
md.push("|---|---|---|---|");
for (const r of relabel.sort((a,b)=>a.escandallo.localeCompare(b.escandallo)))
  md.push(`| ${r.escandallo} | ${r.ingrediente} | ${r.cant} ${r.unidad} | ${r.cant} ${r.prod_medida} |`);
md.push("\n## ⚪ Placeholders cantidad 0 (se homogeneiza sin riesgo)\n");
md.push(`${cero.length} líneas · ${cero.map(r=>`${r.ingrediente}(${r.unidad}→${r.prod_medida})`).join(", ")}\n`);
md.push("## 🔴 CONFLICTO — decisión de Iván (NO se tocan)\n");
md.push("La unidad de la receta y la medida del producto son de dimensiones distintas (p. ej. gramos de un producto que se compra por Unidades). Convertir mecánicamente daría un número falso.\n");
md.push("| escandallo | ingrediente | receta | producto (medida) | tipo |");
md.push("|---|---|---|---|---|");
for (const r of conflicto.sort((a,b)=>a.escandallo.localeCompare(b.escandallo)))
  md.push(`| ${r.escandallo} | ${r.ingrediente} | ${r.cant} ${r.unidad} | ${r.prod_medida} | ${r.prod_tipo} |`);
if (huerfana.length) {
  md.push("\n## ⚫ Huérfanas (sin producto vinculado)\n");
  for (const r of huerfana) md.push(`- ${r.escandallo} · ${r.ingrediente} · ${r.cant} ${r.unidad}`);
}
fs.writeFileSync(path.join(root, "tmp_revision_unidades.md"), md.join("\n"));

// ── Migración SQL: SOLO conversiones seguras + relabel + placeholders ──
const sql = [];
sql.push("-- PRP-080 Fase 3 (TASK-3A): la unidad la manda el producto.");
sql.push("-- Generado por scripts/_clasificar_unidades_escandallo.mjs a partir del estado real.");
sql.push("-- Convierte SOLO lo mecánicamente seguro (misma dimensión). Las líneas en");
sql.push("-- conflicto (gramos de productos por unidad, etc.) NO se tocan: son decisión de Iván.");
sql.push("");
sql.push("begin;");
sql.push("");
sql.push("-- 1) Conversión gramos → Kg (cantidad ÷ 1000, unidad = medida del producto).");
for (const r of convertir)
  sql.push(`update escandallo_ingredientes set cantidad = ${r.nuevaCant}, unidad = ${sqlLit(r.prod_medida)} where id = ${sqlLit(r.id)}; -- ${r.escandallo} · ${r.ingrediente}: ${r.cant} ${r.unidad} → ${r.nuevaCant} ${r.prod_medida}`);
sql.push("");
sql.push("-- 2) Homogeneizar grafía a la medida del producto (misma unidad, cantidad intacta).");
for (const r of [...relabel, ...cero])
  sql.push(`update escandallo_ingredientes set unidad = ${sqlLit(r.prod_medida)} where id = ${sqlLit(r.id)};`);
sql.push("");
sql.push("commit;");
fs.writeFileSync(path.join(root, "supabase/migrations/20260829120000_escandallo_unidades_fase3.sql"), sql.join("\n") + "\n");

function sqlLit(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

console.error("OK · migración y revisión escritas");
