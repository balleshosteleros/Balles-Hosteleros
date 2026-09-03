/** Cuantos GB llevan HABANA y BACANAL, contra lo que hay en Drive. */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const E = [
  { n: "HABANA", id: "00000000-0000-0000-0000-000000000001", totalGb: 124.6, totalArch: 5263 },
  { n: "BACANAL", id: "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47", totalGb: 124.2, totalArch: 3806 },
];
let hechoGb = 0, totalGb = 0;
const filas = [];
for (const e of E) {
  let bytes = 0, n = 0;
  for (let d = 0; ; d += 1000) {
    const { data } = await admin.from("documentos").select("tamano_bytes")
      .eq("empresa_id", e.id).not("drive_file_id", "is", null).range(d, d + 999);
    const t = data ?? [];
    for (const r of t) bytes += Number(r.tamano_bytes ?? 0);
    n += t.length;
    if (t.length < 1000) break;
  }
  const gb = bytes / 1024 ** 3;
  hechoGb += gb; totalGb += e.totalGb;
  filas.push(`  ${e.n.padEnd(8)} ${gb.toFixed(1).padStart(6)} GB de ${e.totalGb} GB   ·  faltan ${(e.totalGb - gb).toFixed(1)} GB   (${n}/${e.totalArch} archivos)`);
}
console.log(filas.join("\n"));
console.log(`  ${"TOTAL".padEnd(8)} ${hechoGb.toFixed(1).padStart(6)} GB de ${totalGb.toFixed(1)} GB   ·  faltan ${(totalGb - hechoGb).toFixed(1)} GB`);
