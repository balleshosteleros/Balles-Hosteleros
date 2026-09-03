/**
 * Fusiona las carpetas que quedaron DUPLICADAS: la misma carpeta existe en la
 * raíz de MARKETING y dentro de `2.CONTENIDO HABANA`, con los archivos
 * repartidos entre las dos.
 *
 * Se conserva la que está en el sitio correcto (la de dentro), se le llevan
 * los archivos y subcarpetas de la otra, y la huérfana se borra vacía.
 * No se toca ningún archivo en R2: solo cambia de qué carpeta cuelgan.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const APLICAR = process.argv.includes("--aplicar");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const EMPRESA = "00000000-0000-0000-0000-000000000001";
const RAIZ = "d064cdc9-4eca-4f60-abe9-ab07b14a1385";

const { data: filas } = await admin.from("carpetas_documentos")
  .select("id, nombre, parent_id").eq("empresa_id", EMPRESA).eq("departamento", "MARKETING");
const contenido = filas.find((f) => f.nombre === "2.CONTENIDO HABANA" && f.parent_id === RAIZ);
if (!contenido) { console.log("no se encuentra 2.CONTENIDO HABANA"); process.exit(1); }

// Sueltas en la raíz que tienen gemela dentro de 2.CONTENIDO HABANA.
const enRaiz = filas.filter((f) => f.parent_id === RAIZ && f.id !== contenido.id);
const dentro = new Map(filas.filter((f) => f.parent_id === contenido.id).map((f) => [f.nombre, f]));

let movidos = 0, subs = 0, borradas = 0;
for (const huerfana of enRaiz) {
  const buena = dentro.get(huerfana.nombre);
  if (!buena) continue;   // no tiene gemela: no es este caso
  const { count: nArch } = await admin.from("documentos")
    .select("id", { count: "exact", head: true }).eq("carpeta_id", huerfana.id);
  const { count: nSub } = await admin.from("carpetas_documentos")
    .select("id", { count: "exact", head: true }).eq("parent_id", huerfana.id);
  console.log(`  "${huerfana.nombre}": ${nArch ?? 0} archivos y ${nSub ?? 0} subcarpetas -> se unen a la buena`);
  if (!APLICAR) continue;

  // Los archivos y subcarpetas pasan a la carpeta correcta.
  const { error: e1 } = await admin.from("documentos")
    .update({ carpeta_id: buena.id }).eq("carpeta_id", huerfana.id).eq("empresa_id", EMPRESA);
  if (e1) { console.log(`     ERROR archivos: ${e1.message}`); continue; }
  movidos += nArch ?? 0;

  // Las subcarpetas se mueven una a una: si ya hay una del mismo nombre en
  // destino, chocaría; en ese caso se deja donde está y se avisa.
  const { data: hijas } = await admin.from("carpetas_documentos")
    .select("id, nombre").eq("parent_id", huerfana.id);
  for (const h of hijas ?? []) {
    const { error } = await admin.from("carpetas_documentos")
      .update({ parent_id: buena.id }).eq("id", h.id).eq("empresa_id", EMPRESA);
    if (error) console.log(`     "${h.nombre}" no se pudo mover: ${error.message.slice(0, 60)}`);
    else subs++;
  }

  // Solo se borra si quedó vacía de verdad.
  const { count: quedanA } = await admin.from("documentos")
    .select("id", { count: "exact", head: true }).eq("carpeta_id", huerfana.id);
  const { count: quedanC } = await admin.from("carpetas_documentos")
    .select("id", { count: "exact", head: true }).eq("parent_id", huerfana.id);
  if ((quedanA ?? 0) === 0 && (quedanC ?? 0) === 0) {
    const { error } = await admin.from("carpetas_documentos")
      .delete().eq("id", huerfana.id).eq("empresa_id", EMPRESA);
    if (!error) borradas++;
  } else {
    console.log(`     se deja: aún tiene ${quedanA} archivos y ${quedanC} subcarpetas`);
  }
}
console.log(APLICAR
  ? `\n${movidos} archivos y ${subs} subcarpetas recolocados · ${borradas} carpetas duplicadas eliminadas`
  : "\n(simulación; con --aplicar se hace de verdad)");
