"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

function errMsg(err: unknown): string {
  if (!err) return "Error";
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const e = err as { message?: string; details?: string };
    return [e.message, e.details].filter(Boolean).join(" — ") || "Error";
  }
  return String(err);
}

async function getAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, empresaId: null, isAdmin: false };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const adminRoles = new Set(["admin", "director", "gerencia", "responsable"]);
  const isAdmin = (roles ?? []).some((r: { role: string }) => adminRoles.has(r.role));
  return { user, empresaId, isAdmin };
}

function revalidate() {
  revalidatePath("/ajustes");
  revalidatePath("/mi-panel/points");
  revalidatePath("/rrhh/points");
}

// ─── REGLAS ──────────────────────────────────────────────────
const ReglaUpdateSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1).max(120).optional(),
  descripcion: z.string().max(500).optional(),
  toques: z.number().int().min(0).max(1000).optional(),
  periodicidad: z.enum(["diario", "semanal", "trimestral"]).optional(),
  activa: z.boolean().optional(),
});

export async function actualizarRegla(input: z.infer<typeof ReglaUpdateSchema>): Promise<ActionResult> {
  const parsed = ReglaUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  try {
    const { user, empresaId, isAdmin } = await getAdminSession();
    if (!user || !empresaId || !isAdmin) return { ok: false, error: "Sin permisos" };
    const admin = createAdminClient();
    const patch: Record<string, unknown> = {};
    if (parsed.data.nombre !== undefined) patch.nombre = parsed.data.nombre;
    if (parsed.data.descripcion !== undefined) patch.descripcion = parsed.data.descripcion;
    if (parsed.data.toques !== undefined) patch.toques = parsed.data.toques;
    if (parsed.data.periodicidad !== undefined) patch.periodicidad = parsed.data.periodicidad;
    if (parsed.data.activa !== undefined) patch.activa = parsed.data.activa;
    const { error } = await admin
      .from("toques_reglas")
      .update(patch)
      .eq("id", parsed.data.id)
      .eq("empresa_id", empresaId);
    if (error) {
      console.error("[toques_reglas:update]", error);
      return { ok: false, error: errMsg(error) };
    }
    revalidate();
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

// ─── RECOMPENSAS ─────────────────────────────────────────────
const RecompensaCreateSchema = z.object({
  nombre: z.string().min(1).max(120),
  descripcion: z.string().max(500).default(""),
  costeToques: z.number().int().min(0).max(100000),
  tipo: z.enum([
    "hora_libre",
    "dia_vacaciones",
    "fin_semana",
    "semana_vacaciones",
    "regalo_anual_descriptivo",
    "custom",
  ]),
  orden: z.number().int().default(0),
});

export async function crearRecompensa(input: z.infer<typeof RecompensaCreateSchema>): Promise<ActionResult> {
  const parsed = RecompensaCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  try {
    const { user, empresaId, isAdmin } = await getAdminSession();
    if (!user || !empresaId || !isAdmin) return { ok: false, error: "Sin permisos" };
    const admin = createAdminClient();
    const { error } = await admin.from("toques_recompensas").insert({
      empresa_id: empresaId,
      nombre: parsed.data.nombre,
      descripcion: parsed.data.descripcion,
      coste_toques: parsed.data.costeToques,
      tipo: parsed.data.tipo,
      orden: parsed.data.orden,
      activa: true,
    });
    if (error) {
      console.error("[toques_recompensas:insert]", error);
      return { ok: false, error: errMsg(error) };
    }
    revalidate();
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const RecompensaUpdateSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1).max(120).optional(),
  descripcion: z.string().max(500).optional(),
  costeToques: z.number().int().min(0).max(100000).optional(),
  tipo: z
    .enum([
      "hora_libre",
      "dia_vacaciones",
      "fin_semana",
      "semana_vacaciones",
      "regalo_anual_descriptivo",
      "custom",
    ])
    .optional(),
  orden: z.number().int().optional(),
  activa: z.boolean().optional(),
});

export async function actualizarRecompensa(input: z.infer<typeof RecompensaUpdateSchema>): Promise<ActionResult> {
  const parsed = RecompensaUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  try {
    const { user, empresaId, isAdmin } = await getAdminSession();
    if (!user || !empresaId || !isAdmin) return { ok: false, error: "Sin permisos" };
    const admin = createAdminClient();
    const patch: Record<string, unknown> = {};
    if (parsed.data.nombre !== undefined) patch.nombre = parsed.data.nombre;
    if (parsed.data.descripcion !== undefined) patch.descripcion = parsed.data.descripcion;
    if (parsed.data.costeToques !== undefined) patch.coste_toques = parsed.data.costeToques;
    if (parsed.data.tipo !== undefined) patch.tipo = parsed.data.tipo;
    if (parsed.data.orden !== undefined) patch.orden = parsed.data.orden;
    if (parsed.data.activa !== undefined) patch.activa = parsed.data.activa;
    const { error } = await admin
      .from("toques_recompensas")
      .update(patch)
      .eq("id", parsed.data.id)
      .eq("empresa_id", empresaId);
    if (error) return { ok: false, error: errMsg(error) };
    revalidate();
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

const RecompensaDeleteSchema = z.object({ id: z.string().uuid() });

export async function eliminarRecompensa(input: z.infer<typeof RecompensaDeleteSchema>): Promise<ActionResult> {
  const parsed = RecompensaDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Input inválido" };
  try {
    const { user, empresaId, isAdmin } = await getAdminSession();
    if (!user || !empresaId || !isAdmin) return { ok: false, error: "Sin permisos" };
    const admin = createAdminClient();
    const { error } = await admin
      .from("toques_recompensas")
      .delete()
      .eq("id", parsed.data.id)
      .eq("empresa_id", empresaId);
    if (error) {
      // Si está referenciada por canjes (FK restrict), forzamos desactivar en su lugar
      if (error.code === "23503") {
        const { error: e2 } = await admin
          .from("toques_recompensas")
          .update({ activa: false })
          .eq("id", parsed.data.id)
          .eq("empresa_id", empresaId);
        if (e2) return { ok: false, error: errMsg(e2) };
        revalidate();
        return { ok: true, data: null };
      }
      return { ok: false, error: errMsg(error) };
    }
    revalidate();
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

// ─── FECHA DE ALTA (antigüedad) ──────────────────────────────
const FechaAltaSchema = z.object({
  userId: z.string().uuid(),
  fechaAlta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function actualizarFechaAlta(
  input: z.infer<typeof FechaAltaSchema>
): Promise<ActionResult> {
  const parsed = FechaAltaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  try {
    const { user, empresaId, isAdmin } = await getAdminSession();
    if (!user || !empresaId || !isAdmin) return { ok: false, error: "Sin permisos" };

    // Validar que no sea futura
    if (parsed.data.fechaAlta > new Date().toISOString().slice(0, 10)) {
      return { ok: false, error: "La fecha de alta no puede ser futura" };
    }

    const admin = createAdminClient();

    // Verificar que el destinatario pertenece a la misma empresa
    const { data: dest, error: errD } = await admin
      .from("profiles")
      .select("user_id, empresa_id")
      .eq("user_id", parsed.data.userId)
      .maybeSingle();
    if (errD || !dest) return { ok: false, error: "Empleado no encontrado" };
    if (dest.empresa_id !== empresaId) return { ok: false, error: "Empleado de otra empresa" };

    const { error } = await admin
      .from("profiles")
      .update({ fecha_alta: parsed.data.fechaAlta })
      .eq("user_id", parsed.data.userId);
    if (error) {
      console.error("[profiles:update_fecha_alta]", error);
      return { ok: false, error: errMsg(error) };
    }
    revalidate();
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

// ─── NIVELES ─────────────────────────────────────────────────
const NivelUpdateSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1).max(60).optional(),
  toquesMin: z.number().int().min(0).max(1000000).optional(),
  badgeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  badgeIcon: z.string().max(60).nullable().optional(),
});

export async function actualizarNivel(input: z.infer<typeof NivelUpdateSchema>): Promise<ActionResult> {
  const parsed = NivelUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input inválido" };
  try {
    const { user, empresaId, isAdmin } = await getAdminSession();
    if (!user || !empresaId || !isAdmin) return { ok: false, error: "Sin permisos" };
    const admin = createAdminClient();
    const patch: Record<string, unknown> = {};
    if (parsed.data.nombre !== undefined) patch.nombre = parsed.data.nombre;
    if (parsed.data.toquesMin !== undefined) patch.toques_min = parsed.data.toquesMin;
    if (parsed.data.badgeColor !== undefined) patch.badge_color = parsed.data.badgeColor;
    if (parsed.data.badgeIcon !== undefined) patch.badge_icon = parsed.data.badgeIcon;
    const { error } = await admin
      .from("toques_niveles")
      .update(patch)
      .eq("id", parsed.data.id)
      .eq("empresa_id", empresaId);
    if (error) return { ok: false, error: errMsg(error) };
    revalidate();
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
