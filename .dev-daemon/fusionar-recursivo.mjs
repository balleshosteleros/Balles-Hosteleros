/**
 * Fusiona carpetas duplicadas a CUALQUIER profundidad.
 *
 * La duplicación se repite en cascada: "2025" estaba dos veces, y dentro de
 * cada una los mismos meses, y dentro de cada mes las mismas subcarpetas. Una
 * fusión de un solo nivel choca contra la restricción de nombre único; hay que
 * bajar recursivamente: se funden primero las hojas y luego los padres.
 *
 * Regla: de cada par se conserva la carpeta que está en la rama CORRECTA
 * (la que coincide con Drive) y se le lleva todo lo de la otra.
 * No se toca R2: solo cambia de qué carpeta cuelga cada cosa.
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

let movArch = 0, movCarp = 0, borradas = 0;

/** Une `origen` dentro de `destino`, bajando por las subcarpetas que choquen. */
async function fundir(origenId, destinoId, sangria = "  ") {
  // 1. Las subcarpetas: si en destino ya hay una con el mismo nombre, se
  //    fusionan entre ellas (recursivo); si no, basta con recolgarla.
  const { data: hijasO } = await admin.from("carpetas_documentos")
    .select("id, nombre").eq("parent_id", origenId).eq("empresa_id", EMPRESA);
  const { data: hijasD } = await admin.from("carpetas_documentos")
    .select("id, nombre").eq("parent_id", destinoId).eq("empresa_id", EMPRESA);
  const enDestino = new Map((hijasD ?? []).map((h) => [h.nombre, h.id]));

  for (const h of hijasO ?? []) {
    const gemela = enDestino.get(h.nombre);
    if (gemela) {
      await fundir(h.id, gemela, sangria + "  ");
    } else if (APLICAR) {
      const { error } = await admin.from("carpetas_documentos")
        .update({ parent_id: destinoId }).eq("id", h.id).eq("empresa_id", EMPRESA);
      if (!error) movCarp++;
      else console.log(`${sangria}! "${h.nombre}": ${error.message.slice(0, 50)}`);
    } else movCarp++;
  }

  // 2. Los archivos que colgaban del origen pasan al destino.
  const { count } = await admin.from("documentos")
    .select("id", { count: "exact", head: true }).eq("carpeta_id", origenId);
  if ((count ?? 0) > 0) {
    if (APLICAR) {
      const { error } = await admin.from("documentos")
        .update({ carpeta_id: destinoId }).eq("carpeta_id", origenId).eq("empresa_id", EMPRESA);
      if (!error) movArch += count ?? 0;
    } else movArch += count ?? 0;
  }

  // 3. Si quedó vacía, fuera.
  if (!APLICAR) { borradas++; return; }
  const { count: qa } = await admin.from("documentos")
    .select("id", { count: "exact", head: true }).eq("carpeta_id", origenId);
  const { count: qc } = await admin.from("carpetas_documentos")
    .select("id", { count: "exact", head: true }).eq("parent_id", origenId);
  if ((qa ?? 0) === 0 && (qc ?? 0) === 0) {
    const { error } = await admin.from("carpetas_documentos")
      .delete().eq("id", origenId).eq("empresa_id", EMPRESA);
    if (!error) borradas++;
  }
}

// Punto de partida: las sueltas en la raíz con gemela dentro de 2.CONTENIDO HABANA.
const RAIZ = "d064cdc9-4eca-4f60-abe9-ab07b14a1385";
const { data: filas } = await admin.from("carpetas_documentos")
  .select("id, nombre, parent_id").eq("empresa_id", EMPRESA).eq("departamento", "MARKETING");
const contenido = filas.find((f) => f.nombre === "2.CONTENIDO HABANA" && f.parent_id === RAIZ);
const dentro = new Map(filas.filter((f) => f.parent_id === contenido.id).map((f) => [f.nombre, f.id]));

console.log(APLICAR ? "FUSIONANDO\n" : "SIMULACIÓN\n");
for (const f of filas.filter((x) => x.parent_id === RAIZ && x.id !== contenido.id)) {
  const gemela = dentro.get(f.nombre);
  if (!gemela) continue;
  console.log(`  "${f.nombre}"`);
  await fundir(f.id, gemela);
}
console.log(`\n${movArch} archivos y ${movCarp} carpetas recolocados · ${borradas} duplicadas eliminadas`);
