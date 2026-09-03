/** Compara el árbol de carpetas de Drive con el del software. */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const RAIZ = `${process.env.HOME}/Library/CloudStorage/GoogleDrive-direccion.grupohabana@gmail.com/Mi unidad/6.MARKETING HABANA`;
const EMPRESA = "00000000-0000-0000-0000-000000000001";
const CARPETA_RAIZ = "d064cdc9-4eca-4f60-abe9-ab07b14a1385";

/** Rutas relativas de todas las carpetas de Drive. */
const enDrive = new Set();
(function walk(d, rel = "") {
  let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) {
    if (!x.isDirectory()) continue;
    const r = rel ? `${rel}/${x.name}` : x.name;
    enDrive.add(r);
    walk(path.join(d, x.name), r);
  }
})(RAIZ);

/** Carpetas del software, con su ruta reconstruida. */
const { data: filas } = await admin.from("carpetas_documentos")
  .select("id, nombre, parent_id").eq("empresa_id", EMPRESA).eq("departamento", "MARKETING");
const porId = new Map((filas ?? []).map((f) => [f.id, f]));
function ruta(id) {
  const partes = [];
  let cur = porId.get(id);
  while (cur && cur.id !== CARPETA_RAIZ) {
    partes.unshift(cur.nombre);
    cur = cur.parent_id ? porId.get(cur.parent_id) : null;
  }
  return partes.join("/");
}
const enApp = new Map();
for (const f of filas ?? []) {
  if (f.id === CARPETA_RAIZ) continue;
  enApp.set(ruta(f.id), f);
}

const sobran = [...enApp.keys()].filter((r) => !enDrive.has(r)).sort();
const faltan = [...enDrive].filter((r) => !enApp.has(r)).sort();
console.log(`Drive: ${enDrive.size} carpetas · software: ${enApp.size}`);
console.log(`\nEN EL SOFTWARE PERO NO EN DRIVE (mal colocadas): ${sobran.length}`);
for (const r of sobran.slice(0, 25)) {
  const f = enApp.get(r);
  console.log(`   ${r}   [${f.id}]`);
}
console.log(`\nEN DRIVE PERO NO EN EL SOFTWARE: ${faltan.length}`);
for (const r of faltan.slice(0, 25)) console.log(`   ${r}`);
