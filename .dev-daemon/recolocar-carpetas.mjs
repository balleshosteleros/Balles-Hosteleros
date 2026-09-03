/**
 * Recoloca las carpetas de HABANA para que el árbol sea el MISMO que en Drive.
 *
 * La importación creó varias ramas colgando de la raíz de MARKETING cuando en
 * Drive cuelgan de `2.CONTENIDO HABANA` (2019..2026, ANTIGUO, INFORME REDES...).
 * No se mueve ningún archivo en R2: solo cambia de quién cuelga cada carpeta.
 *
 * Con --aplicar hace los cambios; sin él, solo enseña lo que haría.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const APLICAR = process.argv.includes("--aplicar");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const RAIZ_LOCAL = `${process.env.HOME}/Library/CloudStorage/GoogleDrive-direccion.grupohabana@gmail.com/Mi unidad/6.MARKETING HABANA`;
const EMPRESA = "00000000-0000-0000-0000-000000000001";
const CARPETA_RAIZ = "d064cdc9-4eca-4f60-abe9-ab07b14a1385";

/** dónde vive cada carpeta en Drive: nombre -> ruta padre */
const padreEnDrive = new Map();
(function walk(d, rel = "") {
  let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) {
    if (!x.isDirectory()) continue;
    const r = rel ? `${rel}/${x.name}` : x.name;
    padreEnDrive.set(r, rel);
    walk(path.join(d, x.name), r);
  }
})(RAIZ_LOCAL);

const { data: filas } = await admin.from("carpetas_documentos")
  .select("id, nombre, parent_id").eq("empresa_id", EMPRESA).eq("departamento", "MARKETING");
const porId = new Map((filas ?? []).map((f) => [f.id, f]));
const ruta = (id) => {
  const p = []; let c = porId.get(id);
  while (c && c.id !== CARPETA_RAIZ) { p.unshift(c.nombre); c = c.parent_id ? porId.get(c.parent_id) : null; }
  return p.join("/");
};
const porRuta = new Map();
for (const f of filas ?? []) if (f.id !== CARPETA_RAIZ) porRuta.set(ruta(f.id), f);

// Las que están en la raíz del software pero en Drive cuelgan de otra carpeta.
const mover = [];
for (const [r, f] of porRuta) {
  if (f.parent_id !== CARPETA_RAIZ) continue;          // solo las de primer nivel
  if (padreEnDrive.get(r) === "") continue;            // en Drive también va arriba: correcta
  // ¿en qué carpeta de Drive vive esta rama? Se busca por su nombre.
  const candidatas = [...padreEnDrive.entries()].filter(([k]) => k.endsWith(`/${f.nombre}`) && k.split("/").length === 2);
  if (candidatas.length !== 1) continue;               // ambiguo: no se toca
  const rutaPadre = candidatas[0][1];
  const destino = porRuta.get(rutaPadre);
  if (!destino) continue;
  mover.push({ f, destinoNombre: rutaPadre, destinoId: destino.id });
}

console.log(`${APLICAR ? "MOVIENDO" : "SIMULACIÓN"} · ${mover.length} carpetas mal colocadas\n`);
for (const m of mover) {
  console.log(`  "${m.f.nombre}"  ->  dentro de "${m.destinoNombre}"`);
  if (APLICAR) {
    const { error } = await admin.from("carpetas_documentos")
      .update({ parent_id: m.destinoId }).eq("id", m.f.id).eq("empresa_id", EMPRESA);
    if (error) console.log(`     ERROR: ${error.message}`);
  }
}
if (!APLICAR) console.log("\n(nada cambiado; con --aplicar se hace de verdad)");
