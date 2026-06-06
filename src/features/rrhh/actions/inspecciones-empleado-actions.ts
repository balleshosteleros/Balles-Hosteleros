"use server";

import { getAppContext } from "@/lib/supabase/get-context";

/**
 * Una inspección (envío) vinculada a un empleado concreto.
 *
 * El vínculo puede ser de dos tipos:
 *  - "verificada": el empleado escaneó el QR y firmó/verificó la inspección
 *    in-situ (`inspeccion_envios.verificado_por_empleado_id`).
 *  - "jefe_sala": el inspector lo nombró como jefe de sala responsable del
 *    turno inspeccionado (`inspeccion_envios.jefe_sala_empleado_id`).
 */
export interface InspeccionEmpleadoItem {
  id: string;
  numero_secuencial: number | null;
  fecha_inspeccion: string | null;
  local_nombre: string | null;
  nombre_inspector: string;
  nota_final: number | null;
  estado: "pendiente_revision" | "revisado" | "archivado";
  verificado_at: string | null;
  vinculo: "verificada" | "jefe_sala";
}

export interface InspeccionEmpleadoRespuesta {
  id: string;
  seccion_titulo: string;
  seccion_orden: number;
  enunciado: string;
  tipo: string;
  orden: number;
  valor_texto: string | null;
  valor_numero: number | null;
  escala_max: number | null;
}

export interface InspeccionEmpleadoDetalle {
  id: string;
  numero_secuencial: number | null;
  fecha_inspeccion: string | null;
  local_nombre: string | null;
  nombre_inspector: string;
  nombre_jefe_sala: string | null;
  plantilla_nombre: string | null;
  nota_final: number | null;
  estado: "pendiente_revision" | "revisado" | "archivado";
  verificado_at: string | null;
  notas_calidad: string | null;
  respuestas: InspeccionEmpleadoRespuesta[];
}

function nombreRelacion(rel: unknown): string | null {
  if (Array.isArray(rel)) return (rel[0] as { nombre?: string } | undefined)?.nombre ?? null;
  return (rel as { nombre?: string } | null)?.nombre ?? null;
}

/**
 * Lista todas las inspecciones que existen "a nombre de" un empleado: las que
 * verificó él mismo y aquellas donde figura como jefe de sala. Resuelve todos
 * los registros de `empleados` que comparten el `user_id` (ficha espejo
 * multi-empresa) para no perder vínculos de otras empresas. El alcance por
 * empresa lo aplica la RLS de `inspeccion_envios`.
 */
export async function listInspeccionesEmpleado(empleadoId: string) {
  try {
    const { supabase } = await getAppContext();

    const { data: emp, error: empErr } = await supabase
      .from("empleados")
      .select("id, user_id")
      .eq("id", empleadoId)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!emp) return { ok: false as const, error: "Empleado no encontrado" };

    // Todos los ids de empleado que comparten el mismo usuario (espejo
    // multi-empresa). Si no hay user_id, se usa solo el id recibido.
    let empleadoIds = [emp.id];
    if (emp.user_id) {
      const { data: espejos } = await supabase
        .from("empleados")
        .select("id")
        .eq("user_id", emp.user_id);
      const ids = (espejos ?? []).map((e) => e.id);
      if (ids.length > 0) empleadoIds = Array.from(new Set([emp.id, ...ids]));
    }

    const inList = `(${empleadoIds.join(",")})`;
    const { data, error } = await supabase
      .from("inspeccion_envios")
      .select(
        "id, numero_secuencial, fecha_inspeccion, nombre_inspector, nota_final, estado, verificado_at, verificado_por_empleado_id, jefe_sala_empleado_id, local:locales(nombre)",
      )
      .or(
        `verificado_por_empleado_id.in.${inList},jefe_sala_empleado_id.in.${inList}`,
      )
      .order("fecha_inspeccion", { ascending: false, nullsFirst: false });
    if (error) throw error;

    const idSet = new Set(empleadoIds);
    const items: InspeccionEmpleadoItem[] = (data ?? []).map((e) => {
      const verificada =
        e.verificado_por_empleado_id != null &&
        idSet.has(e.verificado_por_empleado_id);
      return {
        id: e.id,
        numero_secuencial: e.numero_secuencial,
        fecha_inspeccion: e.fecha_inspeccion,
        local_nombre: nombreRelacion(e.local),
        nombre_inspector: e.nombre_inspector,
        nota_final: e.nota_final != null ? Number(e.nota_final) : null,
        estado: e.estado,
        verificado_at: e.verificado_at ?? null,
        vinculo: verificada ? "verificada" : "jefe_sala",
      };
    });

    return { ok: true as const, data: items };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error cargando inspecciones";
    console.error("[rrhh] listInspeccionesEmpleado:", msg);
    return { ok: false as const, error: msg };
  }
}

/**
 * Detalle de una inspección en modo SOLO LECTURA, para verla desde la ficha
 * de RRHH sin entrar al módulo de Calidad. No expone ninguna acción de
 * edición. El alcance por empresa lo aplica la RLS de `inspeccion_envios`.
 */
export async function getInspeccionEmpleadoDetalle(envioId: string) {
  try {
    const { supabase } = await getAppContext();

    const { data: envio, error } = await supabase
      .from("inspeccion_envios")
      .select(
        "id, numero_secuencial, fecha_inspeccion, nombre_inspector, nombre_jefe_sala, nota_final, estado, verificado_at, notas_calidad, local:locales(nombre), plantilla:inspeccion_plantillas(nombre)",
      )
      .eq("id", envioId)
      .maybeSingle();
    if (error) throw error;
    if (!envio) return { ok: false as const, error: "Inspección no encontrada" };

    const { data: respuestas } = await supabase
      .from("inspeccion_respuestas")
      .select("id, pregunta_snapshot, valor_texto, valor_numero")
      .eq("envio_id", envioId);

    const respMap: InspeccionEmpleadoRespuesta[] = (respuestas ?? []).map((r) => {
      const snap = r.pregunta_snapshot as {
        seccion_titulo: string;
        seccion_orden: number;
        enunciado: string;
        tipo: string;
        orden: number;
        escala_max: number | null;
      };
      return {
        id: r.id as string,
        seccion_titulo: snap.seccion_titulo,
        seccion_orden: snap.seccion_orden,
        enunciado: snap.enunciado,
        tipo: snap.tipo,
        orden: snap.orden,
        escala_max: snap.escala_max,
        valor_texto: r.valor_texto,
        valor_numero: r.valor_numero != null ? Number(r.valor_numero) : null,
      };
    });
    respMap.sort((a, b) => a.seccion_orden - b.seccion_orden || a.orden - b.orden);

    const detalle: InspeccionEmpleadoDetalle = {
      id: envio.id,
      numero_secuencial: envio.numero_secuencial,
      fecha_inspeccion: envio.fecha_inspeccion,
      local_nombre: nombreRelacion(envio.local),
      nombre_inspector: envio.nombre_inspector,
      nombre_jefe_sala: envio.nombre_jefe_sala ?? null,
      plantilla_nombre: nombreRelacion(envio.plantilla),
      nota_final: envio.nota_final != null ? Number(envio.nota_final) : null,
      estado: envio.estado,
      verificado_at: envio.verificado_at ?? null,
      notas_calidad: envio.notas_calidad ?? null,
      respuestas: respMap,
    };

    return { ok: true as const, data: detalle };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error cargando la inspección";
    console.error("[rrhh] getInspeccionEmpleadoDetalle:", msg);
    return { ok: false as const, error: msg };
  }
}
