"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { listTurnos } from "@/features/rrhh/actions/turnos-actions";
import { listPatrones } from "@/features/rrhh/actions/patrones-actions";
import type { Turno } from "@/features/rrhh/data/horarios";
import { randomUUID } from "crypto";

/** Patrón aplicable a la plantilla: su nombre + la semana de turnos. */
export type PatronAplicable = { id: string; nombre: string; dias: (string | null)[] };

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

const SEMANA_VACIA: (string | null)[] = [null, null, null, null, null, null, null];

function normaDias(raw: unknown): (string | null)[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [...SEMANA_VACIA];
  for (let i = 0; i < 7; i++) out[i] = (arr[i] as string | null) ?? null;
  return out;
}

/**
 * Plantilla de horario del puesto = un `rrhh_patrones` (ligado por puesto_id)
 * con UNA semana de 7 turnos (turnoId | null). Devuelve también el catálogo de
 * turnos (fijos + flexibles) para el lateral del editor.
 */
export async function getPlantillaPuesto(puestoId: string): Promise<{
  plantillaId: string | null;
  dias: (string | null)[];
  turnos: Turno[];
  patrones: PatronAplicable[];
}> {
  const vacio = { plantillaId: null, dias: [...SEMANA_VACIA], turnos: [] as Turno[], patrones: [] as PatronAplicable[] };
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return vacio;

    const [turnosRes, patronesRes] = await Promise.all([
      listTurnos(empresaId),
      listPatrones(empresaId),
    ]);
    const turnos = turnosRes.ok ? turnosRes.data : [];
    // Patrones que se pueden aplicar a la plantilla (excluye los que son de un puesto).
    const patrones: PatronAplicable[] = (patronesRes.ok ? patronesRes.data : [])
      .map((p) => ({ id: p.id, nombre: p.nombre, dias: normaDias(p.semanas?.[0]?.dias ?? []) }));

    const { data: pat } = await supabase
      .from("rrhh_patrones")
      .select("id")
      .eq("puesto_id", puestoId)
      .eq("es_oficial", true)
      .maybeSingle();

    if (!pat?.id) return { plantillaId: null, dias: [...SEMANA_VACIA], turnos, patrones };

    const { data: sem } = await supabase
      .from("rrhh_patron_semanas")
      .select("dias")
      .eq("patron_id", pat.id)
      .order("orden")
      .limit(1)
      .maybeSingle();

    return { plantillaId: pat.id, dias: normaDias(sem?.dias), turnos, patrones };
  } catch (err) {
    console.error("[rrhh] getPlantillaPuesto:", err);
    return vacio;
  }
}

/** Crea o reemplaza la plantilla semanal (7 turnos) del puesto. */
export async function guardarPlantillaPuesto(
  puestoId: string,
  dias: (string | null)[],
) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId || !user) return { ok: false, error: "No autenticado" };

    const semana = normaDias(dias);

    // Nombre del puesto + nombre del autor para el patrón.
    const [{ data: puesto }, { data: usuario }] = await Promise.all([
      supabase.from("puestos").select("nombre").eq("id", puestoId).maybeSingle(),
      supabase.from("usuarios").select("nombre, full_name").eq("user_id", user.id).maybeSingle(),
    ]);
    const autor = (usuario?.nombre as string | null) ?? (usuario?.full_name as string | null) ?? "—";

    // ¿Ya tiene plantilla?
    const { data: existente } = await supabase
      .from("rrhh_patrones")
      .select("id")
      .eq("puesto_id", puestoId)
      .eq("es_oficial", true)
      .maybeSingle();

    let patronId = existente?.id as string | undefined;

    if (!patronId) {
      const { data: nuevo, error: insErr } = await supabase
        .from("rrhh_patrones")
        .insert({
          empresa_id: empresaId,
          puesto_id: puestoId,
          nombre: `Plantilla · ${(puesto?.nombre as string | null) ?? "Puesto"}`,
          tipo: "semanal",
          creado_por_nombre: autor,
          creado_por_user_id: user.id,
          familia_id: randomUUID(),
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      patronId = nuevo.id as string;
    } else {
      await supabase
        .from("rrhh_patrones")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", patronId);
    }

    // Reemplaza la semana (orden 0).
    await supabase.from("rrhh_patron_semanas").delete().eq("patron_id", patronId);
    const { error: semErr } = await supabase
      .from("rrhh_patron_semanas")
      .insert({ patron_id: patronId, orden: 0, dias: semana });
    if (semErr) throw semErr;

    revalidatePath("/rrhh/salarios");
    return { ok: true, patronId };
  } catch (err) {
    console.error("[rrhh] guardarPlantillaPuesto:", err);
    return { ok: false, error: "No se pudo guardar la plantilla" };
  }
}
