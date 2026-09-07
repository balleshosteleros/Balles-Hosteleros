/**
 * Rellena el nombre de las fichas que solo tienen el del perfil de WhatsApp.
 *
 * Al importar contactos de WhatsApp, el nombre que traen es el del perfil y a
 * veces no hay forma de usarlo: "❤️", "S.", "😎🙃🤓". Esas fichas se quedan sin
 * nombre a propósito, con el original guardado en `nombre_whatsapp`.
 *
 * Pero debajo de muchos de esos textos SÍ hay un nombre: letras de fantasía
 * ("𝒜𝓃𝒹𝓇𝑒𝒶 𝒫𝒶𝑒𝓏"), nombres deletreados ("C L a u d i a") o rodeados de
 * adornos ("══ஜ ★ 𝕀𝕟𝕞𝕒 ★ ஜ══"). Este script los descifra con
 * `shared/lib/nombre-desde-perfil.ts` y los escribe, dejando constancia en la
 * actividad del cliente (origen `PERFIL_WHATSAPP`) de que ese nombre se dedujo
 * y nadie lo ha confirmado.
 *
 * Se puede volver a pasar cuando la detección mejore: solo mira fichas que
 * siguen sin nombre, así que nunca pisa uno escrito por una persona.
 *
 * Uso:
 *   npx tsx scripts/descifrar-nombres-whatsapp.ts BACANAL
 *   npx tsx scripts/descifrar-nombres-whatsapp.ts BACANAL --aplicar
 */

import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { nombreDesdePerfil } from "@/shared/lib/nombre-desde-perfil";
import { registrarCambioDatosCliente } from "@/features/sala/lib/cliente-actividad";

function leerEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
    if (!linea.includes("=") || linea.startsWith("#")) continue;
    const i = linea.indexOf("=");
    out[linea.slice(0, i).trim()] = linea
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const empresaNombre = process.argv[2];
  const aplicar = process.argv.includes("--aplicar");
  if (!empresaNombre) {
    console.error(
      "Uso: npx tsx scripts/descifrar-nombres-whatsapp.ts <EMPRESA> [--aplicar]",
    );
    process.exit(1);
  }

  const env = leerEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  ) as unknown as SupabaseClient;

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nombre")
    .eq("nombre", empresaNombre)
    .single();
  if (!empresa) {
    console.error(`No existe la empresa "${empresaNombre}".`);
    process.exit(1);
  }

  // Por tandas: Supabase corta en 1.000 filas sin avisar.
  const fichas: { id: string; nombre_whatsapp: string }[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("clientes_sala")
      .select("id, nombre_whatsapp")
      .eq("empresa_id", empresa.id as string)
      .is("nombre", null)
      .not("nombre_whatsapp", "is", null)
      .range(desde, desde + 999);
    if (error) throw error;
    fichas.push(...(data as { id: string; nombre_whatsapp: string }[]));
    if (!data || data.length < 1000) break;
  }

  console.log(
    `${empresa.nombre} · ${fichas.length} fichas sin nombre con perfil de WhatsApp`,
  );
  if (!aplicar) console.log("SIMULACIÓN (sin --aplicar no se escribe nada)\n");

  let descifrados = 0;
  const muestra: string[] = [];
  for (const ficha of fichas) {
    const perfil = nombreDesdePerfil(ficha.nombre_whatsapp);
    if (!perfil.nombre) continue;
    descifrados++;
    if (muestra.length < 15) {
      muestra.push(`   ${JSON.stringify(perfil.original)} → ${perfil.nombre}`);
    }
    if (!aplicar) continue;

    const { error } = await supabase
      .from("clientes_sala")
      .update({ nombre: perfil.nombre, updated_at: new Date().toISOString() })
      .eq("id", ficha.id);
    if (error) throw error;

    await registrarCambioDatosCliente(supabase, {
      empresaId: empresa.id as string,
      clienteId: ficha.id,
      antes: { nombre: null, apellidos: null, email: null, telefono: null },
      despues: {
        nombre: perfil.nombre,
        apellidos: null,
        email: null,
        telefono: null,
      },
      usuarioId: null,
      usuarioNombre: null,
      origen: "PERFIL_WHATSAPP",
    });
  }

  console.log(muestra.join("\n"));
  console.log(
    `\n${aplicar ? "escritos" : "se escribirían"}: ${descifrados} · siguen sin nombre: ${fichas.length - descifrados}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
