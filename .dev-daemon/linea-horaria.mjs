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
  { n: "HABANA", id: "00000000-0000-0000-0000-000000000001", total: 5263 },
  { n: "BACANAL", id: "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47", total: 3806 },
  { n: "BALLES", id: "eb99bddd-9f49-4348-96ee-37f930c0d5d0", total: 4217 },
];
const partes = [];
let faltan = 0;
for (const e of E) {
  const { count } = await admin.from("documentos").select("id", { count: "exact", head: true })
    .eq("empresa_id", e.id).not("drive_file_id", "is", null);
  const hechos = count ?? 0;
  faltan += Math.max(0, e.total - hechos);
  partes.push(`${e.n} ${((hechos / e.total) * 100).toFixed(1).padStart(5)}% (${hechos}/${e.total})`);
}
let bat = "";
try {
  const b = execSync("pmset -g batt", { encoding: "utf8" });
  bat = /AC Power/.test(b) ? "  enchufado" : `  SIN CARGADOR ${b.match(/(\d+)%/)?.[1]}%`;
} catch {}
const hora = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
console.log(`${hora}  ${partes.join("   ")}   faltan ${faltan}${faltan === 0 ? "  <-- COMPLETO" : ""}${bat}`);
