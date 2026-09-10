"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserPermisos } from "@/features/auth/actions/permisos-actions";
import { puedeVerModulo } from "@/features/auth/lib/permisos";
import { getMetaCredenciales } from "@/features/marketing/meta-ads/services/meta-credenciales";
import { metaGet } from "@/features/marketing/meta-ads/services/meta-client";
import { MetaApiError } from "@/features/marketing/meta-ads/lib/meta-api";

/**
 * PRP-087 · Buscador de ubicaciones e intereses de Meta.
 *
 * No basta con escribir "Madrid": Meta trabaja con sus propios códigos, y un
 * texto suelto lo rechaza. Por eso se busca contra su catálogo y se guarda lo
 * que él devuelve.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

function fallo(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

async function credenciales() {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return fallo("Sesión no válida.");
  if (!empresaId) return fallo("Sin empresa activa.");

  const { permisos } = await getUserPermisos();
  if (!puedeVerModulo(permisos, "MARKETING")) return fallo("Sin permiso.");

  const cred = await getMetaCredenciales(createAdminClient(), empresaId);
  if (!cred) return fallo("Esta empresa no tiene Meta conectado.");
  return { ok: true as const, cred };
}

export interface UbicacionMeta {
  clave: string;
  nombre: string;
  /** "Madrid, España" para poder distinguir dos ciudades que se llaman igual. */
  detalle: string;
}

/** Ciudades que Meta reconoce para el texto escrito. */
export async function buscarCiudadesMetaAction(texto: string): Promise<Resultado<UbicacionMeta[]>> {
  if (texto.trim().length < 2) return { ok: true, data: [] };

  const c = await credenciales();
  if (!("cred" in c)) return c;

  try {
    const res = await metaGet<{
      data?: Array<{ key?: string; name?: string; region?: string; country_name?: string }>;
    }>("/search", c.cred.accessToken, {
      type: "adgeolocation",
      location_types: JSON.stringify(["city"]),
      q: texto.trim(),
      limit: 15,
    });

    return {
      ok: true,
      data: (res.data ?? [])
        .filter((u) => u.key && u.name)
        .map((u) => ({
          clave: u.key as string,
          nombre: u.name as string,
          detalle: [u.region, u.country_name].filter(Boolean).join(", "),
        })),
    };
  } catch (err) {
    if (err instanceof MetaApiError) return fallo(err.message);
    return fallo("No se han podido buscar las ciudades.");
  }
}

export interface InteresMeta {
  id: string;
  name: string;
  /** Cuánta gente hay más o menos con ese interés: ayuda a no elegir uno vacío. */
  audiencia: number | null;
}

/** Intereses del catálogo de Meta (cocina, restaurantes, vinos…). */
export async function buscarInteresesMetaAction(texto: string): Promise<Resultado<InteresMeta[]>> {
  if (texto.trim().length < 2) return { ok: true, data: [] };

  const c = await credenciales();
  if (!("cred" in c)) return c;

  try {
    const res = await metaGet<{
      data?: Array<{ id?: string; name?: string; audience_size_lower_bound?: number }>;
    }>("/search", c.cred.accessToken, {
      type: "adinterest",
      q: texto.trim(),
      limit: 15,
    });

    return {
      ok: true,
      data: (res.data ?? [])
        .filter((i) => i.id && i.name)
        .map((i) => ({
          id: i.id as string,
          name: i.name as string,
          audiencia: i.audience_size_lower_bound ?? null,
        })),
    };
  } catch (err) {
    if (err instanceof MetaApiError) return fallo(err.message);
    return fallo("No se han podido buscar los intereses.");
  }
}
