"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type {
  Bonus,
  EstadoBonus,
  PeriodicidadBonus,
  TipoDestinatario,
  TablaTramos,
  ReglaBonus,
} from "@/features/rrhh/data/bonus";

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

// Fila de la tabla rrhh_bonus (+ vínculo de puestos por LEFT JOIN).
type BonusRow = {
  id: string;
  empresa_id: string;
  nombre: string | null;
  tipo: string | null;
  descripcion: string | null;
  objetivo: string | null;
  explicacion: string | null;
  estado: EstadoBonus | null;
  periodicidad: PeriodicidadBonus | null;
  destinatarios_texto: string | null;
  destinatarios: { tipo: TipoDestinatario; ids: string[] } | null;
  tablas: TablaTramos[] | null;
  reglas: ReglaBonus[] | null;
  forma_pago: string | null;
  premio: string | null;
  icono: string | null;
  rrhh_bonus_puestos: { puesto_id: string }[] | null;
};

function rowToBonus(r: BonusRow): Bonus {
  return {
    id: r.id,
    empresaId: r.empresa_id,
    nombre: r.nombre ?? "",
    tipo: r.tipo ?? "",
    descripcion: r.descripcion ?? "",
    objetivo: r.objetivo ?? "",
    explicacion: r.explicacion ?? "",
    estado: r.estado ?? "borrador",
    periodicidad: r.periodicidad ?? "trimestral",
    destinatarios: r.destinatarios ?? { tipo: "todos", ids: [] },
    destinatariosTexto: r.destinatarios_texto ?? "",
    tablas: r.tablas ?? [],
    reglas: r.reglas ?? [],
    formaPago: r.forma_pago ?? "",
    premio: r.premio ?? "",
    icono: r.icono ?? "Gift",
    puestoIds: (r.rrhh_bonus_puestos ?? []).map((p) => p.puesto_id),
  };
}

const SELECT =
  "id, empresa_id, nombre, tipo, descripcion, objetivo, explicacion, estado, periodicidad, destinatarios_texto, destinatarios, tablas, reglas, forma_pago, premio, icono, rrhh_bonus_puestos(puesto_id)";

/** Todos los bonus de la empresa activa, con los puestos a los que aplican. */
export async function listBonusEmpresa(): Promise<Bonus[]> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("rrhh_bonus")
    .select(SELECT)
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as unknown as BonusRow[]).map(rowToBonus);
}

/** Bonus que aplican a un puesto concreto (vista desde el puesto). */
export async function listBonusDePuesto(puestoId: string): Promise<Bonus[]> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return [];
  const { data, error } = await supabase
    .from("rrhh_bonus")
    .select(SELECT)
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as unknown as BonusRow[])
    .map(rowToBonus)
    .filter((b) => b.puestoIds.includes(puestoId));
}

type BonusInput = Partial<
  Pick<
    Bonus,
    | "nombre"
    | "tipo"
    | "descripcion"
    | "objetivo"
    | "explicacion"
    | "estado"
    | "periodicidad"
    | "destinatarios"
    | "destinatariosTexto"
    | "tablas"
    | "reglas"
    | "formaPago"
    | "premio"
    | "icono"
    | "puestoIds"
  >
>;

function toDbFields(input: BonusInput): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (input.nombre !== undefined) f.nombre = input.nombre;
  if (input.tipo !== undefined) f.tipo = input.tipo;
  if (input.descripcion !== undefined) f.descripcion = input.descripcion;
  if (input.objetivo !== undefined) f.objetivo = input.objetivo;
  if (input.explicacion !== undefined) f.explicacion = input.explicacion;
  if (input.estado !== undefined) f.estado = input.estado;
  if (input.periodicidad !== undefined) f.periodicidad = input.periodicidad;
  if (input.destinatarios !== undefined) f.destinatarios = input.destinatarios;
  if (input.destinatariosTexto !== undefined) f.destinatarios_texto = input.destinatariosTexto;
  if (input.tablas !== undefined) f.tablas = input.tablas;
  if (input.reglas !== undefined) f.reglas = input.reglas;
  if (input.formaPago !== undefined) f.forma_pago = input.formaPago;
  if (input.premio !== undefined) f.premio = input.premio;
  if (input.icono !== undefined) f.icono = input.icono;
  return f;
}

/** Reescribe el vínculo bonus↔puestos (fuente única). Valida que los puestos sean de la empresa. */
async function syncPuestos(
  supabase: SupabaseClient,
  empresaId: string,
  bonusId: string,
  puestoIds: string[],
): Promise<void> {
  // Solo puestos que pertenecen a la empresa (evita ligar puestos ajenos).
  const { data: validos } = await supabase
    .from("puestos")
    .select("id")
    .eq("empresa_id", empresaId)
    .in("id", puestoIds.length ? puestoIds : ["00000000-0000-0000-0000-000000000000"]);
  const ids = new Set((validos ?? []).map((p: { id: string }) => p.id));
  const filtrados = puestoIds.filter((id) => ids.has(id));

  await supabase.from("rrhh_bonus_puestos").delete().eq("bonus_id", bonusId);
  if (filtrados.length) {
    await supabase
      .from("rrhh_bonus_puestos")
      .insert(filtrados.map((puesto_id) => ({ bonus_id: bonusId, puesto_id })));
  }
}

/** Crea un bonus (opcionalmente con puestos ya vinculados). Devuelve el bonus completo. */
export async function crearBonus(
  input: BonusInput = {},
): Promise<{ ok: boolean; bonus?: Bonus; error?: string }> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };
  const { data, error } = await supabase
    .from("rrhh_bonus")
    .insert({ empresa_id: empresaId, ...toDbFields(input) })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear" };
  if (input.puestoIds !== undefined) {
    await syncPuestos(supabase as unknown as SupabaseClient, empresaId, data.id, input.puestoIds);
  }
  revalidatePath("/rrhh/bonus");
  revalidatePath("/rrhh/puestos");
  const bonus = (await listBonusEmpresa()).find((b) => b.id === data.id);
  return { ok: true, bonus };
}

/** Actualiza un bonus y (si se pasa puestoIds) reescribe su vínculo con puestos. */
export async function actualizarBonus(
  bonusId: string,
  input: BonusInput,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };
  const campos = toDbFields(input);
  if (Object.keys(campos).length > 0) {
    const { error } = await supabase
      .from("rrhh_bonus")
      .update(campos)
      .eq("id", bonusId)
      .eq("empresa_id", empresaId);
    if (error) return { ok: false, error: error.message };
  }
  if (input.puestoIds !== undefined) {
    await syncPuestos(supabase as unknown as SupabaseClient, empresaId, bonusId, input.puestoIds);
  }
  revalidatePath("/rrhh/bonus");
  revalidatePath("/rrhh/puestos");
  return { ok: true };
}

/** Reescribe solo el vínculo bonus↔puestos (usado desde la ficha del puesto o del bonus). */
export async function setBonusPuestos(
  bonusId: string,
  puestoIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };
  // Verifica que el bonus es de la empresa.
  const { data: b } = await supabase
    .from("rrhh_bonus")
    .select("id")
    .eq("id", bonusId)
    .eq("empresa_id", empresaId)
    .single();
  if (!b) return { ok: false, error: "Bonus no encontrado" };
  await syncPuestos(supabase as unknown as SupabaseClient, empresaId, bonusId, puestoIds);
  revalidatePath("/rrhh/bonus");
  revalidatePath("/rrhh/puestos");
  return { ok: true };
}

/** Vincula/desvincula UN puesto a UN bonus (toggle desde la ficha del puesto). */
export async function togglePuestoBonus(
  puestoId: string,
  bonusId: string,
  activar: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };
  // Validar pertenencia de ambos a la empresa.
  const [{ data: bonus }, { data: puesto }] = await Promise.all([
    supabase.from("rrhh_bonus").select("id").eq("id", bonusId).eq("empresa_id", empresaId).single(),
    supabase.from("puestos").select("id").eq("id", puestoId).eq("empresa_id", empresaId).single(),
  ]);
  if (!bonus || !puesto) return { ok: false, error: "Bonus o puesto no válido" };
  if (activar) {
    await supabase
      .from("rrhh_bonus_puestos")
      .upsert({ bonus_id: bonusId, puesto_id: puestoId }, { onConflict: "bonus_id,puesto_id" });
  } else {
    await supabase
      .from("rrhh_bonus_puestos")
      .delete()
      .eq("bonus_id", bonusId)
      .eq("puesto_id", puestoId);
  }
  revalidatePath("/rrhh/bonus");
  revalidatePath("/rrhh/puestos");
  return { ok: true };
}

/** Elimina un bonus (la tabla puente cae por ON DELETE CASCADE). */
export async function eliminarBonus(
  bonusId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, empresaId } = await getContext();
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };
  const { error } = await supabase
    .from("rrhh_bonus")
    .delete()
    .eq("id", bonusId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/rrhh/bonus");
  revalidatePath("/rrhh/puestos");
  return { ok: true };
}
