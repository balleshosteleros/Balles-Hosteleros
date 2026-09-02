/** Una linea por hora: porcentaje de cada empresa y cuanto queda. */
import fs from "node:fs";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const E = [
  { n: "HABANA", id: "00000000-0000-0000-0000-000000000001", gbTotal: 124.6 },
  { n: "BACANAL", id: "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47", gbTotal: 124.2 },
  { n: "BALLES", id: "eb99bddd-9f49-4348-96ee-37f930c0d5d0", gbTotal: 589.7 },
];
const partes = [];
let faltanGb = 0;
for (const e of E) {
  // Los GB dicen mucho mejor cuánto queda que el número de archivos: un vídeo
  // de 5 GB y una miniatura cuentan igual por archivo, pero no por tiempo.
  let bytes = 0;
  for (let d = 0; ; d += 1000) {
    const { data } = await admin.from("documentos").select("tamano_bytes")
      .eq("empresa_id", e.id).not("drive_file_id", "is", null).range(d, d + 999);
    const t = data ?? [];
    for (const r of t) bytes += Number(r.tamano_bytes ?? 0);
    if (t.length < 1000) break;
  }
  const gb = bytes / 1024 ** 3;
  faltanGb += Math.max(0, e.gbTotal - gb);
  partes.push(`${e.n} ${gb.toFixed(1).padStart(5)}/${e.gbTotal} GB`);
}
let bat = "";
try {
  const b = execSync("pmset -g batt", { encoding: "utf8" });
  bat = /AC Power/.test(b) ? "  enchufado" : `  SIN CARGADOR ${b.match(/(\d+)%/)?.[1]}%`;
} catch {}
const hora = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
console.log(`${hora}  ${partes.join("   ")}   faltan ${faltanGb.toFixed(1)} GB${faltanGb < 0.2 ? "  <-- COMPLETO" : ""}${bat}`);
