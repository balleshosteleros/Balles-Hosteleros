/**
 * One-shot: siembra la campaña de cumpleaños (correo, WhatsApp y SMS) en las
 * empresas que ya existían antes de que el seed existiera. Las nuevas la reciben
 * solas desde `seedEmpresaDefaults`.
 *
 * Aditivo: solo crea el canal que falte. Se puede ejecutar dos veces. Las tres
 * campañas quedan en BORRADOR: sembrar no enciende nada.
 *
 *   npx tsx scripts/sembrar-campana-cumpleanos.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { sembrarCampanaCumpleanosAEmpresa } from "../src/features/marketing/services/campana-cumpleanos";

config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Solo restaurantes: la gestora del grupo no tiene comedor ni clientes de sala
  // a los que felicitar.
  const { data: empresas, error } = await admin
    .from("empresas")
    .select("id, nombre, slug")
    .neq("slug", "balles-hosteleros")
    .order("nombre");
  if (error) throw error;

  for (const e of empresas ?? []) {
    const r = await sembrarCampanaCumpleanosAEmpresa(admin, e.id as string);
    console.log(`${e.nombre}: ${r.creadas} campañas de cumpleaños creadas`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
