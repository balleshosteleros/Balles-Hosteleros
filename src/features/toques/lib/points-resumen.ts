import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularNivel, getMiBalance, getNiveles } from "@/features/toques/services/toques.service";
import { COLOR_NIVEL_POR_DEFECTO } from "@/features/toques/lib/nivel-icono";

/** Lo que enseña la píldora de Points: en qué nivel va y cuántos points tiene. */
export interface PointsResumen {
  userId: string;
  /** Saldo: los points que tiene ahora mismo para gastar. */
  saldo: number;
  nivelNombre: string;
  nivelIcono: string | null;
  nivelColor: string;
  /** Cuánto lleva del camino al siguiente nivel (0-100). */
  progresoPct: number;
}

/**
 * Nivel + saldo de un trabajador EN UNA EMPRESA. Los points son de cada
 * empresa, como el puesto, así que la empresa no es opcional.
 *
 * Sirve igual en el servidor (para que la cabecera salga pintada de una vez) y
 * en el navegador (al cambiar de empresa): por eso recibe el cliente de
 * Supabase en vez de crearlo.
 */
export async function getPointsResumen(
  supabase: SupabaseClient,
  userId: string,
  empresaId: string,
): Promise<PointsResumen> {
  const [balance, niveles, enPruebas] = await Promise.all([
    getMiBalance(supabase, userId, empresaId),
    getNiveles(supabase, empresaId),
    estaEnPeriodoDePrueba(supabase, userId, empresaId),
  ]);

  // En periodo de prueba todavía no juega: su insignia es «Pruebas» (el nivel
  // de orden 0) y el camino al siguiente aún no ha empezado. Es lo mismo que
  // enseña su panel, y las dos cosas no pueden decir cosas distintas.
  if (enPruebas) {
    const pruebas = niveles.find((n) => n.orden === 0) ?? null;
    return {
      userId,
      saldo: balance.toquesCanjeables,
      nivelNombre: pruebas?.nombre ?? "Pruebas",
      nivelIcono: pruebas?.badgeIcon ?? "Hourglass",
      nivelColor: pruebas?.badgeColor ?? COLOR_NIVEL_POR_DEFECTO,
      progresoPct: 0,
    };
  }

  const nivel = calcularNivel(balance.toquesAcumulados, niveles);
  return {
    userId,
    saldo: balance.toquesCanjeables,
    nivelNombre: nivel.actual?.nombre ?? "Aprendiz",
    nivelIcono: nivel.actual?.badgeIcon ?? null,
    nivelColor: nivel.actual?.badgeColor ?? COLOR_NIVEL_POR_DEFECTO,
    progresoPct: nivel.progresoPct,
  };
}

/**
 * El periodo de prueba cuelga de la FICHA del empleado (`empleados.id`), que no
 * es el `user_id`: hay que resolverla en esta empresa antes de preguntar.
 */
async function estaEnPeriodoDePrueba(
  supabase: SupabaseClient,
  userId: string,
  empresaId: string,
): Promise<boolean> {
  const { data: ficha } = await supabase
    .from("empleados")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!ficha?.id) return false;
  const { data } = await supabase
    .from("empleado_periodo_prueba")
    .select("fecha_fin")
    .eq("empresa_id", empresaId)
    .eq("empleado_id", ficha.id as string)
    .eq("decision", "pendiente")
    .maybeSingle();
  return Boolean(data);
}
