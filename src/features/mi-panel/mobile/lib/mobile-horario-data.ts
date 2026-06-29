import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser, getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { ahoraEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  getHorarioDia,
  semanaDeFecha,
  type HorarioDia,
} from "@/features/rrhh/utils/horario-empleado";

export const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

/** Horario resuelto de un día concreto de la semana del empleado. */
export interface DiaHorario {
  fecha: string; // YYYY-MM-DD
  diaSemana: string; // "Lunes"…
  diaNum: number; // día del mes (1–31)
  esHoy: boolean;
  horario: HorarioDia;
}

export interface HorarioSemana {
  /** false si el usuario no es un empleado con horario (no se muestra rejilla). */
  disponible: boolean;
  lunes: string; // YYYY-MM-DD
  domingo: string; // YYYY-MM-DD
  dias: DiaHorario[];
}

/** Suma `n` días a una fecha "YYYY-MM-DD" (mediodía local para evitar DST). */
function sumarDias(fechaISO: string, n: number): string {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Horario semanal del empleado autenticado (lunes→domingo) resuelto desde
 * planificación, turnos directos y patrones. `offsetSemanas` desplaza la semana
 * (0 = actual, -1 = anterior, +1 = siguiente). Lee con el cliente admin igual
 * que el resto del Inicio móvil porque consulta el propio dato del usuario.
 */
export async function getMobileHorarioSemana(
  offsetSemanas = 0,
): Promise<HorarioSemana> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  // "Hoy" en la zona horaria de la empresa activa del usuario (PRP-069).
  const empresaActivaId = user ? await getEmpresaActivaForUser(admin, user.id) : null;
  const tz = await getZonaHorariaEmpresa(admin, empresaActivaId);
  const { fecha: hoy } = ahoraEnZona(tz);
  const fechaBase = sumarDias(hoy, offsetSemanas * 7);
  const { lunes, domingo } = semanaDeFecha(fechaBase);

  const diasVacios: DiaHorario[] = DIAS_SEMANA.map((nombre, i) => {
    const fecha = sumarDias(lunes, i);
    return {
      fecha,
      diaSemana: nombre,
      diaNum: Number(fecha.slice(8, 10)),
      esHoy: fecha === hoy,
      horario: { tipo: "ninguno" as const },
    };
  });

  const noDisponible: HorarioSemana = {
    disponible: false,
    lunes,
    domingo,
    dias: diasVacios,
  };
  if (!user) return noDisponible;

  const { data: empleado } = await admin
    .from("empleados")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!empleado?.id || !empresaActivaId) return noDisponible;

  const dias: DiaHorario[] = await Promise.all(
    diasVacios.map(async (d) => {
      try {
        const horario = await getHorarioDia(
          admin,
          empresaActivaId,
          empleado.id as string,
          d.fecha,
        );
        return { ...d, horario };
      } catch {
        return d;
      }
    }),
  );

  return { disponible: true, lunes, domingo, dias };
}
