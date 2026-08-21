"use server";

/**
 * Datos que la lista de CLIENTES de sala necesita además de la propia ficha:
 * próximas reservas, etiquetas y reseñas.
 *
 * POR QUÉ una action aparte y en LOTE: la vista pinta N filas y cada una
 * necesita las tres cosas. Resolverlo por fila serían 3·N consultas (y un
 * "waterfall" que crece con la clientela). Aquí se hace una consulta por
 * concepto para TODOS los clientes de la empresa y se reparte en memoria.
 *
 * Aislamiento por empresa: se filtra SIEMPRE por `empresa_id` de la empresa
 * ACTIVA. La RLS acota a las empresas del usuario, no a la activa, así que el
 * filtro explícito es lo único que impide mezclar locales.
 */

import { createClient } from "@/lib/supabase/server";
import {
  getEmpresaActivaForUser,
  getZonaHorariaEmpresa,
} from "@/features/empresa/lib/empresa-server";
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizarUmbrales,
  notaGlobalCliente,
  type UmbralesClasificacion,
} from "@/features/sala/lib/clasificacion-cliente";

/**
 * PRÓXIMAS reservas: solo compromiso real de mesa.
 *
 * Se listan únicamente CONFIRMADA y RECONFIRMADA. Lo demás no es una mesa
 * asegurada: LISTA_ESPERA es una cola, NO_RECONFIRMADA está en el aire, y
 * WALK_IN/TERMINANDO/LIBERADA describen a alguien que ya está o ya estuvo en
 * la casa, no una visita por venir. Anunciar cualquiera de esas como "próxima
 * reserva" con su mesa y su zona haría creer a sala que hay sitio guardado.
 */
const ESTADOS_PROXIMA_RESERVA = ["CONFIRMADA", "RECONFIRMADA"];

/**
 * VISITAS cumplidas: toda reserva ya pasada en la que el cliente asistió.
 *
 * Se excluyen solo CANCELADA y NO_SHOW, que es el criterio canónico del módulo
 * (`ESTADOS_NO_ASISTEN` en data/reservas.ts): una LIBERADA soltó la mesa, pero
 * el cliente vino y comió, así que cuenta como visita. Lo mismo TERMINANDO.
 *
 * POR QUÉ no solo LIBERADA/TERMINANDO, que serían las señales más exactas de
 * "se sentó": muchas reservas pasadas se quedan en CONFIRMADA porque nadie las
 * cierra a mano al acabar el servicio. Contando solo las cerradas, casi todo
 * cliente real saldría con cero visitas.
 */
const ESTADOS_NO_ASISTIO = ["CANCELADA", "NO_SHOW"];

export interface ProximaReservaCliente {
  id: string;
  fecha: string;
  hora: string;
  personas: number;
  estado: string;
  mesa: string | null;
  zona: string | null;
  /** COMIDA o CENA: hace falta para abrir el día en el turno correcto. */
  turno: string | null;
}

export interface EtiquetaCliente {
  id: string;
  nombre: string;
  emoji: string | null;
  color: string;
}

export interface ResenaCliente {
  id: string;
  /** Nota global (media del desglose, o la única si vino del QR de la carta). */
  rating: number | null;
  comentario: string | null;
  fecha: string | null;
  origen: string;
  /** Desglose. null si el cliente no puntuó esa categoría. */
  comida: number | null;
  servicio: number | null;
  ambiente: number | null;
}

/**
 * Una petición de valoración enviada al cliente tras una visita, con lo que
 * pasó después: o contestó (y hay nota), o no.
 *
 * POR QUÉ se listan los ENVÍOS y no solo las reseñas: si únicamente se pintan
 * las respuestas, un cliente al que se le pidió opinión cinco veces y nunca
 * contestó se ve igual que uno al que no se le pidió nunca. El silencio también
 * es información.
 */
export interface ValoracionSolicitadaCliente {
  /** Id del envío del correo. */
  id: string;
  reservaId: string | null;
  /** Cuándo se le pidió la valoración. */
  enviadoAt: string;
  /** Fecha de la visita valorada, si se conoce la reserva. */
  fechaVisita: string | null;
  /** La reseña que contestó, o null si no contestó. */
  resena: ResenaCliente | null;
}

/** Una reserva del histórico del cliente, para la lista de su ficha. */
export interface ReservaHistoricoCliente {
  id: string;
  fecha: string;
  hora: string;
  personas: number;
  estado: string;
  mesa: string | null;
  zona: string | null;
  /** COMIDA o CENA: hace falta para abrir el día en el turno correcto. */
  turno: string | null;
}

export interface ClienteEnriquecido {
  clienteId: string;
  /** Reservas futuras vivas, de la más próxima a la más lejana. */
  proximas: ProximaReservaCliente[];
  /** TODAS sus reservas, de la más reciente a la más antigua. */
  historico: ReservaHistoricoCliente[];
  /** Cuántas reservas tiene en cada estado. Solo estados con al menos una. */
  porEstado: Record<string, number>;
  etiquetas: EtiquetaCliente[];
  resenas: ResenaCliente[];
  /** Histórico de peticiones de valoración, de la más reciente a la más antigua. */
  valoracionesSolicitadas: ValoracionSolicitadaCliente[];
  /**
   * Nota GLOBAL del cliente: media de la nota de todas sus valoraciones (cada
   * una, a su vez, media de comida/servicio/ambiente). Con una sola valoración
   * es esa misma nota. `null` si no ha valorado nunca.
   */
  ratingMedio: number | null;
  /**
   * Visitas REALES: reservas del cliente que ya han ocurrido y en las que se
   * sentó. Se cuenta aquí en vez de leer `clientes_sala.visitas` porque ese
   * contador se incrementaba a mano y quedaba desfasado en cuanto alguien se
   * olvidaba de pulsar.
   */
  visitas: number;
  /** Fecha (YYYY-MM-DD) de la última visita real, o null si nunca vino. */
  ultimaVisita: string | null;
}

export interface ClientesEnriquecidosResult {
  ok: boolean;
  data: Record<string, ClienteEnriquecido>;
  umbrales: UmbralesClasificacion;
  /** Zona horaria de la empresa: el cliente la necesita para formatear fechas. */
  zonaHoraria: string;
}

export async function listClientesEnriquecidos(): Promise<ClientesEnriquecidosResult> {
  const vacio: ClientesEnriquecidosResult = {
    ok: false,
    data: {},
    umbrales: normalizarUmbrales({}),
    zonaHoraria: "Europe/Madrid",
  };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return vacio;

    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return vacio;

    const tz = await getZonaHorariaEmpresa(
      supabase as unknown as SupabaseClient,
      empresaId,
    );

    // "Futuro" se decide en la zona de la EMPRESA. Con la del servidor (UTC en
    // producción) una reserva de esta noche podría contarse como pasada.
    const { fecha: hoy } = ahoraEnZona(tz);

    // Universo de clientes de la empresa ACTIVA. Todo lo que llegue después se
    // acota a este conjunto: el aislamiento entre locales lo da este filtro,
    // no la RLS (que solo acota a las empresas del usuario).
    const { data: clientesEmpresa } = await supabase
      .from("clientes_sala")
      .select("id")
      .eq("empresa_id", empresaId);
    const idsEmpresa = new Set(
      (clientesEmpresa ?? []).map((c) => c.id as string),
    );

    const [
      resReservas,
      resEtiquetas,
      resResenas,
      resConfig,
      resSolicitudes,
    ] = await Promise.all([
      // Sin filtro de fecha ni de estado: la misma consulta alimenta las dos
      // cosas, que usan criterios distintos (próximas = compromiso de mesa;
      // visitas = asistió). Se reparte abajo, en una sola pasada.
      supabase
        .from("reservas")
        .select("id, cliente_id, fecha, hora, personas, estado, mesa, zona, turno")
        .eq("empresa_id", empresaId)
        .not("cliente_id", "is", null)
        .order("fecha", { ascending: true })
        .order("hora", { ascending: true }),
      // `!inner` es imprescindible: `sala_cliente_etiquetas` NO tiene
      // `empresa_id`, y con un embed normal el filtro sobre la relación no
      // descarta filas — solo deja la relación a null y la asignación de otra
      // empresa llega igualmente. Con inner join el filtro sí acota las filas.
      supabase
        .from("sala_cliente_etiquetas")
        .select(
          "cliente_id, sala_etiquetas!inner(id, nombre, emoji, color, empresa_id, activo)",
        )
        .eq("sala_etiquetas.empresa_id", empresaId),
      // `fecha_reseña` lleva eñe y tilde: hay que entrecomillarla y darle un
      // alias ASCII, o el parser de tipos de supabase-js no sabe leer el select.
      supabase
        .from("resenas")
        .select(
          'id, cliente_id, reserva_id, rating, rating_comida, rating_servicio, rating_ambiente, comentario, origen, fecha:"fecha_reseña"',
        )
        .eq("empresa_id", empresaId)
        .not("cliente_id", "is", null)
        .order("fecha_reseña", { ascending: false, nullsFirst: false }),
      supabase
        .from("empresa_reservas_config")
        .select("clasif_regular_min, clasif_vip_min")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      // Peticiones de valoración enviadas. No traen `cliente_id`: se atribuyen
      // al cliente a través de la reserva, más abajo.
      supabase
        .from("reserva_email_envios")
        .select("id, reserva_id, enviado_at")
        .eq("empresa_id", empresaId)
        .eq("tipo", "SOLICITUD_VALORACION")
        .order("enviado_at", { ascending: false }),
    ]);

    const out: Record<string, ClienteEnriquecido> = {};
    /** Devuelve null si el cliente no es de la empresa activa: no se acumula. */
    const bucket = (id: string): ClienteEnriquecido | null => {
      if (!idsEmpresa.has(id)) return null;
      if (!out[id]) {
        out[id] = {
          clienteId: id,
          proximas: [],
          historico: [],
          porEstado: {},
          etiquetas: [],
          resenas: [],
          valoracionesSolicitadas: [],
          ratingMedio: null,
          visitas: 0,
          ultimaVisita: null,
        };
      }
      return out[id];
    };

    /** reserva → (cliente, fecha), para atribuir los envíos de valoración. */
    const reservaInfo = new Map<string, { clienteId: string; fecha: string }>();

    for (const r of resReservas.data ?? []) {
      const cid = r.cliente_id as string | null;
      if (!cid) continue;
      const b = bucket(cid);
      if (!b) continue;

      const fecha = r.fecha as string;
      const estado = (r.estado as string) ?? "";
      reservaInfo.set(r.id as string, { clienteId: cid, fecha });

      // Histórico y recuento por estado: TODAS sus reservas, sin filtrar. Es lo
      // que responde "de sus 5 reservas, ¿cuántas canceló?".
      b.historico.push({
        id: r.id as string,
        fecha,
        hora: ((r.hora as string) ?? "").slice(0, 5),
        personas: (r.personas as number) ?? 0,
        estado,
        mesa: (r.mesa as string | null) ?? null,
        zona: (r.zona as string | null) ?? null,
        turno: (r.turno as string | null) ?? null,
      });
      if (estado) b.porEstado[estado] = (b.porEstado[estado] ?? 0) + 1;

      if (fecha >= hoy) {
        // Futuro: solo lo que es una mesa asegurada.
        if (!ESTADOS_PROXIMA_RESERVA.includes(estado)) continue;
        b.proximas.push({
          id: r.id as string,
          fecha,
          hora: ((r.hora as string) ?? "").slice(0, 5),
          personas: (r.personas as number) ?? 0,
          estado,
          mesa: (r.mesa as string | null) ?? null,
          zona: (r.zona as string | null) ?? null,
          turno: (r.turno as string | null) ?? null,
        });
      } else {
        // Pasado: cuenta como visita salvo que no se presentara.
        if (ESTADOS_NO_ASISTIO.includes(estado)) continue;
        b.visitas += 1;
        // Las filas vienen ordenadas por fecha ascendente, así que la última
        // que se procesa es la más reciente.
        if (!b.ultimaVisita || fecha > b.ultimaVisita) b.ultimaVisita = fecha;
      }
    }

    for (const row of resEtiquetas.data ?? []) {
      const cid = row.cliente_id as string | null;
      const et = row.sala_etiquetas as unknown as Record<string, unknown> | null;
      if (!cid || !et) continue;
      if (et.activo === false) continue;
      const b = bucket(cid);
      if (!b) continue;
      b.etiquetas.push({
        id: et.id as string,
        nombre: (et.nombre as string) ?? "",
        emoji: (et.emoji as string | null) ?? null,
        color: (et.color as string) ?? "#64748b",
      });
    }

    /** reserva → reseña, para saber si una petición obtuvo respuesta. */
    const resenaPorReserva = new Map<string, ResenaCliente>();

    for (const r of resResenas.data ?? []) {
      const cid = r.cliente_id as string | null;
      if (!cid) continue;
      const b = bucket(cid);
      if (!b) continue;
      const resena: ResenaCliente = {
        id: r.id as string,
        rating: (r.rating as number | null) ?? null,
        comentario: (r.comentario as string | null) ?? null,
        fecha: (r.fecha as string | null) ?? null,
        origen: (r.origen as string) ?? "",
        comida: (r.rating_comida as number | null) ?? null,
        servicio: (r.rating_servicio as number | null) ?? null,
        ambiente: (r.rating_ambiente as number | null) ?? null,
      };
      b.resenas.push(resena);
      const rid = r.reserva_id as string | null;
      // Si una reserva tuviera más de una reseña, manda la primera que llega,
      // que por el orden del select es la más reciente.
      if (rid && !resenaPorReserva.has(rid)) resenaPorReserva.set(rid, resena);
    }

    // Histórico de peticiones. Se atribuye al cliente por la reserva: la tabla
    // de envíos no guarda `cliente_id`, y usar el email del destinatario haría
    // que una corrección posterior del correo desligara el histórico.
    for (const s of resSolicitudes.data ?? []) {
      const rid = s.reserva_id as string | null;
      if (!rid) continue;
      const info = reservaInfo.get(rid);
      if (!info) continue;
      const b = bucket(info.clienteId);
      if (!b) continue;
      b.valoracionesSolicitadas.push({
        id: s.id as string,
        reservaId: rid,
        enviadoAt: s.enviado_at as string,
        fechaVisita: info.fecha,
        resena: resenaPorReserva.get(rid) ?? null,
      });
    }

    // Nota global: media de la nota de cada valoración, con el MISMO cálculo
    // que se pinta en cada línea del histórico. Con una sola valoración es esa
    // misma nota.
    for (const c of Object.values(out)) {
      c.ratingMedio = notaGlobalCliente(c.resenas);
      // Las reservas llegan de la más antigua a la más nueva (el orden que
      // necesita el cálculo de `ultimaVisita`); el histórico se lee al revés.
      c.historico.reverse();
    }

    const umbrales = normalizarUmbrales({
      regularMin: resConfig.data?.clasif_regular_min as number | null,
      vipMin: resConfig.data?.clasif_vip_min as number | null,
    });

    return { ok: true, data: out, umbrales, zonaHoraria: tz };
  } catch (err) {
    console.error("[clientes] listClientesEnriquecidos:", err);
    return vacio;
  }
}
