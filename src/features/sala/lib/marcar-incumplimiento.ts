import "server-only";

/**
 * Marca que una reserva incumplió su política de tarjeta (PRP-082 §5.6).
 *
 * NO cobra nada: cobrar es una decisión de una persona, porque puede haber un
 * motivo que el software no conoce (el cliente avisó por teléfono, hubo un
 * problema en el restaurante). Esto solo enciende el aviso en Sala para que
 * alguien decida.
 *
 * Sin este sello, un incumplimiento no dejaba rastro: la reserva quedaba
 * CANCELADA con la tarjeta guardada y el aviso de Sala —que solo miraba cobros
 * FALLIDOS— no veía nada. El cobro se perdía sin que nadie se enterara.
 *
 * Lo llaman los TRES caminos por los que una reserva se queda sin cliente:
 * la cancelación pública por enlace, el cambio de estado desde Sala y el
 * no-show. Vive aparte para que los tres decidan igual.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  politicaDesdeRow,
  procedeCobro,
  POLITICA_COLUMNAS_SELECT,
} from "@/features/sala/lib/politicas-tarjeta";
import {
  ZONA_HORARIA_FALLBACK,
  zonaLocalAUtcISO,
} from "@/features/empresa/lib/zona-horaria";

/** Estados en los que la reserva se queda sin cliente y procede valorar cobro. */
export type EstadoSinCliente = "CANCELADA" | "NO_SHOW";

/**
 * Sella `politica_incumplida_at` si la reserva tenía tarjeta y se incumplió el
 * plazo. Silencioso a propósito: es un efecto secundario de cancelar, y un
 * fallo aquí nunca debe tumbar la cancelación en sí.
 *
 * Devuelve true si quedó marcada, para poder decirlo en los tests y en el log.
 */
export async function marcarPoliticaIncumplida(
  admin: SupabaseClient,
  reservaId: string,
  estado: EstadoSinCliente,
): Promise<boolean> {
  try {
    const { data: r } = await admin
      .from("reservas")
      .select(
        "id, empresa_id, fecha, hora, tiene_cancelacion, cancelacion_estado, cancelacion_importe, politica_incumplida_at, cobro_perdonado_at",
      )
      .eq("id", reservaId)
      .maybeSingle();
    if (!r) return false;

    // Ya marcada, ya cobrada o ya perdonada: no se vuelve a levantar el aviso.
    if (r.politica_incumplida_at || r.cobro_perdonado_at) return false;
    if (r.cancelacion_estado === "cobrada") return false;

    // Sin política de cancelación no hay nada que cobrar. La garantía va por
    // otro camino: su dinero ya está retenido y tiene su propio aviso de
    // caducidad, así que aquí no se toca.
    if (r.tiene_cancelacion !== true) return false;
    if (!(Number(r.cancelacion_importe ?? 0) > 0)) return false;

    const { data: cfg } = await admin
      .from("empresa_reservas_config")
      .select(POLITICA_COLUMNAS_SELECT)
      .eq("empresa_id", r.empresa_id as string)
      .maybeSingle();

    const { data: emp } = await admin
      .from("empresas")
      .select("config_operativa")
      .eq("id", r.empresa_id as string)
      .maybeSingle();

    // El plazo se mide en la hora REAL del restaurante: con la zona del
    // servidor (UTC en Vercel) el cálculo se desvía 1-2 h y una cancelación
    // justo en el límite cae del lado equivocado.
    const cfgOp = (emp?.config_operativa as Record<string, unknown> | null) ?? null;
    const tz =
      cfgOp && typeof cfgOp.zonaHoraria === "string" && cfgOp.zonaHoraria.trim()
        ? cfgOp.zonaHoraria.trim()
        : ZONA_HORARIA_FALLBACK;

    const instante = Date.parse(
      zonaLocalAUtcISO(r.fecha as string, (r.hora as string).slice(0, 5), tz),
    );

    const veredicto = procedeCobro(
      politicaDesdeRow(cfg as Record<string, unknown> | null, "cancelacion"),
      estado === "NO_SHOW" ? "NO_PRESENTADO" : "CANCELADA",
      instante,
    );
    if (!veredicto.procede) return false;

    await admin
      .from("reservas")
      .update({
        politica_incumplida_at: new Date().toISOString(),
        cobro_motivo: veredicto.motivo,
      })
      .eq("id", reservaId);

    return true;
  } catch (err) {
    // Nunca romper la cancelación por esto: la mesa ya está liberada y el
    // cliente ya tiene su correo.
    console.error("[politica-incumplida]", err);
    return false;
  }
}
