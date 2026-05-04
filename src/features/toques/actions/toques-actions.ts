"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

function errorMessage(err: unknown): string {
  if (!err) return "Error desconocido";
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    return [e.message, e.details, e.hint].filter(Boolean).join(" — ") || "Error desconocido";
  }
  return String(err);
}

async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null, nombre: "", isAdmin: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("empresa_id, full_name, nombre")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const adminRoles = new Set(["admin", "director", "gerencia", "responsable"]);
  const isAdmin = (roles ?? []).some((r: { role: string }) => adminRoles.has(r.role));
  const nombre =
    (profile?.full_name as string) || (profile?.nombre as string) || user.email || "";
  return {
    supabase,
    user,
    empresaId: (profile?.empresa_id as string) ?? null,
    nombre,
    isAdmin,
  };
}

// ─── Canjear recompensa (usuario) ─────────────────────────────
const CanjearSchema = z.object({
  recompensaId: z.string().uuid(),
  notas: z.string().max(500).optional().default(""),
});

export async function canjearRecompensa(
  input: z.infer<typeof CanjearSchema>
): Promise<ActionResult<{ canjeId: string }>> {
  const parsed = CanjearSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input inválido" };

  try {
    const { user, empresaId, nombre } = await getSession();
    if (!user || !empresaId) return { ok: false, error: "Sesión inválida" };

    const admin = createAdminClient();

    // Cargar recompensa
    const { data: recRow, error: errR } = await admin
      .from("toques_recompensas")
      .select("id, empresa_id, nombre, coste_toques, activa, tipo")
      .eq("id", parsed.data.recompensaId)
      .maybeSingle();
    if (errR || !recRow) {
      return { ok: false, error: "Recompensa no encontrada" };
    }
    if (recRow.empresa_id !== empresaId) {
      return { ok: false, error: "Recompensa de otra empresa" };
    }
    if (!recRow.activa) {
      return { ok: false, error: "Recompensa no disponible" };
    }
    if (recRow.tipo === "regalo_anual_descriptivo" || recRow.coste_toques <= 0) {
      return { ok: false, error: "Esta recompensa solo puede otorgarla RRHH al Empleado del Año" };
    }

    // Verificar saldo: suma de movimientos - reservado en pendientes
    const { data: balData } = await admin
      .from("toques_balance")
      .select("toques_canjeables")
      .eq("user_id", user.id)
      .maybeSingle();
    const canjeables = Number(balData?.toques_canjeables ?? 0);

    const { data: pendData } = await admin
      .from("toques_canjes")
      .select("coste_toques")
      .eq("user_id", user.id)
      .eq("estado", "pendiente");
    const reservado = ((pendData ?? []) as Array<{ coste_toques: number }>).reduce(
      (acc, r) => acc + Number(r.coste_toques ?? 0),
      0
    );

    const disponible = Math.max(0, canjeables - reservado);
    if (disponible < recRow.coste_toques) {
      return {
        ok: false,
        error: `Saldo insuficiente. Tienes ${disponible} points disponibles y necesitas ${recRow.coste_toques}.`,
      };
    }

    const { data: ins, error: errI } = await admin
      .from("toques_canjes")
      .insert({
        empresa_id: empresaId,
        user_id: user.id,
        empleado_nombre: nombre,
        recompensa_id: recRow.id,
        recompensa_nombre: recRow.nombre,
        coste_toques: recRow.coste_toques,
        estado: "pendiente",
        notas_solicitud: parsed.data.notas ?? "",
      })
      .select("id")
      .single();

    if (errI || !ins) {
      console.error("[toques_canjes:insert]", errI);
      return { ok: false, error: errorMessage(errI) };
    }

    revalidatePath("/mi-panel/points");
    return { ok: true, data: { canjeId: ins.id as string } };
  } catch (e) {
    console.error("[canjearRecompensa]", e);
    return { ok: false, error: errorMessage(e) };
  }
}

// ─── Aprobar canje (admin) ────────────────────────────────────
const AprobarSchema = z.object({
  canjeId: z.string().uuid(),
  fechaDisfrute: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notas: z.string().max(500).optional().default(""),
});

export async function aprobarCanje(
  input: z.infer<typeof AprobarSchema>
): Promise<ActionResult> {
  const parsed = AprobarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input inválido" };

  try {
    const { user, empresaId, nombre, isAdmin } = await getSession();
    if (!user || !empresaId) return { ok: false, error: "Sesión inválida" };
    if (!isAdmin) return { ok: false, error: "No tienes permisos para aprobar canjes" };

    const admin = createAdminClient();

    const { data: canje, error: errC } = await admin
      .from("toques_canjes")
      .select("id, empresa_id, user_id, empleado_nombre, recompensa_id, recompensa_nombre, coste_toques, estado")
      .eq("id", parsed.data.canjeId)
      .maybeSingle();
    if (errC || !canje) return { ok: false, error: "Canje no encontrado" };
    if (canje.empresa_id !== empresaId) return { ok: false, error: "Canje de otra empresa" };
    if (canje.estado !== "pendiente") return { ok: false, error: `El canje ya está ${canje.estado}` };

    // Revalidar saldo en el momento de la aprobación
    const { data: balData } = await admin
      .from("toques_balance")
      .select("toques_canjeables")
      .eq("user_id", canje.user_id)
      .maybeSingle();
    const canjeables = Number(balData?.toques_canjeables ?? 0);
    if (canjeables < canje.coste_toques) {
      return {
        ok: false,
        error: `El empleado no tiene saldo suficiente (${canjeables}/${canje.coste_toques}). No se puede aprobar.`,
      };
    }

    // Aprobar canje
    const { error: errU } = await admin
      .from("toques_canjes")
      .update({
        estado: "aprobada",
        resuelto_at: new Date().toISOString(),
        resuelto_por: user.id,
        fecha_disfrute: parsed.data.fechaDisfrute ?? null,
        notas_revision: parsed.data.notas ?? "",
      })
      .eq("id", canje.id);
    if (errU) {
      console.error("[toques_canjes:update_aprobar]", errU);
      return { ok: false, error: errorMessage(errU) };
    }

    // Insertar movimiento negativo (descuenta saldo)
    const { error: errM } = await admin.from("toques_movimientos").insert({
      empresa_id: canje.empresa_id,
      user_id: canje.user_id,
      empleado_nombre: canje.empleado_nombre,
      toques: -canje.coste_toques,
      origen: "canje",
      recompensa_id: canje.recompensa_id,
      canje_id: canje.id,
      fecha: new Date().toISOString().slice(0, 10),
      motivo: `Canje aprobado: ${canje.recompensa_nombre}`,
      contexto: { aprobado_por: nombre, fecha_disfrute: parsed.data.fechaDisfrute ?? null },
      otorgado_por: user.id,
    });
    if (errM) {
      console.error("[toques_movimientos:insert_canje]", errM);
      return { ok: false, error: errorMessage(errM) };
    }

    revalidatePath("/mi-panel/points");
    revalidatePath("/rrhh/points");
    return { ok: true, data: null };
  } catch (e) {
    console.error("[aprobarCanje]", e);
    return { ok: false, error: errorMessage(e) };
  }
}

// ─── Rechazar canje (admin) ───────────────────────────────────
const RechazarSchema = z.object({
  canjeId: z.string().uuid(),
  motivo: z.string().min(1).max(500),
});

export async function rechazarCanje(
  input: z.infer<typeof RechazarSchema>
): Promise<ActionResult> {
  const parsed = RechazarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Motivo requerido" };

  try {
    const { user, empresaId, isAdmin } = await getSession();
    if (!user || !empresaId) return { ok: false, error: "Sesión inválida" };
    if (!isAdmin) return { ok: false, error: "No tienes permisos para rechazar canjes" };

    const admin = createAdminClient();

    const { data: canje, error: errC } = await admin
      .from("toques_canjes")
      .select("id, empresa_id, estado")
      .eq("id", parsed.data.canjeId)
      .maybeSingle();
    if (errC || !canje) return { ok: false, error: "Canje no encontrado" };
    if (canje.empresa_id !== empresaId) return { ok: false, error: "Canje de otra empresa" };
    if (canje.estado !== "pendiente") return { ok: false, error: `El canje ya está ${canje.estado}` };

    const { error: errU } = await admin
      .from("toques_canjes")
      .update({
        estado: "rechazada",
        resuelto_at: new Date().toISOString(),
        resuelto_por: user.id,
        notas_revision: parsed.data.motivo,
      })
      .eq("id", canje.id);
    if (errU) {
      console.error("[toques_canjes:update_rechazar]", errU);
      return { ok: false, error: errorMessage(errU) };
    }

    revalidatePath("/mi-panel/points");
    revalidatePath("/rrhh/points");
    return { ok: true, data: null };
  } catch (e) {
    console.error("[rechazarCanje]", e);
    return { ok: false, error: errorMessage(e) };
  }
}

// ─── Marcar canje como disfrutado (admin) ─────────────────────
const DisfrutarSchema = z.object({ canjeId: z.string().uuid() });

export async function marcarCanjeDisfrutado(
  input: z.infer<typeof DisfrutarSchema>
): Promise<ActionResult> {
  const parsed = DisfrutarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Input inválido" };

  try {
    const { user, empresaId, isAdmin } = await getSession();
    if (!user || !empresaId) return { ok: false, error: "Sesión inválida" };
    if (!isAdmin) return { ok: false, error: "No tienes permisos" };

    const admin = createAdminClient();
    const { data: canje, error: errC } = await admin
      .from("toques_canjes")
      .select("id, empresa_id, estado")
      .eq("id", parsed.data.canjeId)
      .maybeSingle();
    if (errC || !canje) return { ok: false, error: "Canje no encontrado" };
    if (canje.empresa_id !== empresaId) return { ok: false, error: "Canje de otra empresa" };
    if (canje.estado !== "aprobada") return { ok: false, error: "Solo canjes aprobados pueden marcarse como disfrutados" };

    const { error: errU } = await admin
      .from("toques_canjes")
      .update({ estado: "disfrutada" })
      .eq("id", canje.id);
    if (errU) return { ok: false, error: errorMessage(errU) };

    revalidatePath("/mi-panel/points");
    revalidatePath("/rrhh/points");
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// ─── Otorgar toque manual (admin) ─────────────────────────────
const OtorgarManualSchema = z.object({
  userId: z.string().uuid(),
  toques: z.number().int(),
  motivo: z.string().min(1).max(500),
});

export async function otorgarToqueManual(
  input: z.infer<typeof OtorgarManualSchema>
): Promise<ActionResult> {
  const parsed = OtorgarManualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Input inválido" };

  try {
    const { user, empresaId, nombre, isAdmin } = await getSession();
    if (!user || !empresaId) return { ok: false, error: "Sesión inválida" };
    if (!isAdmin) return { ok: false, error: "No tienes permisos" };
    if (parsed.data.toques === 0) return { ok: false, error: "Toques no puede ser 0" };

    const admin = createAdminClient();

    // Verificar que el destinatario es de la misma empresa
    const { data: dest, error: errD } = await admin
      .from("profiles")
      .select("user_id, empresa_id, full_name, nombre")
      .eq("user_id", parsed.data.userId)
      .maybeSingle();
    if (errD || !dest) return { ok: false, error: "Usuario destinatario no encontrado" };
    if (dest.empresa_id !== empresaId) return { ok: false, error: "Destinatario de otra empresa" };

    const empleadoNombre = (dest.full_name as string) || (dest.nombre as string) || "";

    const { error: errM } = await admin.from("toques_movimientos").insert({
      empresa_id: empresaId,
      user_id: parsed.data.userId,
      empleado_nombre: empleadoNombre,
      toques: parsed.data.toques,
      origen: "manual",
      fecha: new Date().toISOString().slice(0, 10),
      motivo: parsed.data.motivo,
      contexto: { otorgado_por_nombre: nombre },
      otorgado_por: user.id,
    });
    if (errM) {
      console.error("[toques_movimientos:insert_manual]", errM);
      return { ok: false, error: errorMessage(errM) };
    }

    revalidatePath("/mi-panel/points");
    revalidatePath("/rrhh/points");
    return { ok: true, data: null };
  } catch (e) {
    console.error("[otorgarToqueManual]", e);
    return { ok: false, error: errorMessage(e) };
  }
}
