"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

export interface VacanteInput {
  titulo: string;
  descripcion?: string | null;
  puesto_id?: string | null;
  departamento_id?: string | null;
  categoria?: string | null;
  ubicacion?: string | null;
  tipo_jornada?: string | null;
  tipo_contrato?: string | null;
  salario_rango?: string | null;
  estado_publicacion?: "publicada" | "borrador" | "cerrada" | "archivada";
  visible_publicamente?: boolean;
  cuestionario?: boolean;
  favorita?: boolean;
  /** Plantilla de estados (consecución del pipeline) elegida en el alta. */
  plantilla_estado_id?: string | null;
  /** Map { estado_key: email_plantilla_id } elegido por estado. */
  email_plantillas?: Record<string, string | null>;
  /** Cuestionario que rellena el candidato al inscribirse (opcional). */
  cuestionario_plantilla_id?: string | null;
}

export async function listVacantes() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] as never[] };

    const { data, error } = await supabase
      .from("vacantes")
      .select(`
        *,
        puestos(id,nombre),
        departamentos(id,nombre,area)
      `)
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[rrhh] listVacantes:", err);
    return { ok: false, data: [] };
  }
}

export async function getVacanteById(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: null };

    const { data, error } = await supabase
      .from("vacantes")
      .select("*, puestos(id,nombre), departamentos(id,nombre)")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (err) {
    console.error("[rrhh] getVacanteById:", err);
    return { ok: false, data: null };
  }
}

/**
 * Resuelve el NOMBRE actual de un puesto para guardarlo como snapshot informativo
 * en la vacante (desacople: la vacante no depende en vivo del puesto).
 */
async function resolverPuestoSnapshot(
  supabase: Awaited<ReturnType<typeof getContext>>["supabase"],
  puestoId?: string | null,
): Promise<string | null> {
  if (!puestoId) return null;
  const { data } = await supabase.from("puestos").select("nombre").eq("id", puestoId).maybeSingle();
  return (data?.nombre as string | undefined) ?? null;
}

export async function createVacante(input: VacanteInput) {
  try {
    const { supabase, user, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.titulo?.trim()) return { ok: false, error: "El título es obligatorio" };

    const puestoSnapshot = await resolverPuestoSnapshot(supabase, input.puesto_id);

    const { data, error } = await supabase
      .from("vacantes")
      .insert({
        empresa_id: empresaId,
        titulo: input.titulo.trim(),
        descripcion: input.descripcion ?? null,
        puesto_id: input.puesto_id ?? null,
        puesto_snapshot: puestoSnapshot,
        departamento_id: input.departamento_id ?? null,
        categoria: input.categoria ?? null,
        ubicacion: input.ubicacion ?? null,
        tipo_jornada: input.tipo_jornada ?? null,
        tipo_contrato: input.tipo_contrato ?? null,
        salario_rango: input.salario_rango ?? null,
        estado_publicacion: input.estado_publicacion ?? "borrador",
        visible_publicamente: input.visible_publicamente ?? false,
        cuestionario: input.cuestionario ?? !!input.cuestionario_plantilla_id,
        favorita: input.favorita ?? false,
        plantilla_estado_id: input.plantilla_estado_id ?? null,
        email_plantillas: input.email_plantillas ?? {},
        cuestionario_plantilla_id: input.cuestionario_plantilla_id ?? null,
        creado_por: user?.id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] createVacante:", msg);
    return { ok: false, error: msg };
  }
}

export async function updateVacante(id: string, input: Partial<VacanteInput>) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Si cambia el puesto, refrescamos el snapshot informativo del nombre.
    const patch: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() };
    if ("puesto_id" in input) {
      patch.puesto_snapshot = await resolverPuestoSnapshot(supabase, input.puesto_id);
    }

    const { error } = await supabase
      .from("vacantes")
      .update(patch)
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) throw error;
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] updateVacante:", msg);
    return { ok: false, error: msg };
  }
}

export async function deleteVacante(id: string) {
  try {
    const { supabase, user } = await getContext();
    if (!user) return { ok: false, error: "No autenticado" };

    // Protección: una vacante con candidatos NO se puede borrar (se perdería el
    // histórico del pipeline). Hay que mover o eliminar antes esos candidatos.
    const { count: candidatos, error: countError } = await supabase
      .from("candidatos")
      .select("id", { count: "exact", head: true })
      .eq("vacante_id", id);
    if (countError) throw countError;
    if ((candidatos ?? 0) > 0) {
      return {
        ok: false,
        error:
          `No se puede borrar: la vacante tiene ${candidatos} candidato(s) en el pipeline. ` +
          "Muévelos o elimínalos antes de borrar la vacante.",
      };
    }

    // El id es PK única; RLS se encarga de la autorización. No filtramos por
    // empresa_id porque el contexto seleccionado en cliente puede no coincidir
    // con el `profiles.empresa_id` por defecto.
    const { data, error } = await supabase
      .from("vacantes")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) {
      return { ok: false, error: "No se encontró la vacante o sin permisos" };
    }
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] deleteVacante:", msg);
    return { ok: false, error: msg };
  }
}

export async function toggleVisibilidadVacante(id: string, visible: boolean) {
  return updateVacante(id, { visible_publicamente: visible });
}

/**
 * Persiste el orden de las vacantes (el mismo que se ve en el portal público).
 * Recibe los ids ya ordenados; asigna `orden` 0,1,2… respetando la secuencia.
 */
export async function reordenarVacantes(ids: string[]) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from("vacantes")
        .update({ orden: i })
        .eq("id", ids[i])
        .eq("empresa_id", empresaId);
      if (error) throw error;
    }
    revalidatePath("/rrhh/reclutamiento");
    return { ok: true as const };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] reordenarVacantes:", msg);
    return { ok: false as const, error: msg };
  }
}

export async function publicarVacante(id: string) {
  // Publicar = aparece en el portal de empleo → estado publicada + visible.
  return updateVacante(id, { estado_publicacion: "publicada", visible_publicamente: true });
}

export async function despublicarVacante(id: string) {
  // Despublicar = vuelve a borrador y se retira del portal de empleo.
  return updateVacante(id, { estado_publicacion: "borrador", visible_publicamente: false });
}

export async function cerrarVacante(id: string) {
  return updateVacante(id, { estado_publicacion: "cerrada", visible_publicamente: false });
}

export async function listPuestosCatalogo() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("puestos")
      .select("id,nombre,departamento_id")
      .eq("empresa_id", empresaId)
      .eq("estado", "activo")
      .order("nombre");
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[rrhh] listPuestosCatalogo:", err);
    return { ok: false, data: [] };
  }
}

export async function listDepartamentosCatalogo() {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const { data, error } = await supabase
      .from("departamentos")
      .select("id,nombre,area")
      .eq("empresa_id", empresaId)
      .order("nombre");
    if (error) throw error;
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("[rrhh] listDepartamentosCatalogo:", err);
    return { ok: false, data: [] };
  }
}

export async function createPuesto(input: { nombre: string; departamento_id?: string | null; descripcion?: string | null }) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const nombre = input.nombre?.trim() ?? "";
    if (!nombre) return { ok: false, error: "El nombre es obligatorio" };

    // Nombre único por empresa (ignorando mayúsculas/minúsculas y espacios).
    // Dos puestos deben diferenciarse al menos en una letra.
    const { data: dup } = await supabase
      .from("puestos")
      .select("id")
      .eq("empresa_id", empresaId)
      .ilike("nombre", nombre)
      .limit(1)
      .maybeSingle();
    if (dup?.id) {
      return { ok: false, error: `Ya existe un puesto llamado "${nombre}". Debe diferenciarse al menos en una letra.` };
    }

    const { data, error } = await supabase
      .from("puestos")
      .insert({
        empresa_id: empresaId,
        nombre,
        departamento_id: input.departamento_id ?? null,
        descripcion: input.descripcion ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    // Cronograma 1:1 con el puesto: se crea AL MOMENTO (idempotente).
    await crearCronogramaParaPuesto(data.id);

    revalidatePath("/rrhh/puestos");
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] createPuesto:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Edita un puesto existente (nombre, descripción y/o departamento). El cambio de
 * nombre o departamento se propaga automáticamente a cronograma y empleados con
 * ese puesto principal vía trigger BD (`tg_sync_puesto_cambios`). Las vacantes
 * NO se ven afectadas (están desacopladas).
 */
export async function updatePuesto(input: {
  id: string;
  nombre?: string;
  descripcion?: string | null;
  departamento_id?: string;
  // Datos de gestoría (compartidos por el puesto)
  convenio_colectivo?: string | null;
  tipo_contrato_defecto?: string | null;
}) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!input.id) return { ok: false, error: "Falta el puesto" };

    const patch: Record<string, unknown> = {};
    if (input.nombre !== undefined) {
      const nombre = input.nombre.trim();
      if (!nombre) return { ok: false, error: "El nombre es obligatorio" };
      // Nombre único por empresa (ignorando mayúsculas/minúsculas y espacios),
      // excluyendo el propio puesto.
      const { data: dup } = await supabase
        .from("puestos")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("nombre", nombre)
        .neq("id", input.id)
        .limit(1)
        .maybeSingle();
      if (dup?.id) {
        return { ok: false, error: `Ya existe un puesto llamado "${nombre}". Debe diferenciarse al menos en una letra.` };
      }
      patch.nombre = nombre;
    }
    if (input.descripcion !== undefined) patch.descripcion = input.descripcion;
    if (input.departamento_id !== undefined) {
      if (!input.departamento_id) return { ok: false, error: "El departamento es obligatorio" };
      patch.departamento_id = input.departamento_id;
    }
    if (input.convenio_colectivo !== undefined) patch.convenio_colectivo = input.convenio_colectivo || null;
    if (input.tipo_contrato_defecto !== undefined) patch.tipo_contrato_defecto = input.tipo_contrato_defecto || null;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { data, error } = await supabase
      .from("puestos")
      .update(patch)
      .eq("id", input.id)
      .eq("empresa_id", empresaId)
      .select()
      .single();
    if (error) throw error;

    revalidatePath("/rrhh/puestos");
    revalidatePath("/direccion/cronogramas");
    return { ok: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] updatePuesto:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Borra un puesto (plantilla) y su vacante espejo.
 *
 * IMPORTANTE: el puesto es una PLANTILLA. Sus condiciones se copian dentro del
 * empleado al contratarlo y viven ahí de forma independiente, así que borrar el
 * puesto NO debe tocar a los empleados ni bloquearse por ellos.
 *
 * Solo BLOQUEA si la vacante del puesto tiene candidatos en el pipeline (se
 * perdería el histórico de reclutamiento). Sin candidatos: borra la vacante
 * espejo (evita huérfanas por SET NULL) y el puesto (cascada cronograma/salarios).
 */
export async function deletePuesto(id: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    if (!id) return { ok: false, error: "Falta el puesto" };

    const { data: puesto } = await supabase
      .from("puestos")
      .select("nombre")
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!puesto) return { ok: false, error: "No se encontró el puesto o sin permisos" };
    const nombre = (puesto.nombre as string) ?? "";

    // ¿La vacante del puesto tiene candidatos?
    const { data: vacs } = await supabase
      .from("vacantes")
      .select("id")
      .eq("puesto_id", id)
      .eq("empresa_id", empresaId);
    const vacIds = (vacs ?? []).map((v) => v.id as string);
    if (vacIds.length > 0) {
      const { count: candidatos, error: countError } = await supabase
        .from("candidatos")
        .select("id", { count: "exact", head: true })
        .in("vacante_id", vacIds);
      if (countError) throw countError;
      if ((candidatos ?? 0) > 0) {
        return {
          ok: false,
          error:
            `No se puede borrar: la vacante de "${nombre}" tiene ${candidatos} candidato(s) en el pipeline. ` +
            "Muévelos o elimínalos antes de borrar el puesto.",
        };
      }
      // Sin candidatos → borrar la vacante espejo para que no quede huérfana.
      const { error: delVacErr } = await supabase.from("vacantes").delete().in("id", vacIds);
      if (delVacErr) throw delVacErr;
    }

    // 3) Borrar el puesto (cascada: cronograma, puesto_salarios, etc.)
    const { data, error } = await supabase
      .from("puestos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      return { ok: false, error: "No se encontró el puesto o sin permisos" };
    }

    revalidatePath("/rrhh/puestos");
    revalidatePath("/rrhh/reclutamiento");
    revalidatePath("/direccion/cronogramas");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] deletePuesto:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Crea (si no existe) el cronograma operativo pendiente del puesto. Idempotente:
 * SOLO puede haber UN cronograma por puesto. Devuelve `yaExistia` si ya lo tenía.
 */
export async function crearCronogramaParaPuesto(puestoId: string) {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: puesto } = await supabase
      .from("puestos")
      .select("nombre, departamentos(nombre)")
      .eq("id", puestoId)
      .maybeSingle();
    if (!puesto) return { ok: false, error: "Puesto no encontrado" };
    const rol = (puesto.nombre as string).trim();

    const { data: existe } = await supabase
      .from("cronogramas_operativos")
      .select("id")
      .eq("puesto_id", puestoId)
      .limit(1)
      .maybeSingle();
    if (existe?.id) return { ok: true, yaExistia: true, rol };

    const deptNombre = (puesto.departamentos as { nombre?: string } | null)?.nombre ?? "";
    const { error } = await supabase.from("cronogramas_operativos").insert({
      empresa_id: empresaId,
      puesto_id: puestoId,
      rol,
      departamento: deptNombre,
      tarea: "Añadir misión de " + rol,
      frecuencia: "OTRO",
      tiempo_requerido: "",
      id_visible: "1",
      orden: 1,
      parent_id: null,
    });
    if (error) throw error;

    revalidatePath("/direccion/cronogramas");
    return { ok: true, yaExistia: false, rol };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[rrhh] crearCronogramaParaPuesto:", msg);
    return { ok: false, error: msg };
  }
}

/** Puestos de la empresa para el desplegable de "Nuevo cronograma". */
export async function listPuestosParaCronograma(): Promise<{
  ok: boolean;
  data: Array<{ id: string; nombre: string; departamento: string; tieneCronograma: boolean }>;
}> {
  try {
    const { supabase, empresaId } = await getContext();
    if (!empresaId) return { ok: false, data: [] };
    const [puestosRes, cronosRes] = await Promise.all([
      supabase.from("puestos").select("id, nombre, departamentos(nombre)").eq("empresa_id", empresaId).order("nombre"),
      supabase.from("cronogramas_operativos").select("puesto_id").eq("empresa_id", empresaId).not("puesto_id", "is", null),
    ]);
    const conCrono = new Set((cronosRes.data ?? []).map((c) => (c as { puesto_id: string }).puesto_id));
    const data = (puestosRes.data ?? []).map((p) => ({
      id: p.id as string,
      nombre: p.nombre as string,
      departamento: ((p as { departamentos?: { nombre?: string } | null }).departamentos)?.nombre ?? "",
      tieneCronograma: conCrono.has(p.id as string),
    }));
    return { ok: true, data };
  } catch (err) {
    console.error("[rrhh] listPuestosParaCronograma:", err);
    return { ok: false, data: [] };
  }
}
