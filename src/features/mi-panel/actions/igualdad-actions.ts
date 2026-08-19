"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { VERSION_PROTOCOLO } from "../data/protocolo-igualdad";

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const empresaId = user ? await getEmpresaActivaForUser(supabase, user.id) : null;
  return { supabase, user, empresaId };
}

/** ¿Ya confirmó este empleado la versión vigente del protocolo? */
export async function getMiConfirmacion(): Promise<{
  ok: boolean;
  confirmado: boolean;
  fecha?: string | null;
}> {
  try {
    const { supabase, user, empresaId } = await ctx();
    if (!user || !empresaId) return { ok: false, confirmado: false };
    const { data, error } = await supabase
      .from("igualdad_confirmaciones")
      .select("confirmado_at")
      .eq("empresa_id", empresaId)
      .eq("user_id", user.id)
      .eq("version", VERSION_PROTOCOLO)
      .maybeSingle();
    if (error) throw error;
    return {
      ok: true,
      confirmado: Boolean(data),
      fecha: (data?.confirmado_at as string) ?? null,
    };
  } catch (err) {
    console.error("[igualdad] getMiConfirmacion:", err);
    return { ok: false, confirmado: false };
  }
}

/**
 * El empleado confirma que ha leído el protocolo. Esta fila, con su nombre y
 * la fecha, es la prueba de que se le ha comunicado.
 */
export async function confirmarLectura(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user, empresaId } = await ctx();
    if (!user || !empresaId) return { ok: false, error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("usuarios")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error } = await supabase.from("igualdad_confirmaciones").insert({
      empresa_id: empresaId,
      user_id: user.id,
      empleado_nombre: (perfil?.full_name as string) ?? null,
      version: VERSION_PROTOCOLO,
    });
    // Si ya estaba confirmada, el índice único lo impide: no es un error real.
    if (error && !error.message.includes("duplicate")) throw error;
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[igualdad] confirmarLectura:", msg);
    return { ok: false, error: msg };
  }
}

export interface FilaSeguimiento {
  userId: string;
  nombre: string;
  confirmadoAt: string | null;
}

/**
 * Seguimiento para RRHH: quién ha confirmado y quién no. Es el listado que se
 * enseña en una inspección para acreditar la comunicación a la plantilla.
 */
export async function getSeguimientoIgualdad(): Promise<{
  ok: boolean;
  data: { confirmados: FilaSeguimiento[]; pendientes: FilaSeguimiento[] };
}> {
  const vacio = { confirmados: [], pendientes: [] };
  try {
    const { supabase, empresaId } = await ctx();
    if (!empresaId) return { ok: true, data: vacio };

    const [{ data: usuarios }, { data: confirmaciones }] = await Promise.all([
      supabase.from("usuarios").select("user_id, full_name").eq("empresa_id", empresaId),
      supabase
        .from("igualdad_confirmaciones")
        .select("user_id, confirmado_at")
        .eq("empresa_id", empresaId)
        .eq("version", VERSION_PROTOCOLO),
    ]);

    const porUsuario = new Map<string, string>(
      (confirmaciones ?? []).map((c) => [c.user_id as string, c.confirmado_at as string]),
    );

    const confirmados: FilaSeguimiento[] = [];
    const pendientes: FilaSeguimiento[] = [];

    for (const u of usuarios ?? []) {
      const userId = u.user_id as string;
      if (!userId) continue;
      const fila: FilaSeguimiento = {
        userId,
        nombre: (u.full_name as string) ?? "Sin nombre",
        confirmadoAt: porUsuario.get(userId) ?? null,
      };
      if (fila.confirmadoAt) confirmados.push(fila);
      else pendientes.push(fila);
    }

    const porNombre = (a: FilaSeguimiento, b: FilaSeguimiento) =>
      a.nombre.localeCompare(b.nombre, "es");
    confirmados.sort(porNombre);
    pendientes.sort(porNombre);

    return { ok: true, data: { confirmados, pendientes } };
  } catch (err) {
    console.error("[igualdad] getSeguimientoIgualdad:", err);
    return { ok: false, data: vacio };
  }
}
