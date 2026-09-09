/**
 * Alta de un cliente que entra por WhatsApp.
 *
 * Es la única puerta por la que deben entrar esos contactos, venga de una
 * importación de Go High Level o —cuando esté— de la sesión de WhatsApp
 * conectada al software. Todas necesitan lo mismo y es fácil que una se olvide
 * de alguna pieza:
 *
 *   1. El nombre del perfil se descifra (`nombreDesdePerfil`) en vez de
 *      guardarse tal cual: "🌺 Zaira 🌺" → "Zaira", "ℙ𝕒𝕓𝕝𝕠" → "Pablo".
 *   2. El texto original se conserva en `nombre_whatsapp`, porque es como
 *      aparece esa persona en el móvil del restaurante.
 *   3. Si el nombre hubo que deducirlo, queda anotado en la actividad del
 *      cliente con origen `PERFIL_WHATSAPP`: nadie lo ha confirmado, y quien
 *      abra la ficha tiene que poder saberlo.
 *   4. El origen del cliente se marca como WHATSAPP, salvo que quien llama
 *      diga otro (`origen`): una exportación de un CRM trae gente que llegó
 *      por Instagram o por una campaña, y ese dato no se puede perder solo
 *      porque la conversación acabara en WhatsApp.
 *
 * No duplica: si ese teléfono o ese correo ya tienen ficha en la empresa, se
 * respeta la que hay. Un cliente que ya estaba no se sobrescribe con lo que
 * diga su perfil de WhatsApp — el nombre de la ficha suele estar confirmado y
 * el del perfil no.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { nombreDesdePerfil } from "@/shared/lib/nombre-desde-perfil";
import { normalizarTelefono, validarTelefono } from "@/shared/lib/validar-contacto";
import { registrarCambioDatosCliente } from "@/features/sala/lib/cliente-actividad";

export interface ContactoWhatsapp {
  /** Nombre de perfil, tal cual. Puede traer los apellidos dentro. */
  nombrePerfil: string;
  /** Con prefijo de país. Sin él no se guarda: ver `validar-contacto.ts`. */
  telefono: string | null;
  email?: string | null;
  /**
   * Cuándo se conoció a esta persona. Al importar es la fecha de alta en el
   * sistema de origen, para no perder su antigüedad; en un alta en vivo se
   * omite y vale la de hoy.
   */
  creadoAt?: string | null;
}

export type ResultadoAltaWhatsapp =
  | { estado: "creado"; clienteId: string; nombreDetectado: boolean }
  | { estado: "ya_existia"; clienteId: string }
  | { estado: "descartado"; motivo: string };

/**
 * Da de alta el contacto, o devuelve el que ya hubiera.
 *
 * `supabase` tiene que poder escribir en `clientes_sala` de esa empresa: en una
 * importación, con la clave de servicio; en un alta desde la app, con la sesión
 * del usuario, que la RLS ya acota.
 */
export async function altaContactoWhatsapp(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    contacto: ContactoWhatsapp;
    /** Quién lo importó, para la actividad. En un alta automática, null. */
    usuarioId?: string | null;
    usuarioNombre?: string | null;
    /**
     * Canal por el que la persona dejó sus datos la primera vez
     * (`clientes_sala.origen`). Sin pasarlo vale WHATSAPP, que es de donde
     * entra la inmensa mayoría; un importador que sepa el canal real lo pasa
     * aquí. `null` explícito = NO SE SABE, que es un valor legítimo y distinto
     * de inventarle un canal: ver la norma de `clientes_sala.origen`.
     */
    origen?: string | null;
  },
): Promise<ResultadoAltaWhatsapp> {
  const { empresaId, contacto } = params;
  const telefono = (contacto.telefono ?? "").trim() || null;
  const email = (contacto.email ?? "").trim().toLowerCase() || null;

  if (!telefono && !email) {
    return { estado: "descartado", motivo: "Sin teléfono ni correo." };
  }

  // Mismo criterio que el resto de puertas de alta: un teléfono sin prefijo o
  // inventado no entra. Es lo que evitó repetir el agujero de CoverManager.
  //
  // Pero un teléfono malo NO tira a la persona si dejó un correo válido: se
  // tira el teléfono y se queda ella. Al importar la base de Balles, un
  // interesado real se perdía entero por tener el móvil escrito con dígitos de
  // menos, teniendo su correo bien puesto al lado. Lo que hay que evitar es
  // GUARDAR un teléfono inventado, no perder a quien sí se puede contactar.
  let telefonoValido = telefono;
  if (telefonoValido) {
    const v = validarTelefono(telefonoValido, false);
    if (!v.ok) {
      if (!email) return { estado: "descartado", motivo: v.error };
      telefonoValido = null;
    }
  }

  const telN = telefonoValido ? normalizarTelefono(telefonoValido) : null;

  // ¿Ya está? Se busca por los dos contactos, que son los que tienen índice
  // único por empresa.
  const filtros: string[] = [];
  if (telN) filtros.push(`telefono_normalizado.eq.${telN}`);
  if (email) filtros.push(`email_normalizado.eq.${email}`);
  const { data: existente } = await supabase
    .from("clientes_sala")
    .select("id")
    .eq("empresa_id", empresaId)
    .or(filtros.join(","))
    .limit(1)
    .maybeSingle();
  if (existente?.id) {
    return { estado: "ya_existia", clienteId: existente.id as string };
  }

  const perfil = nombreDesdePerfil(contacto.nombrePerfil);

  const { data: creado, error } = await supabase
    .from("clientes_sala")
    .insert({
      empresa_id: empresaId,
      // Puede ser null: hay perfiles de los que no sale ningún nombre.
      nombre: perfil.nombre,
      telefono: telefonoValido,
      email,
      origen: params.origen === undefined ? "WHATSAPP" : params.origen,
      nombre_whatsapp: perfil.original || null,
      ...(contacto.creadoAt ? { created_at: contacto.creadoAt } : {}),
    })
    .select("id")
    .single();

  // 23505 = choque con el índice único de teléfono o correo de la empresa. Pasa
  // cuando dos altas del mismo contacto corren a la vez (una importación en
  // paralelo, o dos mensajes seguidos del mismo número): entre la comprobación
  // de arriba y este insert, la otra ya creó la ficha. No es un error: es que
  // el contacto ya está, así que se devuelve el que ganó.
  if (error?.code === "23505") {
    const { data: ganador } = await supabase
      .from("clientes_sala")
      .select("id")
      .eq("empresa_id", empresaId)
      .or(filtros.join(","))
      .limit(1)
      .maybeSingle();
    if (ganador?.id) {
      return { estado: "ya_existia", clienteId: ganador.id as string };
    }
  }
  if (error) throw error;

  const clienteId = creado.id as string;

  // Constancia: el nombre lo puso el perfil, no una persona. Solo cuando hubo
  // que descifrarlo — si el perfil ya traía "María José Pérez" no hay nada que
  // advertir, es el nombre tal cual lo escribió ella.
  if (perfil.nombre && perfil.detectado) {
    await registrarCambioDatosCliente(supabase, {
      empresaId,
      clienteId,
      antes: { nombre: null, apellidos: null, email: null, telefono: null },
      despues: {
        nombre: perfil.nombre,
        apellidos: null,
        email: null,
        telefono: null,
      },
      usuarioId: params.usuarioId ?? null,
      usuarioNombre: params.usuarioNombre ?? null,
      origen: "PERFIL_WHATSAPP",
    });
  }

  return { estado: "creado", clienteId, nombreDetectado: perfil.detectado };
}
