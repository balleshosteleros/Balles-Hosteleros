"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

export async function listComunicados() {
  try {
    const { supabase, empresaId } = await getContext();
    const query = supabase
      .from("comunicados")
      .select("*")
      .order("created_at", { ascending: false });
    if (empresaId) query.eq("empresa_id", empresaId);
    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[comunicados] listComunicados:", err);
    return { ok: false, data: [] };
  }
}

export interface EmpleadoSelector {
  userId: string;
  nombre: string;
  apellidos: string;
  rolLabel: string | null;
  departamento: string | null;
}

export async function listEmpleadosParaComunicado(): Promise<{
  ok: boolean;
  data: EmpleadoSelector[];
  error?: string;
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [], error: "No autenticado" };
    const { data, error } = await supabase
      .from("usuarios")
      .select("user_id, nombre, apellidos, rol_label, departamento")
      .eq("empresa_id", empresaId)
      .order("nombre", { ascending: true });
    if (error) throw error;
    return {
      ok: true,
      data: (data ?? [])
        .filter((r: Record<string, unknown>) => !!r.user_id)
        .map((r: Record<string, unknown>) => ({
          userId: r.user_id as string,
          nombre: (r.nombre as string) ?? "",
          apellidos: (r.apellidos as string) ?? "",
          rolLabel: (r.rol_label as string | null) ?? null,
          departamento: (r.departamento as string | null) ?? null,
        })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] listEmpleadosParaComunicado:", msg);
    return { ok: false, data: [], error: msg };
  }
}

export interface ComunicadoInput {
  titulo: string;
  asunto?: string;
  cuerpo?: string;
  estado?: string;
  prioridad?: string;
  recurrencia?: string;
  todaEmpresa?: boolean;
  rolesDestinatarios?: string[];
  empleadosDestinatarios?: string[];
  departamentosDestinatarios?: string[];
  envio?: string | null;
  observaciones?: string;
}

function toRow(input: ComunicadoInput) {
  return {
    titulo: input.titulo,
    asunto: input.asunto ?? null,
    cuerpo: input.cuerpo ?? "",
    estado: input.estado ?? "borrador",
    prioridad: input.prioridad ?? "normal",
    recurrencia: input.recurrencia ?? "sin_repeticion",
    toda_empresa: input.todaEmpresa ?? true,
    roles_destinatarios: input.rolesDestinatarios ?? [],
    empleados_destinatarios: input.empleadosDestinatarios ?? [],
    departamentos_destinatarios: input.departamentosDestinatarios ?? [],
    envio: input.envio ?? null,
    observaciones: input.observaciones ?? null,
  };
}

export async function createComunicado(input: ComunicadoInput) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("comunicados")
      .insert({
        ...toRow(input),
        empresa_id: empresaId,
        creador_id: user?.id ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    if (data?.id && data?.estado === "publicado") {
      try {
        const { notificarComunicadoNuevo } = await import(
          "@/features/mi-panel/mobile/lib/push-comunicado"
        );
        await notificarComunicadoNuevo(data.id as string);
      } catch (e) {
        console.error("[comunicados] push:", e);
      }
      // Notificación in-app (campana + registro) — motor de alertas PRP-065.
      const { emitirNotifComunicado } = await import(
        "@/features/notificaciones/actions/emisores-actions"
      );
      await emitirNotifComunicado(data.id as string);
    }

    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] createComunicado:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateComunicado(id: string, input: ComunicadoInput) {
  try {
    const { supabase } = await getContext();
    const { data: anterior } = await supabase
      .from("comunicados")
      .select("estado")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("comunicados")
      .update({ ...toRow(input), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    // Solo notificamos al pasar de borrador → publicado para evitar spam de pushes
    // en ediciones menores de un comunicado ya publicado.
    const eraBorrador = anterior?.estado !== "publicado";
    const ahoraPublicado = (input.estado ?? "borrador") === "publicado";
    if (eraBorrador && ahoraPublicado) {
      try {
        const { notificarComunicadoNuevo } = await import(
          "@/features/mi-panel/mobile/lib/push-comunicado"
        );
        await notificarComunicadoNuevo(id);
      } catch (e) {
        console.error("[comunicados] push update:", e);
      }
      // Notificación in-app (campana + registro) — motor de alertas PRP-065.
      const { emitirNotifComunicado } = await import(
        "@/features/notificaciones/actions/emisores-actions"
      );
      await emitirNotifComunicado(id);
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] updateComunicado:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteComunicado(id: string) {
  try {
    const { supabase } = await getContext();
    const { error } = await supabase
      .from("comunicados")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[comunicados] deleteComunicado:", msg);
    return { ok: false, error: msg };
  }
}
