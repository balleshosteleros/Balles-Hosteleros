"use server";

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLIENTE_INSIGHT_DETALLE_MAX,
  type ClienteInsightReserva,
  type ClienteInsightValoracion,
  type ClienteInsights,
  type EstadoReserva,
} from "@/features/sala/data/reservas";

function normalizeTelefono(t: string): string {
  return t.replace(/[^\d+]/g, "");
}

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

/**
 * Devuelve insights cross-local + valoraciones de un cliente. Pensado para
 * llamarse on-demand al abrir el detalle de una reserva (no en cada fila).
 *
 * Cross-local respeta RLS: solo cuenta empresas a las que el usuario actual
 * tiene acceso (otros locales del mismo grupo del dueño).
 */
export async function getClienteInsights(input: {
  clienteId?: string | null;
  telefono?: string | null;
  email?: string | null;
}): Promise<ClienteInsights> {
  const fallback: ClienteInsights = {
    clienteId: input.clienteId ?? null,
    visitasTotal: 0,
    visitasConValoracion: 0,
    visitasSinValoracion: 0,
    otrosLocalesGrupo: 0,
    noShows: 0,
    canceladas: 0,
    reservasTotal: 0,
    detalle: {
      reservas: [],
      visitas: [],
      noShows: [],
      canceladas: [],
      valoraciones: [],
    },
  };

  try {
    const supabase = await createClient();
    const user = await getUsuarioActual();
    if (!user) return fallback;
    const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
    if (!empresaId) return fallback;

    const telNorm = input.telefono ? normalizeTelefono(input.telefono) : null;
    const emailNorm = input.email ? normalizeEmail(input.email) : null;

    if (!input.clienteId && !telNorm && !emailNorm) return fallback;

    // 1) Visitas: se CUENTAN de sus reservas pasadas, no se lee el contador
    //    `clientes_sala.visitas`.
    //
    //    POR QUÉ: ese contador se incrementaba a mano y está a 0 en todas las
    //    fichas, así que la reserva mostraba "0 visitas" para un cliente que en
    //    la pantalla de Clientes salía con 3. Mismo cliente, dos cifras según
    //    dónde se mirara. El criterio es el de `listClientesEnriquecidos`:
    //    reserva ya pasada a la que no faltó.
    let clienteId = input.clienteId ?? null;
    if (!clienteId) {
      const orParts: string[] = [];
      if (telNorm) orParts.push(`telefono_normalizado.eq.${telNorm}`);
      if (emailNorm) orParts.push(`email_normalizado.eq.${emailNorm}`);
      if (orParts.length > 0) {
        const { data } = await supabase
          .from("clientes_sala")
          .select("id")
          .eq("empresa_id", empresaId)
          .or(orParts.join(","))
          .maybeSingle();
        clienteId = (data?.id as string | null) ?? null;
      }
    }

    // Se traen las reservas del cliente UNA vez y de ahi salen las cuatro
    // cifras y sus listas. Antes eran cuatro consultas que solo contaban, y el
    // desplegable necesita saber CUALES son, no solo cuantas.
    type FilaReserva = {
      id: string;
      fecha: string;
      hora: string | null;
      personas: number | null;
      estado: string;
    };
    let historial: FilaReserva[] = [];
    if (clienteId) {
      const { data } = await supabase
        .from("reservas")
        .select("id, fecha, hora, personas, estado")
        .eq("empresa_id", empresaId)
        .eq("cliente_id", clienteId)
        .order("fecha", { ascending: false })
        .order("hora", { ascending: false })
        // Tope explicito: PostgREST corta en 1000 filas sin avisar, y un
        // historial mas largo que eso no cabe en una ficha de todos modos.
        .limit(1000);
      historial = (data ?? []) as FilaReserva[];
    }

    const aResumen = (r: FilaReserva): ClienteInsightReserva => ({
      id: r.id,
      fecha: r.fecha,
      hora: (r.hora ?? "").slice(0, 5),
      personas: r.personas ?? 0,
      estado: r.estado as EstadoReserva,
    });

    const hoy = new Date().toISOString().slice(0, 10);
    // Visita = reserva ya pasada a la que no falto. Mismo criterio que
    // `listClientesEnriquecidos`, para que las dos pantallas digan lo mismo.
    const visitas = historial.filter(
      (r) => r.fecha < hoy && r.estado !== "CANCELADA" && r.estado !== "NO_SHOW",
    );
    const visitasTotal = visitas.length;

    // 2) Reseñas del mismo cliente en la empresa actual.
    // resenas no tiene FK a clientes_sala; matchea por telefono/email.
    // Las reseñas se enlazan por `cliente_id`: es la unica via que funciona.
    // Teléfono y email quedan de respaldo para las pocas que llegan sin ficha
    // enlazada (las de fuera vienen sin contacto: emparejar por ahi devolvia
    // cero siempre, y la ficha decia que el cliente nunca habia valorado).
    let visitasConValoracion = 0;
    let valoraciones: ClienteInsightValoracion[] = [];
    {
      const orParts: string[] = [];
      if (clienteId) orParts.push(`cliente_id.eq.${clienteId}`);
      if (telNorm) orParts.push(`telefono.eq.${telNorm}`);
      if (emailNorm) orParts.push(`email.eq.${emailNorm}`);
      if (orParts.length > 0) {
        const { data } = await supabase
          .from("resenas")
          .select(
            // `fecha_reseña` lleva eñe: hay que entrecomillarla y darle un
            // alias ASCII, o el parser del cliente no la reconoce. Por lo
            // mismo no se puede ordenar por ella en la consulta; se ordena
            // despues en memoria.
            'id, fecha:"fecha_reseña", created_at, rating, rating_comida, rating_servicio, rating_ambiente',
          )
          .eq("empresa_id", empresaId)
          // Las de GOOGLE quedan fuera a proposito: Google no da el telefono
          // ni el email de quien reseña, asi que no se pueden atribuir a
          // nadie. Cuentan en la nota del local, no en la ficha del cliente.
          .neq("origen", "google")
          .or(orParts.join(","))
          .limit(1000);
        const filas = (data ?? []) as Array<{
          id: string;
          fecha: string | null;
          created_at: string | null;
          rating: number | null;
          rating_comida: number | null;
          rating_servicio: number | null;
          rating_ambiente: number | null;
        }>;
        visitasConValoracion = filas.length;
        valoraciones = filas.map((r) => {
          // La NOTA de una valoracion es la media de lo que puntuo por areas.
          // Las reseñas que llegan de fuera (Google) no traen desglose: en ese
          // caso vale la global, que es la unica nota que existe.
          const partes = [r.rating_comida, r.rating_servicio, r.rating_ambiente].filter(
            (n): n is number => typeof n === "number",
          );
          const media =
            partes.length > 0
              ? partes.reduce((a, b) => a + b, 0) / partes.length
              : typeof r.rating === "number"
                ? r.rating
                : null;
          return {
            id: r.id,
            // `fecha_reseña` es cuando la dejo; `created_at`, cuando entro en
            // el sistema. Se prefiere la primera y la segunda es el respaldo.
            fecha: r.fecha ?? r.created_at ?? null,
            nota: media,
            comida: r.rating_comida ?? null,
            servicio: r.rating_servicio ?? null,
            ambiente: r.rating_ambiente ?? null,
          };
        });
        // De la mas reciente a la mas antigua: la ficha enseña las ultimas.
        valoraciones.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
      }
    }

    const visitasSinValoracion = Math.max(0, visitasTotal - visitasConValoracion);

    // 3) Cross-local: nº de OTRAS empresas (accesibles vía RLS) donde aparece
    // este mismo telefono/email en clientes_sala.
    let otrosLocalesGrupo = 0;
    if (telNorm || emailNorm) {
      const orParts: string[] = [];
      if (telNorm) orParts.push(`telefono_normalizado.eq.${telNorm}`);
      if (emailNorm) orParts.push(`email_normalizado.eq.${emailNorm}`);
      if (orParts.length > 0) {
        const { data } = await supabase
          .from("clientes_sala")
          .select("empresa_id")
          .neq("empresa_id", empresaId)
          .or(orParts.join(","));
        const distinct = new Set((data ?? []).map((r) => r.empresa_id as string));
        otrosLocalesGrupo = distinct.size;
      }
    }

    // 4) Fiabilidad del cliente en ESTA empresa: cuántas veces no apareció y
    // cuántas canceló. Es lo que decide en el momento si se le guarda la mesa
    // o se le pide garantía.
    // Fiabilidad en ESTA empresa: cuantas veces no aparecio y cuantas cancelo.
    // Sale del mismo historial ya cargado, sin volver a preguntar a la BD.
    const noShowsFilas = historial.filter((r) => r.estado === "NO_SHOW");
    const canceladasFilas = historial.filter((r) => r.estado === "CANCELADA");
    const noShows = noShowsFilas.length;
    const canceladas = canceladasFilas.length;
    // Total de reservas: sin filtrar por estado ni por fecha. Responde "cuantas
    // veces ha reservado", que no es lo mismo que cuantas veces ha venido.
    const reservasTotal = historial.length;

    return {
      clienteId,
      visitasTotal,
      visitasConValoracion,
      visitasSinValoracion,
      otrosLocalesGrupo,
      noShows,
      canceladas,
      reservasTotal,
      detalle: {
        reservas: historial.slice(0, CLIENTE_INSIGHT_DETALLE_MAX).map(aResumen),
        visitas: visitas.slice(0, CLIENTE_INSIGHT_DETALLE_MAX).map(aResumen),
        noShows: noShowsFilas.slice(0, CLIENTE_INSIGHT_DETALLE_MAX).map(aResumen),
        canceladas: canceladasFilas.slice(0, CLIENTE_INSIGHT_DETALLE_MAX).map(aResumen),
        valoraciones: valoraciones.slice(0, CLIENTE_INSIGHT_DETALLE_MAX),
      },
    };
  } catch (err) {
    console.error("[cliente-insights] get:", err);
    return fallback;
  }
}
