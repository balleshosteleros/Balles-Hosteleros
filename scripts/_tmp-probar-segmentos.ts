import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  contarSegmento,
  destinatariosDeCampanaPorCanal,
} from "../src/features/marketing/lib/segmento-resolver";
config({ path: ".env.local" });

const BACANAL = "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47";

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const casos: Array<[string, Parameters<typeof contarSegmento>[2]]> = [
    ["Todos (sin filtros)", { operador: "AND", condiciones: [] }],
    ["VIP", { operador: "AND", condiciones: [{ tipo: "clasificacion", valores: ["VIP"] }] }],
    ["5+ visitas", { operador: "AND", condiciones: [{ tipo: "visitas_min", min: 5 }] }],
    ["Sin venir 180 dias", { operador: "AND", condiciones: [{ tipo: "sin_visitar_desde_dias", min: 180 }] }],
    ["Cumple en 7 dias", { operador: "AND", condiciones: [{ tipo: "cumple_en_dias", dias: 7 }] }],
    ["Cumple en octubre", { operador: "AND", condiciones: [{ tipo: "cumple_mes", meses: [10] }] }],
    ["Nota >= 8", { operador: "AND", condiciones: [{ tipo: "valoracion_min", min: 8 }] }],
    ["Ha valorado", { operador: "AND", condiciones: [{ tipo: "ha_valorado", valor: true }] }],
    ["Alta despues 01-01-2026", { operador: "AND", condiciones: [{ tipo: "alta_despues", fecha: "2026-01-01" }] }],
    ["Sin plantones", { operador: "AND", condiciones: [{ tipo: "no_shows_max", max: 0 }] }],
    ["VIP O 5+ visitas", { operador: "OR", condiciones: [{ tipo: "clasificacion", valores: ["VIP"] }, { tipo: "visitas_min", min: 5 }] }],
  ];

  for (const [nombre, seg] of casos) {
    const encajan = await contarSegmento(admin, BACANAL, seg);
    const conPermiso = await destinatariosDeCampanaPorCanal(admin, BACANAL, { ...seg, soloConPermiso: true }, "email");
    const sinPermiso = await destinatariosDeCampanaPorCanal(admin, BACANAL, { ...seg, soloConPermiso: false }, "email");
    console.log(
      `${nombre.padEnd(28)} encajan ${String(encajan).padStart(6)} | con permiso ${String(conPermiso.length).padStart(6)} | sin permiso ${String(sinPermiso.length).padStart(6)}`,
    );
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
