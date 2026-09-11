import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getZonaHorariaEmpresa, getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { getHorarioDia, type Tramo } from "@/features/rrhh/utils/horario-empleado";
import {
  getMobileIdentidad,
  type InicioEmpresa,
} from "./mobile-identidad-data";
import { getPointsResumen, type PointsResumen } from "@/features/toques/lib/points-resumen";

// La identidad (nombre, rol, foto, empresa activa y empresas accesibles) vive en
// `mobile-identidad-data`: la cabecera de TODAS las pantallas móviles la usa,
// no solo el Inicio.
export type { InicioEmpresa };

/** Jornada del empleado para hoy, resuelta desde cuadrantes/turnos. */
export type JornadaHoy =
  | { tipo: "libra" }
  | { tipo: "trabaja"; tramos: Tramo[] }
  | { tipo: "flexible"; horas: number }
  | { tipo: "desconocida" };

export interface MobileInicioData {
  nombre: string;
  rolLabel: string | null;
  avatarUrl: string | null;
  empresaActual: InicioEmpresa | null;
  empresas: InicioEmpresa[];
  jornadaHoy: JornadaHoy;
  /** Marcador de Points de la cabecera. Null si aún no juega en esta empresa. */
  points: PointsResumen | null;
}

function todayISO(tz: string): string {
  // Fecha en la zona horaria de la empresa (PRP-069), coherente con el fichaje.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export async function getMobileInicioData(): Promise<MobileInicioData> {
  const identidad = await getMobileIdentidad();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...identidad, jornadaHoy: { tipo: "desconocida" }, points: null };

  const admin = createAdminClient();

  // Jornada de hoy (libra / trabaja con tramos / flexible) en la empresa activa.
  let jornadaHoy: JornadaHoy = { tipo: "desconocida" };
  const empresaParaHorario =
    identidad.empresaActual?.id ?? (await getEmpresaActivaForUser(admin, user.id));
  if (empresaParaHorario) {
    const { data: empleado } = await admin
      .from("empleados")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (empleado?.id) {
      try {
        const tz = await getZonaHorariaEmpresa(admin, empresaParaHorario);
        const horario = await getHorarioDia(
          admin,
          empresaParaHorario,
          empleado.id as string,
          todayISO(tz),
        );
        if (horario.tipo === "ninguno") jornadaHoy = { tipo: "libra" };
        else if (horario.tipo === "fijo") jornadaHoy = { tipo: "trabaja", tramos: horario.tramos };
        else jornadaHoy = { tipo: "flexible", horas: horario.objetivoHoras };
      } catch {
        jornadaHoy = { tipo: "desconocida" };
      }
    }
  }

  // Marcador de Points (nivel + saldo) de la empresa activa, resuelto aquí para
  // que la cabecera salga pintada de una vez y no aparezca a medio segundo.
  let points: PointsResumen | null = null;
  if (empresaParaHorario) {
    try {
      points = await getPointsResumen(admin, user.id, empresaParaHorario);
    } catch (err) {
      // Sin points no se cae la portada: la píldora se pinta luego en el móvil.
      console.error("[mobile-inicio] points", err);
    }
  }

  return { ...identidad, jornadaHoy, points };
}
