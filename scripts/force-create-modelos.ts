import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const content = fs.readFileSync(envPath, "utf-8");
for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const empresaId = "00000000-0000-0000-0000-000000000001";
  const ejercicio = 2026;

  const combos = [
    { tipo: "303", periodo: "Q1" }, { tipo: "303", periodo: "Q2" }, { tipo: "303", periodo: "Q3" }, { tipo: "303", periodo: "Q4" },
    { tipo: "130", periodo: "Q1" }, { tipo: "130", periodo: "Q2" }, { tipo: "130", periodo: "Q3" }, { tipo: "130", periodo: "Q4" },
    { tipo: "111", periodo: "Q1" }, { tipo: "111", periodo: "Q2" }, { tipo: "111", periodo: "Q3" }, { tipo: "111", periodo: "Q4" },
    { tipo: "115", periodo: "Q1" }, { tipo: "115", periodo: "Q2" }, { tipo: "115", periodo: "Q3" }, { tipo: "115", periodo: "Q4" },
    { tipo: "390", periodo: "ANUAL" },
    { tipo: "347", periodo: "ANUAL" },
  ];

  const rows = combos.map(c => ({
    empresa_id: empresaId, tipo: c.tipo, periodo: c.periodo, ejercicio, estado: "BORRADOR", casillas: {},
  }));

  const { data, error } = await supabase.from("modelos_aeat").insert(rows).select("id,tipo,periodo");
  if (error) console.log("✗ Error:", error.message);
  else console.log(`✓ Creados ${data?.length} modelos ejercicio ${ejercicio}`);
}
main();
