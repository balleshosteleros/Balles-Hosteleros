import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const EMPRESAS = [
  { nombre: "HABANA", id: "00000000-0000-0000-0000-000000000001", total: 5263, totalGb: 124.6 },
  { nombre: "BACANAL", id: "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47", total: 3806, totalGb: 124.2 },
  { nombre: "BALLES", id: "eb99bddd-9f49-4348-96ee-37f930c0d5d0", total: 4217, totalGb: 589.7 },
];
const ahora = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
const L = [`COMO VA LA MIGRACION DE MARKETING`, `Actualizado: ${ahora}`, ""];
let faltanTotal = 0;
let gbHechosTotal = 0;
let gbTotalTotal = 0;
for (const e of EMPRESAS) {
  const { count } = await admin.from("documentos").select("id", { count: "exact", head: true })
    .eq("empresa_id", e.id).not("drive_file_id", "is", null);
  const hechos = count ?? 0;
  const pct = ((hechos / e.total) * 100).toFixed(1);
  const faltan = e.total - hechos;
  faltanTotal += Math.max(0, faltan);
  const barra = "#".repeat(Math.round(pct / 2.5)).padEnd(40, ".");
  const { data: imp } = await admin.from("archivos_importaciones")
    .select("estado, fallidos, copiados_bytes").eq("empresa_id", e.id).maybeSingle();
  // Los GB, sumados de los propios documentos: la tabla del importador solo
  // sabe de lo que vino por la API de Drive, y BALLES se subió desde el disco.
  let bytes = 0;
  for (let desde = 0; ; desde += 1000) {
    const { data: t } = await admin.from("documentos").select("tamano_bytes")
      .eq("empresa_id", e.id).not("drive_file_id", "is", null).range(desde, desde + 999);
    const filas = t ?? [];
    for (const f of filas) bytes += Number(f.tamano_bytes ?? 0);
    if (filas.length < 1000) break;
  }
  const gb = (bytes / 1024 ** 3).toFixed(1);
  gbHechosTotal += bytes / 1024 ** 3;
  gbTotalTotal += e.totalGb;
  // El porcentaje va por PESO, no por numero de archivos: mil fotos pequeñas
  // no son el trabajo; los videos de varios GB si. Por archivos parecia que
  // BALLES iba por el 58% cuando en tamaño no llegaba al 4%.
  const pctGb = ((bytes / 1024 ** 3) / e.totalGb) * 100;
  const barraGb = "#".repeat(Math.round(pctGb / 2.5)).padEnd(40, ".");
  L.push(`${e.nombre}`, `  [${barraGb}] ${pctGb.toFixed(1)}%`,
    `  ${hechos} de ${e.total} archivos  ·  ${gb} de ${e.totalGb} GB`,
    `  faltan ${faltan} archivos (${(e.totalGb - bytes / 1024 ** 3).toFixed(1)} GB)${faltan === 0 ? "  -- TERMINADO" : ""}`,
    `  estado: ${imp?.estado ?? (faltan === 0 ? "terminada" : "copiando ahora")}${imp?.fallidos ? `  ·  ${imp.fallidos} no se pudieron traer` : ""}`, "");
}
L.push(faltanTotal === 0
  ? "MIGRACION COMPLETA. Ya puedes borrar lo de Drive."
  : `Quedan ${faltanTotal} archivos en total  ·  ${(gbTotalTotal - gbHechosTotal).toFixed(1)} GB de ${gbTotalTotal.toFixed(1)} GB`);
// Aviso de bateria: sin corriente el Mac se apaga y la copia se para en seco.
import { execSync } from "node:child_process";
try {
  const batt = execSync("pmset -g batt", { encoding: "utf8" });
  const pct = batt.match(/(\d+)%/)?.[1];
  const conCable = /AC Power/.test(batt);
  L.push("");
  if (conCable) L.push(`Corriente: ENCHUFADO (bateria ${pct}%)`);
  else L.push(`*** OJO: SIN CARGADOR - bateria ${pct}% ***`,
              "    Si se apaga, la copia se para donde este.");
} catch {}
// El historial, en el mismo parte: antes vivia en un segundo fichero y habia
// que abrir dos ventanas para saber si la copia avanzaba o estaba encallada.
try {
  const previas = fs.readFileSync(".dev-daemon/migracion-por-horas.txt", "utf8")
    .split("\n").filter((l) => /^\d+\/\d+,/.test(l)).slice(-8);
  if (previas.length) L.push("", "COMO HA IDO, HORA A HORA", ...previas);
} catch {}
L.push("", "Si el ordenador se apago o suspendio, la copia se para.",
  "Los archivos siguen tambien en ~/Library/CloudStorage por si acaso.");
console.log(L.join("\n"));
