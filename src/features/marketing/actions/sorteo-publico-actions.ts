"use server";

/**
 * Alta desde la web: quien deja sus datos para el sorteo del mes.
 *
 * Es una puerta PÚBLICA, sin sesión: cualquiera que pase por la página del
 * restaurante puede escribir aquí. Por eso valida con el mismo criterio que el
 * resto de las altas de cliente (`validar-contacto`) y usa el cliente admin en
 * lugar de la sesión del visitante, que no existe.
 *
 * Quien se apunta ENTRA EN LA BASE DE CLIENTES como cualquier otro, con
 * `origen = WEB` y el permiso de correo dado: es un cliente del restaurante que
 * todavía no ha venido. No se crea una lista de suscriptores aparte, que sería
 * un segundo censo de personas que luego nadie cruza con el primero.
 *
 * Si ya tenía ficha —reservó hace un año, o entró por WhatsApp— no se duplica:
 * se le completa lo que falte y se le da el permiso. Lo que nunca se pisa es un
 * dato que ya estaba: el nombre de la ficha suele estar confirmado y el del
 * formulario lo escribe alguien con prisa.
 */

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarEmail, validarNombre, validarTelefono } from "@/shared/lib/validar-contacto";
import { normalizarNombre } from "@/shared/lib/normalizar-nombre";
import { tokenDeBaja } from "@/features/marketing/services/baja-marketing";
import { enviarBienvenidaSorteo } from "@/lib/email/marketing/bienvenida-sorteo";
import { getSiteUrl } from "@/lib/site-url";

const Schema = z.object({
  empresaSlug: z.string().trim().min(1),
  nombre: z.string().trim().min(1).max(120),
  apellidos: z.string().trim().min(1).max(120),
  /** La pide el sorteo de cumpleaños, y es lo que hace que el regalo tenga día. */
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  telefono: z.string().trim().min(1).max(40),
  email: z.string().trim().min(1).max(160),
});

export type SuscribirSorteoInput = z.input<typeof Schema>;

export interface ResultadoSuscripcion {
  ok: boolean;
  /** Mensaje para el visitante. En un formulario público no vale un código. */
  error?: string;
}

export async function suscribirSorteo(
  input: SuscribirSorteoInput,
): Promise<ResultadoSuscripcion> {
  try {
    const parsed = Schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Revisa los datos: falta algo por rellenar." };
    }
    const d = parsed.data;

    // Mismo criterio que en sala: nombre real, teléfono con prefijo de país y
    // correo con forma de correo. Un formulario abierto en internet es justo
    // donde entran los "asdf" y los teléfonos de relleno.
    const vNombre = validarNombre(d.nombre);
    if (!vNombre.ok) return { ok: false, error: vNombre.error };
    const vTel = validarTelefono(d.telefono);
    if (!vTel.ok) return { ok: false, error: vTel.error };
    const vEmail = validarEmail(d.email);
    if (!vEmail.ok) return { ok: false, error: vEmail.error };

    // Nadie nace mañana. Sin este corte, una errata al teclear el año deja una
    // fecha futura que rompe el cálculo del cumpleaños.
    const hoy = new Date().toISOString().slice(0, 10);
    if (d.fechaNacimiento > hoy) {
      return { ok: false, error: "Revisa la fecha de nacimiento." };
    }

    const admin = createAdminClient();
    const { data: empresa } = await admin
      .from("empresas")
      .select("id, slug")
      .eq("slug", d.empresaSlug)
      .maybeSingle();
    if (!empresa) return { ok: false, error: "No encontramos el restaurante." };
    const empresaId = empresa.id as string;

    const nombre = normalizarNombre(d.nombre);
    const apellidos = normalizarNombre(d.apellidos);
    const email = d.email.trim().toLowerCase();
    const telefono = d.telefono.trim();
    const telNormalizado = telefono.replace(/\D/g, "").replace(/^(0034|34)(?=[6-9]\d{8}$)/, "");

    // ¿Ya está? Se busca por los dos contactos, que son los que tienen índice
    // único por empresa.
    const { data: existente } = await admin
      .from("clientes_sala")
      .select("id, nombre, apellidos, fecha_nacimiento, telefono, email")
      .eq("empresa_id", empresaId)
      .or(`email_normalizado.eq.${email},telefono_normalizado.eq.${telNormalizado}`)
      .limit(1)
      .maybeSingle();

    let clienteId: string;
    if (existente?.id) {
      clienteId = existente.id as string;
      // Solo se rellenan huecos. El permiso sí se actualiza siempre: acaba de
      // darlo él mismo en un formulario, y eso es un consentimiento nuevo.
      await admin
        .from("clientes_sala")
        .update({
          ...(existente.nombre ? {} : { nombre }),
          ...(existente.apellidos ? {} : { apellidos }),
          ...(existente.fecha_nacimiento
            ? {}
            : { fecha_nacimiento: d.fechaNacimiento }),
          ...(existente.email ? {} : { email }),
          ...(existente.telefono ? {} : { telefono }),
          acepta_marketing_email: true,
          marketing_optin_origen: "WEB_SORTEO",
          marketing_optin_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", clienteId);
    } else {
      const { data: creado, error } = await admin
        .from("clientes_sala")
        .insert({
          empresa_id: empresaId,
          nombre,
          apellidos,
          email,
          telefono,
          fecha_nacimiento: d.fechaNacimiento,
          // Por dónde entró: la web. Es el primer uso de ese origen y lo que
          // permitirá medir cuánta clientela trae la página.
          origen: "WEB",
          acepta_marketing_email: true,
          marketing_optin_origen: "WEB_SORTEO",
          marketing_optin_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) {
        // 23505: entre la comprobación y el insert otro envío creó la ficha (dos
        // clics seguidos en el botón). No es un error para el visitante: está
        // dentro igualmente.
        if (error.code === "23505") return { ok: true };
        throw error;
      }
      clienteId = creado.id as string;
    }

    // El correo va DESPUÉS de guardar y no bloquea la respuesta: si Resend
    // tarda o falla, el visitante ya está apuntado y no debe ver un error por
    // algo que no le afecta. El fallo queda en el log.
    const base = getSiteUrl().replace(/\/$/, "");
    const urlBaja = `${base}/baja/${empresa.slug as string}/${tokenDeBaja(clienteId)}`;
    try {
      await enviarBienvenidaSorteo({
        empresaId,
        email,
        nombre,
        urlBaja,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error("[sorteo] bienvenida:", msg);
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sorteo] suscribirSorteo:", msg);
    return {
      ok: false,
      error: "No hemos podido apuntarte. Inténtalo en un momento.",
    };
  }
}
