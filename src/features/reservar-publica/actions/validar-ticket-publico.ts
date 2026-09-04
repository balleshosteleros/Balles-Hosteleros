"use server";

/**
 * Validación de un código de Ticket desde el motor público de reservas.
 *
 * Devuelve las condiciones del producto para que el formulario pueda apagar
 * los días, horas y zonas que no valen ANTES de que el cliente los elija.
 *
 * No expone nada interno: ni el identificador de la compra, ni el stock, ni el
 * correo de quien lo compró.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  validarCanjeTicket,
  TICKET_MOTIVO_LABELS,
  type TicketCondiciones,
  type TicketMotivoInvalidez,
  type TicketTurno,
} from "@/features/sala/lib/validar-ticket-canje";
import type { DiaSemanaKey } from "@/features/sala/data/reservas";

/** Lo que el cliente puede ver de su propio ticket. */
export interface TicketPublico {
  codigo: string;
  producto: string;
  /** Personas que cubre el ticket. La reserva se hace para esta cantidad. */
  unidades: number;
  importeTotal: number;
  porPersona: boolean;
  /**
   * Comensales que trae cada unidad vendida. La Cena Experiencia se vende de
   * 2 en 2, así que el selector de la reserva debe saltar de 2 en 2: nunca
   * puede quedar una mesa de 3 con un producto pensado para parejas.
   */
  personasPorUnidad: number;
  canjeHasta: string | null;
  condiciones: TicketCondiciones;
  /** Resumen legible de las condiciones, ya montado. */
  resumen: string[];
}

export type ValidarTicketResult =
  | { ok: true; ticket: TicketPublico }
  | {
      ok: false;
      motivo: TicketMotivoInvalidez;
      mensaje: string;
      /**
       * El ticket, cuando el código es BUENO y lo que falla es el día, la hora
       * o la zona elegidos. Se devuelve para que el formulario siga filtrando
       * con sus condiciones mientras el cliente corrige, y para no marcarle el
       * código como erróneo cuando no lo es.
       */
      ticket?: TicketPublico;
    };

export async function validarTicketPublicoAction(args: {
  empresaSlug: string;
  codigo: string;
  fecha?: string | null;
  hora?: string | null;
  grupoZonaId?: string | null;
}): Promise<ValidarTicketResult> {
  const fallo = (motivo: TicketMotivoInvalidez): ValidarTicketResult => ({
    ok: false,
    motivo,
    mensaje: TICKET_MOTIVO_LABELS[motivo],
  });

  const codigo = args.codigo.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{6}$/.test(codigo)) return fallo("NO_EXISTE");

  const admin = createAdminClient();

  const { data: empresa } = await admin
    .from("empresas")
    .select("id")
    .eq("slug", args.empresaSlug)
    .maybeSingle();
  if (!empresa) return fallo("NO_EXISTE");

  const { data: compra } = await admin
    .from("reserva_ticket_compras")
    .select("id, producto_id, codigo, estado, canje_hasta, unidades, precio_unitario, importe_total")
    .eq("empresa_id", empresa.id as string)
    .eq("codigo", codigo)
    .maybeSingle();
  if (!compra) return fallo("NO_EXISTE");

  const { data: prod } = await admin
    .from("reserva_ticket_productos")
    .select("nombre, modo_precio, personas_por_unidad, dias_semana, dias_excluidos, turnos, hora_desde, hora_hasta, horas_excluidas, grupo_zona_ids")
    .eq("id", compra.producto_id as string)
    .maybeSingle();
  if (!prod) return fallo("NO_EXISTE");

  const condiciones: TicketCondiciones = {
    diasSemana: (prod.dias_semana as DiaSemanaKey[] | null) ?? [],
    diasExcluidos: (prod.dias_excluidos as string[] | null) ?? [],
    turnos: (prod.turnos as TicketTurno[] | null) ?? [],
    horaDesde: (prod.hora_desde as string | null) ?? null,
    horaHasta: (prod.hora_hasta as string | null) ?? null,
    horasExcluidas: (prod.horas_excluidas as string[] | null) ?? [],
    grupoZonaIds: (prod.grupo_zona_ids as string[] | null) ?? [],
  };

  const r = validarCanjeTicket(
    {
      estado: compra.estado as string,
      canjeHasta: (compra.canje_hasta as string | null) ?? null,
      unidades: Number(compra.unidades),
    },
    condiciones,
    {
      fecha: args.fecha ?? null,
      hora: args.hora ?? null,
      grupoZonaId: args.grupoZonaId ?? null,
    },
  );
  // Nombres de las zonas permitidas, para poder decírselo al cliente en
  // castellano en vez de enseñarle identificadores.
  let nombresZonas: Map<string, string> | undefined;
  if (condiciones.grupoZonaIds.length > 0) {
    const { data: zonas } = await admin
      .from("grupos_zonas")
      .select("id, nombre")
      .in("id", condiciones.grupoZonaIds);
    if (zonas) {
      nombresZonas = new Map(
        (zonas as { id: string; nombre: string }[]).map((z) => [z.id, z.nombre]),
      );
    }
  }

  const { describirCondiciones } = await import("@/features/sala/lib/validar-ticket-canje");

  const ticket: TicketPublico = {
    codigo,
    producto: (prod.nombre as string) ?? "Ticket",
    unidades: Number(compra.unidades),
    importeTotal: Number(compra.importe_total),
    porPersona: prod.modo_precio === "por_persona",
    personasPorUnidad: Math.max(1, Number(prod.personas_por_unidad ?? 1)),
    canjeHasta: (compra.canje_hasta as string | null) ?? null,
    condiciones,
    resumen: describirCondiciones(condiciones, nombresZonas),
  };

  if (!r.ok) {
    // El ticket viaja igualmente: si lo que falla es el día o la hora, el
    // formulario lo necesita para seguir filtrando mientras el cliente corrige.
    return { ...fallo(r.motivo), ticket };
  }

  return { ok: true, ticket };
}
