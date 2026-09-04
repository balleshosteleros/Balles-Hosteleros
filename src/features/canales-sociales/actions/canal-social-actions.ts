"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReservaUrl, buildEmbedUrl } from "@/features/sala/data/reserva-links";
import {
  CANALES_SOCIALES,
  esCanalSocial,
  type CanalSocialId,
} from "@/features/canales-sociales/data/canales-sociales";

async function getCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, empresaSlug: null, empresaNombre: null };
  const empresaId = await getEmpresaActivaForUser(supabase as unknown as SupabaseClient, user.id);
  let empresaSlug: string | null = null;
  let empresaNombre: string | null = null;
  if (empresaId) {
    const { data } = await supabase
      .from("empresas")
      .select("slug, nombre")
      .eq("id", empresaId)
      .maybeSingle();
    empresaSlug = (data?.slug as string | null) ?? null;
    empresaNombre = (data?.nombre as string | null) ?? null;
  }
  return { supabase, user, empresaId, empresaSlug, empresaNombre };
}

export interface EstadoCanalSocial {
  canalId: CanalSocialId;
  empresaNombre: string;
  /** true si el enlace existe y está activo: es lo que decide el badge "Activo". */
  activo: boolean;
  /** true si el enlace existe aunque esté desactivado. */
  existe: boolean;
  /** URL que el restaurante pega en Instagram/Facebook. null si aún no hay slug. */
  url: string | null;
  /** URL del formulario embebido, por si lo quiere en su propia web. */
  embedUrl: string | null;
  /** Reservas ya entradas por este canal. Es la prueba de que funciona. */
  reservas: number;
}

/**
 * Estado del canal. No crea nada: la creación es una acción explícita del
 * usuario ("Activar"), porque activar sin pedirlo dejaría enlaces vivos en
 * empresas que no usan esa red.
 */
export async function getEstadoCanalSocial(
  canalId: string,
): Promise<EstadoCanalSocial | null> {
  if (!esCanalSocial(canalId)) return null;
  const { supabase, empresaId, empresaSlug, empresaNombre } = await getCtx();
  if (!empresaId) return null;

  const canal = CANALES_SOCIALES[canalId];
  const { data } = await supabase
    .from("reserva_links")
    .select("activo")
    .eq("empresa_id", empresaId)
    .eq("palabra_clave", canal.palabraClave)
    .maybeSingle();

  const { count } = await supabase
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("origen", canal.palabraClave);

  return {
    canalId,
    empresaNombre: empresaNombre ?? "",
    activo: Boolean(data?.activo),
    existe: Boolean(data),
    url: empresaSlug ? buildReservaUrl(empresaSlug, canal.palabraClave) : null,
    embedUrl: empresaSlug ? buildEmbedUrl(empresaSlug, canal.palabraClave) : null,
    reservas: count ?? 0,
  };
}

/**
 * Activa o desactiva el canal. Crea el enlace la primera vez y a partir de ahí
 * solo conmuta `activo`: así la URL que el restaurante ya pegó en Instagram
 * sigue siendo la misma si vuelve a activarlo, y el histórico de reservas no
 * pierde su atribución.
 */
export async function setCanalSocialActivo(canalId: string, activo: boolean) {
  try {
    if (!esCanalSocial(canalId)) return { ok: false as const, error: "Canal desconocido" };
    const { supabase, user, empresaId, empresaSlug } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "Sin empresa" };
    if (!empresaSlug) {
      return { ok: false as const, error: "La empresa no tiene slug configurado" };
    }
    const canal = CANALES_SOCIALES[canalId];
    const url = buildReservaUrl(empresaSlug, canal.palabraClave);

    const { data: existente } = await supabase
      .from("reserva_links")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("palabra_clave", canal.palabraClave)
      .maybeSingle();

    if (existente) {
      const { error } = await supabase
        .from("reserva_links")
        .update({ activo, updated_at: new Date().toISOString() })
        .eq("id", existente.id as string)
        .eq("empresa_id", empresaId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("reserva_links").insert({
        empresa_id: empresaId,
        palabra_clave: canal.palabraClave,
        url_generada: url,
        nombre: canal.nombre,
        activo,
        creado_por: user?.id ?? null,
        vende_tickets: false,
      });
      if (error) throw error;
    }

    revalidatePath(`/ajustes/canales/${canalId}`);
    revalidatePath("/sala/reservas/links");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false as const, error: msg };
  }
}
