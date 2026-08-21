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

export interface ClienteEnriquecido {
  clienteId: string;
  /** Reservas futuras vivas, de la más próxima a la más lejana. */
  proximas: ProximaReservaCliente[];
  etiquetas: EtiquetaCliente[];
  resenas: ResenaCliente[];
  /** Media de las reseñas CON nota. `null` si el cliente no ha valorado nunca. */
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

    const [resReservas, resEtiquetas, resResenas, resConfig] = await Promise.all([
      // Sin filtro de fecha ni de estado: la misma consulta alimenta las dos
      // cosas, que usan criterios distintos (próximas = compromiso de mesa;
      // visitas = asistió). Se reparte abajo, en una sola pasada.
      supabase
        .from("reservas")
        .select("id, cliente_id, fecha, hora, personas, estado, mesa, zona")
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
          'id, cliente_id, rating, rating_comida, rating_servicio, rating_ambiente, comentario, origen, fecha:"fecha_reseña"',
        )
        .eq("empresa_id", empresaId)
        .not("cliente_id", "is", null)
        .order("fecha_reseña", { ascending: false, nullsFirst: false }),
      supabase
        .from("empresa_reservas_config")
        .select("clasif_regular_min, clasif_frecuente_min, clasif_vip_min")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
    ]);

    const out: Record<string, ClienteEnriquecido> = {};
    /** Devuelve null si el cliente no es de la empresa activa: no se acumula. */
    const bucket = (id: string): ClienteEnriquecido | null => {
      if (!idsEmpresa.has(id)) return null;
      if (!out[id]) {
        out[id] = {
          clienteId: id,
          proximas: [],
          etiquetas: [],
          resenas: [],
          ratingMedio: null,
          visitas: 0,
          ultimaVisita: null,
        };
      }
      return out[id];
    };

    for (const r of resReservas.data ?? []) {
      const cid = r.cliente_id as string | null;
      if (!cid) continue;
      const b = bucket(cid);
      if (!b) continue;

      const fecha = r.fecha as string;
      const estado = (r.estado as string) ?? "";

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

    for (const r of resResenas.data ?? []) {
      const cid = r.cliente_id as string | null;
      if (!cid) continue;
      const b = bucket(cid);
      if (!b) continue;
      b.resenas.push({
        id: r.id as string,
        rating: (r.rating as number | null) ?? null,
        comentario: (r.comentario as string | null) ?? null,
        fecha: (r.fecha as string | null) ?? null,
        origen: (r.origen as string) ?? "",
        comida: (r.rating_comida as number | null) ?? null,
        servicio: (r.rating_servicio as number | null) ?? null,
        ambiente: (r.rating_ambiente as number | null) ?? null,
      });
    }

    // Media solo sobre reseñas CON nota: una reseña sin puntuar no vale 0, es
    // ausencia de dato y no debe hundir la media.
    for (const c of Object.values(out)) {
      const notas = c.resenas
        .map((r) => r.rating)
        .filter((n): n is number => typeof n === "number");
      c.ratingMedio =
        notas.length > 0
          ? notas.reduce((a, b) => a + b, 0) / notas.length
          : null;
    }

    const umbrales = normalizarUmbrales({
      regularMin: resConfig.data?.clasif_regular_min as number | null,
      frecuenteMin: resConfig.data?.clasif_frecuente_min as number | null,
      vipMin: resConfig.data?.clasif_vip_min as number | null,
    });

    return { ok: true, data: out, umbrales, zonaHoraria: tz };
  } catch (err) {
    console.error("[clientes] listClientesEnriquecidos:", err);
    return vacio;
  }
}
