import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const content = fs.readFileSync(envPath, "utf-8");
for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

(async () => {
  // Usar pg_meta via REST no es directo, así que probamos a hacer "select 1 from <tabla>" para cada candidata
  const candidatas = [
    "empresas", "profiles", "user_roles",
    "empleados", "empleados_rrhh", "rrhh_empleados",
    "contratos", "nominas",
    "proveedores", "productos",
    "mermas", "escandallos", "recetas",
    "pos_sesiones_caja", "pos_tickets", "pos_ticket_lineas", "pos_pagos",
    "aperturas", "campanas_marketing",
    "ingredientes_proveedor", "ingredientes",
  ];
  for (const t of candidatas) {
    const { error, count } = await sb.from(t).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`❌ ${t}: ${error.code} — ${error.message.slice(0, 80)}`);
    } else {
      console.log(`✅ ${t}: ${count ?? 0} filas`);
    }
  }
})();
