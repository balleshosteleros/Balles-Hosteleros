"use server";

/**
 * Buzones auditados: lo que ve y toca la persona desde Ajustes (PRP-094, Fase 1).
 *
 * Aquí NUNCA sale un `refresh_token` hacia el navegador. La lista dice si un
 * buzón está conectado, caducado o sin conectar, y nada más: el permiso vive en
 * `correo_buzones_tokens`, que tiene RLS sin policies y solo lee el servidor.
 */

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  getEmpresaActivaForUser,
  getZonaHorariaEmpresa,
} from "@/features/empresa/lib/empresa-server";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { sembrarBuzonesDeEmpresa } from "../services/sembrar-buzones";
import { desconectarBuzon, normalizarEmail } from "../services/buzones";
import type { BuzonVista, ConexionBuzon } from "../types";

async function getCtx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

/**
 * Lista los buzones de la empresa activa.
 *
 * Antes de listar, pone al día la lista desde la ficha de la empresa y adopta
 * los permisos que ya existan. Así el panel siempre enseña la foto real sin que
 * nadie tenga que dar de alta nada a mano.
 */
export async function listarBuzonesAction(): Promise<BuzonVista[]> {
  const { supabase, user, empresaId } = await getCtx();
  if (!user || !empresaId) return [];

  await sembrarBuzonesDeEmpresa(empresaId);

  const { data, error } = await supabase
    .from("correo_buzones")
    .select(
      "id, email, etiqueta, conexion, ultima_sync_at, ultimo_error, conectado_por",
    )
    .eq("empresa_id", empresaId)
    .eq("estado", "Activo")
    .order("etiqueta", { ascending: true });

  if (error || !data) return [];

  const tz = await getZonaHorariaEmpresa(
    supabase as unknown as SupabaseClient,
    empresaId,
  );

  // Nombre de quien conectó: se resuelve aparte para no acoplar la consulta a
  // la forma de la tabla de usuarios.
  const ids = [
    ...new Set(
      data.map((b) => b.conectado_por as string | null).filter(Boolean),
    ),
  ] as string[];
  const nombres = new Map<string, string>();
  if (ids.length) {
    const { data: usuarios } = await supabase
      .from("usuarios")
      .select("id, nombre, apellidos")
      .in("id", ids);
    for (const u of usuarios ?? []) {
      const nombre = [u.nombre, u.apellidos]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (nombre) nombres.set(u.id as string, nombre);
    }
  }

  return data.map((b) => ({
    id: b.id as string,
    email: String(b.email ?? ""),
    etiqueta: String(b.etiqueta ?? ""),
    conexion: (b.conexion as ConexionBuzon) ?? "sin_conectar",
    conectadoPor: nombres.get(b.conectado_por as string) ?? null,
    ultimaSync: b.ultima_sync_at
      ? formatFechaHoraEnZona(b.ultima_sync_at as string, tz)
      : null,
    ultimoError: (b.ultimo_error as string) ?? null,
  }));
}

/**
 * Desconecta un buzón A PROPÓSITO: se deja de contar su correo.
 *
 * Es el único camino por el que la empresa suelta un buzón. Quitarse la cuenta
 * del selector personal no pasa por aquí y no apaga nada.
 *
 * El histórico ya contado NO se borra: se deja de sumar de hoy en adelante.
 */
export async function desconectarBuzonAction(
  buzonId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, empresaId } = await getCtx();
  if (!user || !empresaId) return { ok: false, error: "Sin sesión" };

  // Que el buzón sea de la empresa activa se comprueba con el cliente del
  // usuario (RLS), no con el admin: si no es suyo, no aparece.
  const { data: buzon } = await supabase
    .from("correo_buzones")
    .select("id")
    .eq("id", buzonId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!buzon) return { ok: false, error: "Ese buzón no es de esta empresa" };

  await desconectarBuzon(buzonId);
  revalidatePath("/ajustes");
  return { ok: true };
}

/**
 * Añade un buzón que no está en la ficha de la empresa.
 *
 * Hace falta porque hay correos en uso que no cuelgan de ningún departamento de
 * la ficha (por ejemplo un buzón antiguo o el de un local concreto), y contarlos
 * también es parte de saber cuánto correo mueve la casa.
 */
export async function anadirBuzonAction(
  email: string,
  etiqueta: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user, empresaId } = await getCtx();
  if (!user || !empresaId) return { ok: false, error: "Sin sesión" };

  const correo = normalizarEmail(email);
  if (!correo || !correo.includes("@")) {
    return { ok: false, error: "Ese correo no es válido" };
  }

  const { error } = await supabase.from("correo_buzones").insert({
    empresa_id: empresaId,
    email: correo,
    etiqueta: etiqueta.trim() || correo.split("@")[0],
  });
  if (error) {
    // 23505 = ya existe. No es un fallo que haya que enseñar como error rojo.
    if (error.code === "23505") {
      return { ok: false, error: "Ese buzón ya está en la lista" };
    }
    return { ok: false, error: "No se ha podido añadir" };
  }

  revalidatePath("/ajustes");
  return { ok: true };
}
