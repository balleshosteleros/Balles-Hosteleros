// Recorte del horario futuro al causar baja un empleado.
//
// Al indicar la fecha de baja (último día), toda asignación de turno/patrón que
// sea ILIMITADA (vigente_hasta = null) o que TERMINE DESPUÉS de la baja se
// recorta para que su último día sea la fecha de baja. Las asignaciones que ya
// terminan antes de la baja NO se tocan (no generan horario tras la salida, así
// que no hay contradicción). Además se borran los turnos sueltos ya
// materializados en el planner (rrhh_planificacion) posteriores a la baja.
//
// Idempotente: puede llamarse varias veces con la misma fecha sin efectos
// adversos (solo recorta lo que aún supera la baja).

import type { SupabaseClient } from "@supabase/supabase-js";

export async function recortarHorarioFuturoPorBaja(
  supabase: SupabaseClient,
  input: { empleadoId: string; empresaId?: string | null; fechaBaja: string },
): Promise<{ ok: boolean; error?: string }> {
  const { empleadoId, empresaId, fechaBaja } = input;
  if (!empleadoId || !fechaBaja) {
    return { ok: false, error: "Faltan empleadoId o fechaBaja" };
  }

  try {
    // 1) Turnos directos recurrentes: recortar los ilimitados o que superan la baja.
    {
      let q = supabase
        .from("rrhh_turno_empleados")
        .update({ vigente_hasta: fechaBaja })
        .eq("empleado_id", empleadoId)
        .or(`vigente_hasta.is.null,vigente_hasta.gt.${fechaBaja}`);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { error } = await q;
      if (error) throw error;
    }

    // 2) Patrones recurrentes: igual criterio.
    {
      const { error } = await supabase
        .from("rrhh_patron_empleados")
        .update({ vigente_hasta: fechaBaja })
        .eq("empleado_id", empleadoId)
        .or(`vigente_hasta.is.null,vigente_hasta.gt.${fechaBaja}`);
      if (error) throw error;
    }

    // 3) Planificación concreta (turnos sueltos por día ya colocados): borrar los
    //    posteriores a la baja. El último día (== fechaBaja) se conserva.
    {
      let q = supabase
        .from("rrhh_planificacion")
        .delete()
        .eq("empleado_id", empleadoId)
        .gt("fecha", fechaBaja);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { error } = await q;
      if (error) throw error;
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] recortarHorarioFuturoPorBaja:", msg);
    return { ok: false, error: msg };
  }
}
