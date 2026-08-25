"use server";

/**
 * Grupos de zonas que puede elegir el cliente, con su disponibilidad real.
 *
 * El cliente ve nombres comerciales ("Sala", "Terraza Exterior"), no las zonas
 * internas. Para cada uno se calcula si le queda alguna mesa o combinación
 * libre a esa fecha/hora y para ese número de comensales, de modo que el
 * formulario pueda mostrarlo en gris y sin poder elegirse — igual que hace
 * CoverManager con su "(Zona Completo)".
 */

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGruposZonasDisponibles } from "@/features/sala/lib/grupos-zonas-disponibilidad";
import type { SupabaseClient } from "@supabase/supabase-js";

const inputSchema = z.object({
  empresaSlug: z.string().min(1).max(120),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  personas: z.number().int().min(1).max(50),
});

export interface GrupoZonaPublico {
  id: string;
  nombre: string;
  /** false → se pinta en gris y no se puede elegir. */
  disponible: boolean;
}

export interface GruposZonasPublicoResult {
  /** ¿Hay que obligar al cliente a elegir zona? */
  exigido: boolean;
  grupos: GrupoZonaPublico[];
}

export async function listarGruposZonasPublica(
  input: z.input<typeof inputSchema>,
): Promise<GruposZonasPublicoResult> {
  const vacio: GruposZonasPublicoResult = { exigido: false, grupos: [] };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return vacio;
  const data = parsed.data;

  try {
    const admin = createAdminClient();

    const { data: empresa } = await admin
      .from("empresas")
      .select("id")
      .eq("slug", data.empresaSlug)
      .maybeSingle();
    if (!empresa) return vacio;

    const { data: local } = await admin
      .from("locales")
      .select("id")
      .eq("empresa_id", empresa.id)
      .limit(1)
      .maybeSingle();
    if (!local) return vacio;

    const { data: cfg } = await admin
      .from("empresa_reservas_config")
      .select("exigir_zona_cliente")
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    const exigido = (cfg?.exigir_zona_cliente as boolean) ?? false;

    const grupos = await getGruposZonasDisponibles(admin as unknown as SupabaseClient, {
      empresaId: empresa.id as string,
      localId: local.id as string,
      fecha: data.fecha,
      hora: data.hora,
      personas: data.personas,
    });

    return {
      exigido,
      grupos: grupos.map((g) => ({
        id: g.id,
        nombre: g.nombre,
        disponible: g.disponible,
      })),
    };
  } catch (err) {
    console.error("[listar-grupos-zonas-publica]", err);
    return vacio;
  }
}
