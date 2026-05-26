"use server";

import { createClient } from "@/lib/supabase/server";

export interface MiPanelInspeccionItem {
  id: string;
  numero_secuencial: number | null;
  fecha_inspeccion: string | null;
  local_nombre: string | null;
  empresa_nombre: string | null;
  nombre_inspector: string;
  nota_final: number | null;
  estado: "pendiente_revision" | "revisado" | "archivado";
  verificado_at: string;
}

export interface MiPanelInspeccionDetalle extends MiPanelInspeccionItem {
  plantilla_nombre: string | null;
  nombre_jefe_sala: string | null;
  notas_calidad: string | null;
  respuestas: Array<{
    id: string;
    seccion_titulo: string;
    seccion_orden: number;
    enunciado: string;
    tipo: string;
    orden: number;
    valor_texto: string | null;
    valor_numero: number | null;
    escala_max: number | null;
  }>;
}

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function getEmpleadoIdsDelUsuario(
  supabase: Awaited<ReturnType<typeof ctx>>["supabase"],
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("empleados")
    .select("id")
    .eq("profile_id", userId);
  return (data ?? []).map((e) => e.id);
}

export async function listMisInspeccionesVerificadas(): Promise<
  MiPanelInspeccionItem[]
> {
  const { supabase, user } = await ctx();
  if (!user) return [];

  const empleadoIds = await getEmpleadoIdsDelUsuario(supabase, user.id);
  if (empleadoIds.length === 0) return [];

  const { data, error } = await supabase
    .from("inspeccion_envios")
    .select(
      "id, numero_secuencial, fecha_inspeccion, nombre_inspector, nota_final, estado, verificado_at, local:locales(nombre), empresa:empresas(nombre)",
    )
    .in("verificado_por_empleado_id", empleadoIds)
    .not("verificado_at", "is", null)
    .order("verificado_at", { ascending: false });
  if (error || !data) return [];

  return data.map((e): MiPanelInspeccionItem => ({
    id: e.id,
    numero_secuencial: e.numero_secuencial,
    fecha_inspeccion: e.fecha_inspeccion,
    local_nombre:
      (Array.isArray(e.local)
        ? e.local[0]?.nombre
        : (e.local as { nombre: string } | null)?.nombre) ?? null,
    empresa_nombre:
      (Array.isArray(e.empresa)
        ? e.empresa[0]?.nombre
        : (e.empresa as { nombre: string } | null)?.nombre) ?? null,
    nombre_inspector: e.nombre_inspector,
    nota_final: e.nota_final != null ? Number(e.nota_final) : null,
    estado: e.estado,
    verificado_at: e.verificado_at as string,
  }));
}

export async function getMiInspeccionDetalle(
  envioId: string,
): Promise<MiPanelInspeccionDetalle | null> {
  const { supabase, user } = await ctx();
  if (!user) return null;

  const empleadoIds = await getEmpleadoIdsDelUsuario(supabase, user.id);
  if (empleadoIds.length === 0) return null;

  const { data: envio, error } = await supabase
    .from("inspeccion_envios")
    .select(
      "id, numero_secuencial, fecha_inspeccion, nombre_inspector, nombre_jefe_sala, nota_final, estado, verificado_at, notas_calidad, local:locales(nombre), empresa:empresas(nombre), plantilla:inspeccion_plantillas(nombre)",
    )
    .eq("id", envioId)
    .in("verificado_por_empleado_id", empleadoIds)
    .maybeSingle();
  if (error || !envio || !envio.verificado_at) return null;

  const { data: respuestas } = await supabase
    .from("inspeccion_respuestas")
    .select("id, pregunta_snapshot, valor_texto, valor_numero")
    .eq("envio_id", envioId);

  const respMap = (respuestas ?? []).map((r) => {
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
  respMap.sort(
    (a, b) =>
      a.seccion_orden - b.seccion_orden || a.orden - b.orden,
  );

  return {
    id: envio.id,
    numero_secuencial: envio.numero_secuencial,
    fecha_inspeccion: envio.fecha_inspeccion,
    local_nombre:
      (Array.isArray(envio.local)
        ? envio.local[0]?.nombre
        : (envio.local as { nombre: string } | null)?.nombre) ?? null,
    empresa_nombre:
      (Array.isArray(envio.empresa)
        ? envio.empresa[0]?.nombre
        : (envio.empresa as { nombre: string } | null)?.nombre) ?? null,
    nombre_inspector: envio.nombre_inspector,
    nombre_jefe_sala: envio.nombre_jefe_sala ?? null,
    nota_final: envio.nota_final != null ? Number(envio.nota_final) : null,
    estado: envio.estado,
    verificado_at: envio.verificado_at as string,
    plantilla_nombre:
      (Array.isArray(envio.plantilla)
        ? envio.plantilla[0]?.nombre
        : (envio.plantilla as { nombre: string } | null)?.nombre) ?? null,
    notas_calidad: envio.notas_calidad ?? null,
    respuestas: respMap,
  };
}
