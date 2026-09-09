/**
 * One-shot: pone al día las campañas de cumpleaños con el texto canónico.
 *
 * Se usa cuando cambia el seed —otro texto, otro descuento, otra antelación— y
 * las campañas ya sembradas se quedarían con la versión vieja para siempre.
 * Añade también los momentos que falten (la felicitación del día).
 *
 * Solo toca campañas que NUNCA han salido: una que ya escribió a alguien es
 * historia y no se reescribe.
 *
 *   npx tsx scripts/refrescar-campana-cumpleanos.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  refrescarTextosCumpleanos,
  sembrarCampanaCumpleanosAEmpresa,
} from "../src/features/marketing/services/campana-cumpleanos";

config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: empresas, error } = await admin
    .from("empresas")
    .select("id, nombre, slug")
    .neq("slug", "balles-hosteleros")
    .order("nombre");
  if (error) throw error;

  for (const e of empresas ?? []) {
    const creadas = await sembrarCampanaCumpleanosAEmpresa(admin, e.id as string);
    const refrescadas = await refrescarTextosCumpleanos(admin, e.id as string);
    console.log(
      `${e.nombre}: ${creadas.creadas} creadas, ${refrescadas.actualizadas} puestas al día`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
