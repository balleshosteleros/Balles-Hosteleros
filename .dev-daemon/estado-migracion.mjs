import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const EMPRESAS = [
  { nombre: "HABANA", id: "00000000-0000-0000-0000-000000000001", total: 5263 },
  { nombre: "BACANAL", id: "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47", total: 3806 },
];
const ahora = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
const L = [`COMO VA LA MIGRACION DE MARKETING`, `Actualizado: ${ahora}`, ""];
let faltanTotal = 0;
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
  const gb = ((Number(imp?.copiados_bytes ?? 0)) / 1024 ** 3).toFixed(1);
  L.push(`${e.nombre}`, `  [${barra}] ${pct}%`,
    `  ${hechos} de ${e.total} archivos  (${gb} GB)`,
    `  faltan ${faltan}${faltan === 0 ? "  -- TERMINADO" : ""}`,
    `  estado: ${imp?.estado ?? "?"}${imp?.fallidos ? `  ·  ${imp.fallidos} no se pudieron traer` : ""}`, "");
}
L.push(faltanTotal === 0
  ? "MIGRACION COMPLETA. Ya puedes borrar lo de Drive."
  : `Quedan ${faltanTotal} archivos en total.`);
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
L.push("", "Si el ordenador se apago o suspendio, la copia se para.",
  "Los archivos siguen tambien en ~/Library/CloudStorage por si acaso.");
console.log(L.join("\n"));
