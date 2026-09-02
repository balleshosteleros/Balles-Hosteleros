/** Cuantos archivos faltan por copiar. Imprime solo el numero. */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const E = [
  { id: "00000000-0000-0000-0000-000000000001", total: 5263 },
  { id: "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47", total: 3806 },
  { id: "eb99bddd-9f49-4348-96ee-37f930c0d5d0", total: 4217 },
];
let faltan = 0;
for (const e of E) {
  const { count } = await admin.from("documentos").select("id", { count: "exact", head: true })
    .eq("empresa_id", e.id).not("drive_file_id", "is", null);
  faltan += Math.max(0, e.total - (count ?? 0));
}
console.log(faltan);
