/**
 * One-shot: siembra el calendario anual de campañas de email en las empresas
 * que ya existían antes de que el seed existiera. Las empresas nuevas lo reciben
 * solas desde `seedEmpresaDefaults`.
 *
 * Aditivo: solo crea los meses que faltan. Se puede ejecutar dos veces.
 *
 *   npx tsx scripts/sembrar-campanas-anuales.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { sembrarCampanasAnualesAEmpresa } from "../src/features/marketing/services/campanas-anuales";

config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Solo restaurantes: la gestora del grupo no tiene comedor ni clientes de sala
  // a los que escribir, así que no le corresponde calendario de campañas.
  const { data: empresas, error } = await admin
    .from("empresas")
    .select("id, nombre, slug")
    .neq("slug", "balles-hosteleros")
    .order("nombre");
  if (error) throw error;

  for (const e of empresas ?? []) {
    const r = await sembrarCampanasAnualesAEmpresa(admin, e.id as string);
    console.log(`${e.nombre}: ${r.creadas} campañas creadas`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
