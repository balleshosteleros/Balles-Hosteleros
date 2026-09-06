"use server";

/**
 * Aprobación de la entrega mensual de la gestoría y su histórico.
 *
 * La entrega de un mes son DOS documentos que se aprueban por separado:
 *
 *   NÓMINAS           → las del mes que se está viendo. Aprobarlas es cerrar el
 *                       mes (`confirmarMesNominas`) y publicarlas al empleado.
 *   SEGUROS SOCIALES  → el recibo de cotizaciones, que cotiza OTRO mes: la
 *                       Seguridad Social se liquida a mes vencido, así que con
 *                       las nóminas de julio llega el recibo de junio.
 *
 * Cada uno cuadra contra las nóminas de SU mes, y cada uno tiene su visto bueno.
 * Lo de las nóminas ya vivía en `nominas-revision-actions`; aquí está lo de los
 * seguros sociales y el histórico que junta todo lo que le ha pasado a un mes.
 */

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOTIVO_MIN_CARACTERES } from "@/features/rrhh/lib/nominas-rechazo";
import { revalidatePath } from "next/cache";

/**
 * Da por bueno el recibo de seguros sociales de un mes COTIZADO.
 *
 * Se aprueban todos los recibos de ese mes a la vez: cuando hay liquidación
 * complementaria (vacaciones) son dos papeles del mismo dinero, y lo que cuadra
 * contra las nóminas es su suma. Aprobar uno sí y otro no no significaría nada.
 */
export async function aprobarSegurosSociales(periodoCotizacion: string) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };

    const { data: puede } = await supabase.rpc("puede_gestionar_pagos");
    if (puede !== true) {
      return { ok: false as const, error: "No tienes permiso para aprobar los seguros sociales." };
    }

    // Solo los que siguen pendientes: aprobar dos veces no cambia nada, pero
    // reescribir la fecha borraría cuándo se aprobó de verdad.
    const { data, error } = await supabase
      .from("rrhh_nominas_tc1")
      .update({
        aprobado_en: new Date().toISOString(),
        aprobado_por: userId,
        rechazado_en: null,
        rechazo_motivo: null,
      })
      .eq("empresa_id", empresaId)
      .eq("periodo_cotizacion", periodoCotizacion)
      .is("aprobado_en", null)
      .is("rechazado_en", null)
      .select("id");
    if (error) throw error;

    if ((data ?? []).length === 0) {
      return { ok: false as const, error: "No hay seguros sociales pendientes de aprobar en ese mes." };
    }

    revalidatePath("/rrhh/pagos");
    return { ok: true as const, aprobados: data!.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] aprobarSegurosSociales:", msg);
    return { ok: false as const, error: msg };
  }
}

/**
 * Devuelve el recibo de seguros sociales a la gestoría con el motivo.
 *
 * A diferencia de las nóminas, NO se borra el documento: el recibo sigue ahí para
 * poder consultarlo y compararlo con el que llegue corregido. Lo que queda es la
 * marca de que no se dio por bueno y por qué.
 */
export async function rechazarSegurosSociales(periodoCotizacion: string, motivo: string) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };

    const { data: puede } = await supabase.rpc("puede_gestionar_pagos");
    if (puede !== true) {
      return { ok: false as const, error: "No tienes permiso para rechazar los seguros sociales." };
    }

    // Sin decir qué está mal, la gestoría no puede corregir nada. Mismo mínimo
    // que la devolución de nóminas, para no pedir una cosa aquí y otra allí.
    const texto = motivo.trim();
    if (texto.length < MOTIVO_MIN_CARACTERES) {
      return {
        ok: false as const,
        error: `Explica qué está mal (mínimo ${MOTIVO_MIN_CARACTERES} caracteres) para que la gestoría pueda corregirlo.`,
      };
    }

    const { data, error } = await supabase
      .from("rrhh_nominas_tc1")
      .update({
        rechazado_en: new Date().toISOString(),
        rechazo_motivo: texto,
        aprobado_en: null,
        aprobado_por: null,
      })
      .eq("empresa_id", empresaId)
      .eq("periodo_cotizacion", periodoCotizacion)
      .is("rechazado_en", null)
      .select("id");
    if (error) throw error;

    if ((data ?? []).length === 0) {
      return { ok: false as const, error: "No hay seguros sociales que devolver en ese mes." };
    }

    revalidatePath("/rrhh/pagos");
    return { ok: true as const, rechazados: data!.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] rechazarSegurosSociales:", msg);
    return { ok: false as const, error: msg };
  }
}

/** Deshace el visto bueno de los seguros sociales de un mes cotizado. */
export async function reabrirSegurosSociales(periodoCotizacion: string) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };

    const { data: puede } = await supabase.rpc("puede_gestionar_pagos");
    if (puede !== true) return { ok: false as const, error: "No tienes permiso." };

    const { error } = await supabase
      .from("rrhh_nominas_tc1")
      .update({ aprobado_en: null, aprobado_por: null, rechazado_en: null, rechazo_motivo: null })
      .eq("empresa_id", empresaId)
      .eq("periodo_cotizacion", periodoCotizacion);
    if (error) throw error;

    revalidatePath("/rrhh/pagos");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] reabrirSegurosSociales:", msg);
    return { ok: false as const, error: msg };
  }
}

// ── Histórico del mes: TODO lo que le ha pasado, en una sola línea de tiempo ──

/** Qué ocurrió. Decide el icono y el color de cada línea. */
export type HistoricoTipo =
  | "subida_nominas"
  | "subida_seguros"
  | "rechazo_archivo"
  | "aprobado_nominas"
  | "aprobado_seguros"
  | "devuelto_nominas"
  | "devuelto_seguros"
  | "reabierto_nominas";

export interface HistoricoEntrada {
  id: string;
  tipo: HistoricoTipo;
  /** Cuándo pasó (ISO). La lista va de más reciente a más antiguo. */
  cuando: string;
  /** Quién lo hizo. `null` = la gestoría por su enlace público, sin sesión. */
  quien: string | null;
  /** Mes al que afecta (AAAA-MM): el de la entrega o el cotizado, según el tipo. */
  periodo: string;
  /** Titular de la línea. */
  titulo: string;
  /** Lo que se escribió: motivo de la devolución, detalle del rechazo… */
  detalle: string | null;
  /** Importe leído, en los seguros sociales. */
  importe: number | null;
}

/**
 * Todo lo que le ha pasado a un mes, de lo más reciente a lo más antiguo.
 *
 * Junta cuatro registros que hasta ahora se veían por separado (o no se veían):
 * las subidas de nóminas, las de seguros sociales, las devoluciones a la gestoría
 * y los cierres del mes. Es lo que se despliega con "Ver histórico" en Pagos.
 *
 * Se incluye también el mes ANTERIOR: los seguros sociales de junio llegan con la
 * entrega de julio, así que mirando julio hay que poder ver qué pasó con ellos.
 */
export async function listarHistoricoMes(periodo: string): Promise<HistoricoEntrada[]> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return [];

    const [subidas, rechazos, mes, recibos] = await Promise.all([
      supabase
        .from("nominas_gestoria_subidas")
        .select(
          "id, periodo, periodo_cotizacion, documento, importe, origen, archivo_nombre, leidas, guardadas, ya_existian, sin_empleado, mes_incorrecto, detalle, creado_por, created_at",
        )
        .eq("empresa_id", empresaId)
        .eq("periodo", periodo)
        .order("created_at", { ascending: false }),
      supabase
        .from("rrhh_nominas_rechazos")
        .select("id, periodo, ronda, motivo, nominas_borradas, email_enviado, email_destino, created_at")
        .eq("empresa_id", empresaId)
        .eq("periodo", periodo)
        .order("created_at", { ascending: false }),
      supabase
        .from("rrhh_nominas_mes")
        .select("periodo, confirmado_en, confirmado_por")
        .eq("empresa_id", empresaId)
        .eq("periodo", periodo)
        .maybeSingle(),
      // Los recibos que COTIZAN este mes, vengan en la entrega que vengan.
      supabase
        .from("rrhh_nominas_tc1")
        .select(
          "id, nombre, importe, periodo, periodo_cotizacion, subido_en, subido_por, aprobado_en, aprobado_por, rechazado_en, rechazo_motivo",
        )
        .eq("empresa_id", empresaId)
        .eq("periodo_cotizacion", periodo),
    ]);

    // Los nombres de quienes aparecen, en una sola consulta.
    const ids = new Set<string>();
    for (const s of subidas.data ?? []) if (s.creado_por) ids.add(s.creado_por as string);
    for (const t of recibos.data ?? []) {
      if (t.subido_por) ids.add(t.subido_por as string);
      if (t.aprobado_por) ids.add(t.aprobado_por as string);
    }
    if (mes.data?.confirmado_por) ids.add(mes.data.confirmado_por as string);

    const nombres = new Map<string, string>();
    if (ids.size > 0) {
      const admin = createAdminClient();
      const { data: usuarios } = await admin
        .from("usuarios")
        .select("id, nombre")
        .in("id", [...ids]);
      for (const u of usuarios ?? []) nombres.set(u.id as string, (u.nombre as string) ?? "");
    }
    const quien = (id: string | null): string | null => (id ? nombres.get(id) || null : null);

    const out: HistoricoEntrada[] = [];

    for (const s of subidas.data ?? []) {
      const esSeguros = s.documento === "seguros_sociales";
      const autor = s.origen === "gestoria" ? null : quien(s.creado_por as string | null);
      // Una subida en la que no se guardó NADA es un rechazo automático: llegaron
      // nóminas de otro mes, o de gente que no está en la empresa.
      const rechazada = !esSeguros && Number(s.guardadas ?? 0) === 0 && Number(s.leidas ?? 0) > 0;
      const partes: string[] = [];
      if (!esSeguros) {
        partes.push(`${s.leidas} leída${s.leidas === 1 ? "" : "s"}`);
        if (Number(s.guardadas ?? 0) > 0) partes.push(`${s.guardadas} guardada${s.guardadas === 1 ? "" : "s"}`);
        if (Number(s.ya_existian ?? 0) > 0) partes.push(`${s.ya_existian} ya estaban`);
        if (Number(s.sin_empleado ?? 0) > 0) partes.push(`${s.sin_empleado} sin trabajador`);
        if (Number(s.mes_incorrecto ?? 0) > 0) partes.push(`${s.mes_incorrecto} de otro mes`);
        if (rechazada) partes.push("no se guardó nada");
      }
      out.push({
        id: `sub-${s.id}`,
        tipo: rechazada ? "rechazo_archivo" : esSeguros ? "subida_seguros" : "subida_nominas",
        cuando: s.created_at as string,
        quien: autor,
        periodo: (s.periodo_cotizacion as string | null) ?? (s.periodo as string),
        titulo: esSeguros
          ? "Seguros sociales subidos"
          : rechazada
            ? "Archivo rechazado"
            : "Nóminas subidas",
        detalle: partes.length > 0 ? partes.join(" · ") : (s.archivo_nombre as string | null),
        importe: s.importe != null ? Number(s.importe) : null,
      });
    }

    for (const r of rechazos.data ?? []) {
      const extra = r.email_enviado
        ? `Correo enviado a ${r.email_destino ?? "la gestoría"}`
        : "No se pudo enviar el correo";
      out.push({
        id: `rech-${r.id}`,
        tipo: "devuelto_nominas",
        cuando: r.created_at as string,
        quien: null,
        periodo: r.periodo as string,
        titulo: `Nóminas devueltas a la gestoría (entrega nº ${r.ronda})`,
        detalle: `${r.motivo}\n${extra}. Se borraron ${r.nominas_borradas} nómina${r.nominas_borradas === 1 ? "" : "s"}.`,
        importe: null,
      });
    }

    if (mes.data?.confirmado_en) {
      out.push({
        id: `conf-${periodo}`,
        tipo: "aprobado_nominas",
        cuando: mes.data.confirmado_en as string,
        quien: quien(mes.data.confirmado_por as string | null),
        periodo,
        titulo: "Nóminas aprobadas",
        detalle: "El mes queda cerrado y cada trabajador ve su nómina en el portal.",
        importe: null,
      });
    }

    for (const t of recibos.data ?? []) {
      if (t.aprobado_en) {
        out.push({
          id: `tc1-ok-${t.id}`,
          tipo: "aprobado_seguros",
          cuando: t.aprobado_en as string,
          quien: quien(t.aprobado_por as string | null),
          periodo: t.periodo_cotizacion as string,
          titulo: "Seguros sociales aprobados",
          detalle: t.nombre as string,
          importe: t.importe != null ? Number(t.importe) : null,
        });
      }
      if (t.rechazado_en) {
        out.push({
          id: `tc1-no-${t.id}`,
          tipo: "devuelto_seguros",
          cuando: t.rechazado_en as string,
          quien: null,
          periodo: t.periodo_cotizacion as string,
          titulo: "Seguros sociales devueltos a la gestoría",
          detalle: t.rechazo_motivo as string | null,
          importe: null,
        });
      }
    }

    return out.sort((a, b) => b.cuando.localeCompare(a.cuando));
  } catch (err) {
    console.error("[rrhh] listarHistoricoMes:", err);
    return [];
  }
}
