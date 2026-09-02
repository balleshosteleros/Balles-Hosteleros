"use server";

/**
 * Aviso al entrar en Reservas (PRP-082 §5.6).
 *
 * Los reintentos corren solos, de madrugada, y nadie los está mirando. Si el
 * resultado no salta a la vista, el restaurante se entera de que no cobró
 * cuando ya da igual.
 *
 * Solo devuelve lo que necesita una DECISIÓN. Si no hay nada pendiente, no
 * devuelve nada: una barra fija diciendo "todo bien" solo estorba.
 */

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Cada situación que reclama atención, con su urgencia. */
export type TipoAvisoCobro =
  | "cobro_pendiente"
  | "cobro_agotado"
  | "retencion_por_caducar"
  | "garantia_sin_tarjeta"
  | "garantia_solicitada"
  | "garantia_sin_tarjeta_vencida";

export interface AvisoCobro {
  tipo: TipoAvisoCobro;
  reservaIds: string[];
  /** Frase ya montada, en la voz del restaurante. */
  texto: string;
}

export interface ResumenAvisosCobro {
  total: number;
  avisos: AvisoCobro[];
}

const VACIO: ResumenAvisosCobro = { total: 0, avisos: [] };

/** Menos de esto para que caduque una retención ya es urgente. */
const HORAS_AVISO_CADUCIDAD = 24;

export async function getAvisosCobro(): Promise<ResumenAvisosCobro> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return VACIO;

    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return VACIO;

    // Una sola consulta: son pocas reservas (solo las que llevan tarjeta) y
    // así el aviso no cuesta cuatro viajes a la base de datos.
    const { data, error } = await supabase
      .from("reservas")
      .select(
        "id, fecha, garantia_estado, garantia_capture_deadline, tiene_garantia, cancelacion_estado, cancelacion_proximo_intento_at, cancelacion_intentos, cobro_perdonado_at, garantia_solicitada_at, garantia_limite_at, garantia_cancelada_sin_tarjeta_at",
      )
      .eq("empresa_id", empresaId)
      .or("tiene_garantia.eq.true,tiene_cancelacion.eq.true");
    if (error) throw error;

    const filas = data ?? [];
    const ahora = Date.now();
    const limiteCaducidad = ahora + HORAS_AVISO_CADUCIDAD * 3_600_000;

    const cobroPendiente: string[] = [];
    const cobroAgotado: string[] = [];
    const porCaducar: string[] = [];
    const sinTarjeta: string[] = [];
    const solicitadas: string[] = [];
    const vencidasSinTarjeta: string[] = [];

    for (const r of filas) {
      // Una decisión humana cierra el asunto: no se vuelve a avisar.
      if (r.cobro_perdonado_at) continue;

      if (r.cancelacion_estado === "fallida") {
        if (r.cancelacion_proximo_intento_at) cobroPendiente.push(r.id as string);
        else cobroAgotado.push(r.id as string);
      }

      if (r.garantia_estado === "retenida" && r.garantia_capture_deadline) {
        const vence = Date.parse(r.garantia_capture_deadline as string);
        if (Number.isFinite(vence) && vence > ahora && vence < limiteCaducidad) {
          porCaducar.push(r.id as string);
        }
      }

      if (
        r.tiene_garantia &&
        !r.garantia_estado &&
        typeof r.fecha === "string" &&
        Date.parse(`${r.fecha}T23:59:59`) > ahora
      ) {
        // La empresa apagó la cancelación automática y el plazo ya venció:
        // ahora decide una persona (§5.4).
        if (r.garantia_cancelada_sin_tarjeta_at) {
          vencidasSinTarjeta.push(r.id as string);
        } else if (r.garantia_solicitada_at) {
          // Se le pidió la tarjeta y el plazo corre: se puede llamar al
          // cliente antes de que la reserva se cancele sola.
          solicitadas.push(r.id as string);
        } else {
          // Sin tarjeta y sin pedir: normalmente un alta de Sala, donde se
          // pide por teléfono.
          sinTarjeta.push(r.id as string);
        }
      }
    }

    const avisos: AvisoCobro[] = [];
    const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

    if (cobroPendiente.length > 0) {
      avisos.push({
        tipo: "cobro_pendiente",
        reservaIds: cobroPendiente,
        texto: `${cobroPendiente.length} ${plural(cobroPendiente.length, "cobro pendiente", "cobros pendientes")} — se sigue intentando`,
      });
    }
    if (cobroAgotado.length > 0) {
      avisos.push({
        tipo: "cobro_agotado",
        reservaIds: cobroAgotado,
        texto: `${cobroAgotado.length} ${plural(cobroAgotado.length, "cobro que no salió", "cobros que no salieron")} — ya no se reintenta`,
      });
    }
    if (porCaducar.length > 0) {
      avisos.push({
        tipo: "retencion_por_caducar",
        reservaIds: porCaducar,
        texto: `${porCaducar.length} ${plural(porCaducar.length, "retención caduca", "retenciones caducan")} en menos de 24 h — cobra o se pierde`,
      });
    }
    if (sinTarjeta.length > 0) {
      avisos.push({
        tipo: "garantia_sin_tarjeta",
        reservaIds: sinTarjeta,
        texto: `${sinTarjeta.length} ${plural(sinTarjeta.length, "reserva espera", "reservas esperan")} tarjeta de garantía`,
      });
    }

    if (solicitadas.length > 0) {
      avisos.push({
        tipo: "garantia_solicitada",
        reservaIds: solicitadas,
        texto: `${solicitadas.length} ${plural(solicitadas.length, "cliente tiene", "clientes tienen")} el plazo abierto para poner la tarjeta`,
      });
    }
    if (vencidasSinTarjeta.length > 0) {
      avisos.push({
        tipo: "garantia_sin_tarjeta_vencida",
        reservaIds: vencidasSinTarjeta,
        texto: `${vencidasSinTarjeta.length} ${plural(vencidasSinTarjeta.length, "reserva se quedó", "reservas se quedaron")} sin tarjeta — decide si la mantienes`,
      });
    }

    const total = new Set(avisos.flatMap((a) => a.reservaIds)).size;
    return { total, avisos };
  } catch (err) {
    console.error("[avisos-cobro]", err);
    return VACIO;
  }
}
