"use server";

/**
 * Los números de Marketing → Captación.
 *
 * Una sola llamada: la suma la hace la base (`marketing_captacion_canales`),
 * porque son 32.000 reservas y 36.000 fichas y traerlas al navegador para
 * contarlas allí serían decenas de vueltas y varios segundos de espera.
 *
 * Aislamiento por empresa: se pasa SIEMPRE el id de la empresa ACTIVA. La RLS
 * acota a las empresas del usuario, no a la activa.
 */

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { friendlyError } from "@/shared/lib/friendly-errors";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CAPTACION_VACIA, type CaptacionDatos } from "./types";

export interface CaptacionResult {
  ok: boolean;
  datos: CaptacionDatos;
  error?: string;
}

export async function cargarCaptacion(): Promise<CaptacionResult> {
  try {
    const supabase = await createClient();
    const user = await getUsuarioActual();
    if (!user) return { ok: false, datos: CAPTACION_VACIA };

    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ok: false, datos: CAPTACION_VACIA };

    const { data, error } = await supabase.rpc("marketing_captacion_canales", {
      p_empresa_id: empresaId,
    });
    if (error) throw error;

    const datos = data as CaptacionDatos | null;
    if (!datos) return { ok: true, datos: CAPTACION_VACIA };

    return {
      ok: true,
      datos: {
        porMes: datos.porMes ?? [],
        calidad: datos.calidad ?? [],
        clientes: datos.clientes ?? [],
        sinOrigen: datos.sinOrigen ?? { reservas: 0, clientes: 0 },
      },
    };
  } catch (err) {
    console.error("[captacion] cargarCaptacion:", err);
    return {
      ok: false,
      datos: CAPTACION_VACIA,
      error: friendlyError(err, "cargarCaptacion"),
    };
  }
}
