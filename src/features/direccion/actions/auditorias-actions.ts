"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type {
  Auditoria,
  AuditoriaPunto,
  AuditoriaValoracion,
  PuntoTipo,
  PuntoSeveridad,
  PuntoEstado,
} from "../data/auditorias";

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };
type Res<T> = Ok<T> | Err;

async function ctx(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createServerClient>>; empresaId: string }
  | Err
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sin sesión" };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  if (!empresaId) return { ok: false, error: "Sin empresa activa" };
  return { ok: true, supabase, empresaId };
}

// ─── Lista de auditorías (cabecera + resumen de puntos) ──────────────────────
export async function listAuditorias(): Promise<Res<Auditoria[]>> {
  try {
    const c = await ctx();
    if (!c.ok) return c;
    const { supabase, empresaId } = c;

    const { data: filas, error } = await supabase
      .from("auditorias")
      .select(
        "id, departamento_id, periodo, valoracion, fecha_reunion, notas_reunion, estado, departamentos(nombre)"
      )
      .eq("empresa_id", empresaId)
      .order("periodo", { ascending: false });
    if (error) return { ok: false, error: error.message };

    const ids = (filas ?? []).map((f) => f.id as string);
    // Resumen de puntos por auditoría (un único query).
    const conteo = new Map<string, { total: number; abiertos: number }>();
    if (ids.length > 0) {
      const { data: puntos } = await supabase
        .from("auditoria_puntos")
        .select("auditoria_id, estado")
        .in("auditoria_id", ids);
      for (const p of puntos ?? []) {
        const k = p.auditoria_id as string;
        const acc = conteo.get(k) ?? { total: 0, abiertos: 0 };
        acc.total += 1;
        if (p.estado !== "resuelto") acc.abiertos += 1;
        conteo.set(k, acc);
      }
    }

    const data: Auditoria[] = (filas ?? []).map((f) => {
      const dep = f.departamentos as { nombre?: string } | { nombre?: string }[] | null;
      const nombre = Array.isArray(dep) ? dep[0]?.nombre : dep?.nombre;
      const r = conteo.get(f.id as string) ?? { total: 0, abiertos: 0 };
      return {
        id: f.id as string,
        departamento_id: f.departamento_id as string,
        departamento_nombre: nombre ?? "—",
        periodo: f.periodo as string,
        valoracion: (f.valoracion ?? null) as AuditoriaValoracion | null,
        fecha_reunion: (f.fecha_reunion ?? null) as string | null,
        notas_reunion: (f.notas_reunion ?? "") as string,
        estado: f.estado as Auditoria["estado"],
        total_puntos: r.total,
        puntos_abiertos: r.abiertos,
      };
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Crear auditoría (depto + mes) ───────────────────────────────────────────
export async function createAuditoria(input: {
  departamentoId: string;
  periodo: string; // 'YYYY-MM'
}): Promise<Res<{ id: string }>> {
  try {
    const c = await ctx();
    if (!c.ok) return c;
    const { supabase, empresaId } = c;

    if (!input.departamentoId) return { ok: false, error: "Falta el departamento" };
    if (!/^\d{4}-\d{2}$/.test(input.periodo)) return { ok: false, error: "Periodo inválido" };

    const { data, error } = await supabase
      .from("auditorias")
      .insert({
        empresa_id: empresaId,
        departamento_id: input.departamentoId,
        periodo: input.periodo,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505")
        return { ok: false, error: "Ya existe una auditoría de ese departamento para ese mes." };
      return { ok: false, error: error.message };
    }
    return { ok: true, data: { id: data.id as string } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Actualizar cabecera (valoración, fecha, notas, estado) ──────────────────
export async function updateAuditoria(
  id: string,
  patch: {
    valoracion?: AuditoriaValoracion | null;
    fecha_reunion?: string | null;
    notas_reunion?: string;
    estado?: "borrador" | "cerrada";
  }
): Promise<Res<null>> {
  try {
    const c = await ctx();
    if (!c.ok) return c;
    const { supabase, empresaId } = c;

    const { error } = await supabase
      .from("auditorias")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteAuditoria(id: string): Promise<Res<null>> {
  try {
    const c = await ctx();
    if (!c.ok) return c;
    const { supabase, empresaId } = c;
    const { error } = await supabase
      .from("auditorias")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Puntos de una auditoría ─────────────────────────────────────────────────
export async function listPuntos(auditoriaId: string): Promise<Res<AuditoriaPunto[]>> {
  try {
    const c = await ctx();
    if (!c.ok) return c;
    const { supabase, empresaId } = c;

    const { data, error } = await supabase
      .from("auditoria_puntos")
      .select("id, auditoria_id, tipo, titulo, descripcion, severidad, estado, responsable, orden")
      .eq("empresa_id", empresaId)
      .eq("auditoria_id", auditoriaId)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as AuditoriaPunto[] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function createPunto(input: {
  auditoriaId: string;
  tipo: PuntoTipo;
  titulo: string;
  descripcion?: string;
  severidad?: PuntoSeveridad;
  estado?: PuntoEstado;
  responsable?: string;
}): Promise<Res<{ id: string }>> {
  try {
    const c = await ctx();
    if (!c.ok) return c;
    const { supabase, empresaId } = c;

    const titulo = input.titulo.trim();
    if (!titulo) return { ok: false, error: "El título es obligatorio" };

    const { data, error } = await supabase
      .from("auditoria_puntos")
      .insert({
        empresa_id: empresaId,
        auditoria_id: input.auditoriaId,
        tipo: input.tipo,
        titulo,
        descripcion: input.descripcion?.trim() ?? "",
        severidad: input.severidad ?? "media",
        estado: input.estado ?? "abierto",
        responsable: input.responsable?.trim() ?? "",
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { id: data.id as string } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updatePunto(
  id: string,
  patch: Partial<{
    tipo: PuntoTipo;
    titulo: string;
    descripcion: string;
    severidad: PuntoSeveridad;
    estado: PuntoEstado;
    responsable: string;
  }>
): Promise<Res<null>> {
  try {
    const c = await ctx();
    if (!c.ok) return c;
    const { supabase, empresaId } = c;
    const { error } = await supabase
      .from("auditoria_puntos")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deletePunto(id: string): Promise<Res<null>> {
  try {
    const c = await ctx();
    if (!c.ok) return c;
    const { supabase, empresaId } = c;
    const { error } = await supabase
      .from("auditoria_puntos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
