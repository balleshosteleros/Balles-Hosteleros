"use server";

/**
 * PRP-054 · Fase 1 — Server actions de llamadas internas.
 *
 * - Mutaciones (create/updateEstado) usan el cliente con sesión del usuario:
 *   la RLS de `llamadas_internas` garantiza auth.uid() = caller/callee y empresa
 *   dentro de empresas_del_usuario() (defensa real, no de adorno).
 * - El directorio de llamables usa admin client para resolver el espejo
 *   multi-empresa (profiles ∪ user_empresas), pero NO exige admin: cualquier
 *   empleado puede llamar a sus compañeros. Se verifica que el solicitante
 *   pertenece a la empresa activa antes de leer el roster.
 */

import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/features/mi-panel/mobile/lib/push-server";
import type {
  EmpleadoLlamable,
  LlamadaEstado,
  LlamadaHistorialItem,
  LlamadaInterna,
} from "@/features/llamadas-internas/types";
import { ESTADOS_TERMINALES } from "@/features/llamadas-internas/types";

type Row = Record<string, unknown>;

function rowToLlamada(r: Row): LlamadaInterna {
  return {
    id: r.id as string,
    empresaId: r.empresa_id as string,
    callerId: r.caller_id as string,
    calleeId: r.callee_id as string,
    tipo: (r.tipo as LlamadaInterna["tipo"]) ?? "voz",
    estado: (r.estado as LlamadaEstado) ?? "iniciando",
    duracionSeg: (r.duracion_seg as number) ?? 0,
    iniciadaAt: r.iniciada_at as string,
    conectadaAt: (r.conectada_at as string | null) ?? null,
    finalizadaAt: (r.finalizada_at as string | null) ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear llamada (la inicia el caller)
// ─────────────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  calleeId: z.string().uuid(),
  tipo: z.enum(["voz", "video"]).default("voz"),
});

export async function createLlamada(
  input: z.input<typeof createSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos de llamada no válidos" };

    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: false, error: "No autenticado" };
    if (parsed.data.calleeId === userId)
      return { ok: false, error: "No puedes llamarte a ti mismo" };

    const { data, error } = await supabase
      .from("llamadas_internas")
      .insert({
        empresa_id: empresaId,
        caller_id: userId,
        callee_id: parsed.data.calleeId,
        tipo: parsed.data.tipo,
        estado: "iniciando",
      })
      .select("id")
      .single();

    if (error) throw error;
    const callId = data.id as string;

    // Push al destinatario: hace que la llamada "entre" aunque tenga la app
    // cerrada o el móvil bloqueado (suena/vibra; al tocar abre la llamada).
    try {
      const { data: caller } = await supabase
        .from("usuarios")
        .select("nombre, apellidos")
        .eq("user_id", userId)
        .maybeSingle();
      const nombreCaller =
        `${caller?.nombre ?? ""} ${caller?.apellidos ?? ""}`.trim() || "Un compañero";
      await sendPushToUser({
        userId: parsed.data.calleeId,
        empresaId,
        eventType: "llamada_entrante",
        payload: {
          title: "Llamada entrante",
          body: `${nombreCaller} te está llamando`,
          url: "/m/llamar",
          tag: `llamada-${callId}`,
          requireInteraction: true,
          renotify: true,
          vibrate: [400, 200, 400, 200, 400],
          data: { url: "/m/llamar", callId },
        },
      });
    } catch (pushErr) {
      // El push es un respaldo: si falla, la señalización Realtime sigue valiendo.
      console.error("[llamadas] push llamada_entrante:", pushErr);
    }

    return { ok: true, id: callId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[llamadas] createLlamada:", msg);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar estado (cualquier participante)
// ─────────────────────────────────────────────────────────────────────────────

const updateSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum([
    "iniciando",
    "sonando",
    "conectada",
    "finalizada",
    "rechazada",
    "perdida",
    "cancelada",
    "ocupado",
  ]),
  duracionSeg: z.number().int().min(0).optional(),
});

export async function updateEstadoLlamada(
  input: z.input<typeof updateSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos de estado no válidos" };

    const { supabase, userId } = await getAppContext();
    if (!userId) return { ok: false, error: "No autenticado" };

    const { estado, duracionSeg } = parsed.data;
    const patch: Record<string, unknown> = { estado };
    if (estado === "conectada") patch.conectada_at = new Date().toISOString();
    if (ESTADOS_TERMINALES.includes(estado)) {
      patch.finalizada_at = new Date().toISOString();
      if (typeof duracionSeg === "number") patch.duracion_seg = duracionSeg;
    }

    const { error } = await supabase
      .from("llamadas_internas")
      .update(patch)
      .eq("id", parsed.data.id);

    if (error) throw error;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[llamadas] updateEstadoLlamada:", msg);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Historial (RLS limita a llamadas en las que el usuario participa)
// ─────────────────────────────────────────────────────────────────────────────

export async function listHistorialLlamadas(
  limit = 50,
): Promise<{ ok: boolean; data: LlamadaHistorialItem[]; error?: string }> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: false, data: [], error: "No autenticado" };

    const { data, error } = await supabase
      .from("llamadas_internas")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("iniciada_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));
    if (error) throw error;

    const rows = (data ?? []).map(rowToLlamada);

    // Enriquecer con la contraparte (mismo empresa → profiles legible por RLS).
    const contraparteIds = Array.from(
      new Set(rows.map((l) => (l.callerId === userId ? l.calleeId : l.callerId))),
    );
    const nombres = new Map<string, { nombre: string; avatar: string | null }>();
    if (contraparteIds.length > 0) {
      const { data: profs } = await supabase
        .from("usuarios")
        .select("user_id, nombre, apellidos, avatar_url")
        .in("user_id", contraparteIds);
      for (const p of (profs ?? []) as Row[]) {
        const nombre = `${(p.nombre as string) ?? ""} ${(p.apellidos as string) ?? ""}`.trim();
        nombres.set(p.user_id as string, {
          nombre: nombre || "Empleado",
          avatar: (p.avatar_url as string | null) ?? null,
        });
      }
    }

    const items: LlamadaHistorialItem[] = rows.map((l) => {
      const saliente = l.callerId === userId;
      const contraparteUserId = saliente ? l.calleeId : l.callerId;
      const info = nombres.get(contraparteUserId);
      return {
        ...l,
        direccion: saliente ? "saliente" : "entrante",
        contraparteUserId,
        contraparteNombre: info?.nombre ?? "Empleado",
        contraparteAvatarUrl: info?.avatar ?? null,
      };
    });

    return { ok: true, data: items };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[llamadas] listHistorialLlamadas:", msg);
    return { ok: false, data: [], error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Directorio de empleados llamables de la empresa activa (profiles ∪ user_empresas)
// ─────────────────────────────────────────────────────────────────────────────

export async function listLlamables(): Promise<{
  ok: boolean;
  data: EmpleadoLlamable[];
  error?: string;
}> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId || !empresaId) return { ok: false, data: [], error: "No autenticado" };

    // Verificar que el solicitante pertenece a la empresa activa (lecturas self,
    // permitidas por RLS) antes de resolver el roster con admin.
    const [{ data: selfProf }, { data: selfUE }] = await Promise.all([
      supabase.from("usuarios").select("empresa_id").eq("user_id", userId).maybeSingle(),
      supabase.from("usuario_empresas").select("empresa_id").eq("user_id", userId),
    ]);
    const empresasDelSolicitante = new Set<string>([
      ...(selfProf?.empresa_id ? [selfProf.empresa_id as string] : []),
      ...((selfUE ?? []) as Row[]).map((r) => r.empresa_id as string),
    ]);
    if (!empresasDelSolicitante.has(empresaId))
      return { ok: false, data: [], error: "Sin acceso a la empresa activa" };

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return { ok: false, data: [], error: "Supabase admin no configurado." };
    }

    // Empleados con acceso a la empresa activa: empresa_id propio O user_empresas.
    const { data: accesosUE } = await admin
      .from("usuario_empresas")
      .select("user_id")
      .eq("empresa_id", empresaId);
    const userIdsConAcceso = ((accesosUE ?? []) as Row[]).map((r) => r.user_id as string);

    const filtro =
      userIdsConAcceso.length > 0
        ? `empresa_id.eq.${empresaId},user_id.in.(${userIdsConAcceso.join(",")})`
        : `empresa_id.eq.${empresaId}`;

    const { data, error } = await admin
      .from("empleados")
      .select("id, user_id, nombre, apellidos, avatar_url, puesto, estado, departamentos(nombre)")
      .or(filtro);
    if (error) throw error;

    const vistos = new Set<string>();
    const llamables: EmpleadoLlamable[] = [];
    for (const r of (data ?? []) as Row[]) {
      const uid = r.user_id as string | null;
      if (!uid || uid === userId) continue; // debe tener cuenta y no ser uno mismo
      if (r.estado !== "Activo") continue;
      if (vistos.has(uid)) continue;
      vistos.add(uid);

      const nombre = (r.nombre as string) ?? "";
      const apellidos = (r.apellidos as string | null) ?? null;
      const dep = r.departamentos as { nombre?: string } | null;
      llamables.push({
        userId: uid,
        empleadoId: r.id as string,
        nombre,
        apellidos,
        nombreCompleto: `${nombre} ${apellidos ?? ""}`.trim() || "Empleado",
        avatarUrl: (r.avatar_url as string | null) ?? null,
        puesto: (r.puesto as string | null) ?? null,
        departamento: dep?.nombre ?? null,
      });
    }

    llamables.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto, "es"));
    return { ok: true, data: llamables };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[llamadas] listLlamables:", msg);
    return { ok: false, data: [], error: msg };
  }
}
