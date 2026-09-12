import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calcularNivel,
  getMiBalance,
  getNiveles,
  getRecompensas,
} from "@/features/toques/services/toques.service";
import { COLOR_NIVEL_POR_DEFECTO } from "@/features/toques/lib/nivel-icono";

/** Un peldaño de la escalera de niveles, para enseñar a dónde puede llegar. */
export interface PointsNivelPaso {
  nombre: string;
  icono: string | null;
  color: string;
  toquesMin: number;
  /** Ya lo tiene. */
  alcanzado: boolean;
  /** Es el que lleva puesto ahora. */
  actual: boolean;
}

/** Lo que enseña la píldora de Points: en qué nivel va y cuántos points tiene. */
export interface PointsResumen {
  userId: string;
  /**
   * Empresa con la que se calculó. Es la que manda para saber si el marcador se
   * ha quedado viejo: el logo de arriba lo pone el navegador y este resumen lo
   * puede haber resuelto el servidor con OTRA empresa (la de la cookie), y
   * entonces se enseñaban los points de una empresa con el logo de la otra.
   */
  empresaId: string;
  /** Saldo: los points que tiene ahora mismo para gastar. */
  saldo: number;
  /** Acumulados de siempre: son los que mandan en el nivel. */
  acumulados: number;
  nivelNombre: string;
  nivelIcono: string | null;
  nivelColor: string;
  /** Cuánto lleva del camino al siguiente nivel (0-100). */
  progresoPct: number;
  siguienteNombre: string | null;
  /** Points que le faltan para el siguiente nivel. */
  faltan: number;
  /** Los niveles del juego, en orden, con el suyo marcado. */
  escalera: PointsNivelPaso[];
  /** Le llega para algún premio: es lo que engancha, así que se avisa. */
  puedeCanjear: boolean;
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
  const [balance, niveles, recompensas, enPruebas] = await Promise.all([
    getMiBalance(supabase, userId, empresaId),
    getNiveles(supabase, empresaId),
    getRecompensas(supabase, empresaId).catch(() => []),
    estaEnPeriodoDePrueba(supabase, userId, empresaId),
  ]);

  const nivel = calcularNivel(balance.toquesAcumulados, niveles);
  // El nivel 0 («Pruebas») no es un peldaño del juego: es la sala de espera.
  const peldanos = [...niveles]
    .filter((n) => n.orden > 0)
    .sort((a, b) => a.toquesMin - b.toquesMin);

  const masBarato = recompensas
    .filter((r) => r.activa)
    .reduce((min, r) => (min === null || r.costeToques < min ? r.costeToques : min), null as number | null);

  const escalera: PointsNivelPaso[] = peldanos.map((n) => ({
    nombre: n.nombre,
    icono: n.badgeIcon,
    color: n.badgeColor || COLOR_NIVEL_POR_DEFECTO,
    toquesMin: n.toquesMin,
    alcanzado: !enPruebas && balance.toquesAcumulados >= n.toquesMin,
    actual: !enPruebas && nivel.actual?.id === n.id,
  }));

  const comun = {
    userId,
    empresaId,
    saldo: balance.toquesCanjeables,
    acumulados: balance.toquesAcumulados,
    escalera,
    puedeCanjear: masBarato !== null && balance.toquesCanjeables >= masBarato,
  };

  // En periodo de prueba todavía no juega: su insignia es «Pruebas» (el nivel
  // de orden 0) y el camino al siguiente aún no ha empezado. Es lo mismo que
  // enseña su panel, y las dos cosas no pueden decir cosas distintas.
  if (enPruebas) {
    const pruebas = niveles.find((n) => n.orden === 0) ?? null;
    return {
      ...comun,
      nivelNombre: pruebas?.nombre ?? "Pruebas",
      nivelIcono: pruebas?.badgeIcon ?? "Hourglass",
      nivelColor: pruebas?.badgeColor ?? COLOR_NIVEL_POR_DEFECTO,
      progresoPct: 0,
      siguienteNombre: peldanos[0]?.nombre ?? null,
      faltan: 0,
      puedeCanjear: false,
    };
  }

  return {
    ...comun,
    nivelNombre: nivel.actual?.nombre ?? "Aprendiz",
    nivelIcono: nivel.actual?.badgeIcon ?? null,
    nivelColor: nivel.actual?.badgeColor ?? COLOR_NIVEL_POR_DEFECTO,
    progresoPct: nivel.progresoPct,
    siguienteNombre: nivel.siguiente?.nombre ?? null,
    faltan: nivel.toquesParaSiguiente,
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
