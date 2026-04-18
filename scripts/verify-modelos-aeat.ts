import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const content = fs.readFileSync(envPath, "utf-8");
for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  for (const t of ["modelos_aeat", "asignaciones_modelo", "reglas_categorizacion_ia"]) {
    const { error, count } = await supabase.from(t).select("*", { count: "exact", head: true });
    console.log(error ? `✗ ${t}: ${error.message}` : `✓ ${t} · ${count ?? 0} filas`);
  }

  const { error: fErr, count: fCnt } = await supabase.from("facturas").select("*", { count: "exact", head: true });
  console.log(fErr ? `\n✗ facturas: NO existe (${fErr.message})` : `\n✓ facturas · ${fCnt ?? 0} filas`);

  const { data: empresas, error: eErr } = await supabase.from("empresas").select("id, nombre, razon_social, nif").limit(5);
  if (eErr) console.log("empresas error:", eErr.message);
  else {
    console.log(`\nEmpresas (${empresas?.length ?? 0}):`);
    empresas?.forEach(e => console.log(`  ${e.nombre} · NIF: ${e.nif ?? "—"} · Razón: ${e.razon_social ?? "—"}`));
  }
}
main();
