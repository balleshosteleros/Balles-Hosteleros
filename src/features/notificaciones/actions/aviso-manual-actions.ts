"use server";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppContext } from "@/lib/supabase/get-context";
import { resolverDestinatarios } from "@/features/notificaciones/lib/targeting";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import type { EmitirResultado } from "@/features/notificaciones/types";

// ── Opciones de segmentación para el panel de aviso manual ──────────
export interface OpcionesSegmento {
  departamentos: { id: string; nombre: string }[];
  roles: string[];
  empleados: { id: string; nombre: string }[];
}

export async function getOpcionesSegmento(): Promise<OpcionesSegmento> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { departamentos: [], roles: [], empleados: [] };
    const [dep, rol, emp] = await Promise.all([
      supabase
        .from("departamentos")
        .select("id, nombre")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .order("nombre", { ascending: true }),
      supabase
        .from("empresa_roles")
        .select("nombre")
        .eq("empresa_id", empresaId)
        .order("nombre", { ascending: true }),
      supabase
        .from("empleados")
        .select("id, nombre, apellidos")
        .eq("empresa_id", empresaId)
        .eq("estado", "Activo")
        .not("user_id", "is", null)
        .order("nombre", { ascending: true }),
    ]);
    return {
      departamentos: (dep.data ?? []).map((d) => ({ id: d.id as string, nombre: (d.nombre as string) ?? "" })),
      roles: Array.from(
        new Set((rol.data ?? []).map((r) => (r.nombre as string) ?? "").filter((n) => n.trim().length > 0)),
      ),
      empleados: (emp.data ?? []).map((e) => ({
        id: e.id as string,
        nombre: `${(e.nombre as string) ?? ""} ${(e.apellidos as string) ?? ""}`.trim() || "—",
      })),
    };
  } catch (err) {
    console.error("[notificaciones] getOpcionesSegmento:", err);
    return { departamentos: [], roles: [], empleados: [] };
  }
}

// ── Validación del segmento + aviso ─────────────────────────────────
const SegmentoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("empresa") }),
  z.object({ tipo: z.literal("empleados"), empleadoIds: z.array(z.string().uuid()).min(1) }),
  z.object({ tipo: z.literal("departamento"), departamentoId: z.string().uuid() }),
  z.object({ tipo: z.literal("area"), area: z.enum(["OPERATIVA", "ADMINISTRATIVA"]) }),
  z.object({ tipo: z.literal("rol"), rolLabel: z.string().trim().min(1) }),
]);

const AvisoSchema = z.object({
  titulo: z.string().trim().min(1, "El título es obligatorio").max(120),
  mensaje: z.string().trim().max(1000).optional().default(""),
  segmento: SegmentoSchema,
  requiereAcuse: z.boolean().optional().default(false),
});

/** Preview del nº de destinatarios resueltos para un segmento. */
export async function contarDestinatarios(segmento: unknown): Promise<number> {
  try {
    const parsed = SegmentoSchema.safeParse(segmento);
    if (!parsed.success) return 0;
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return 0;
    const dest = await resolverDestinatarios(
      supabase as unknown as SupabaseClient,
      empresaId,
      parsed.data,
    );
    return dest.length;
  } catch (err) {
    console.error("[notificaciones] contarDestinatarios:", err);
    return 0;
  }
}

/** Emite un aviso manual segmentado (gestor). */
export async function emitirAvisoManual(input: unknown): Promise<EmitirResultado> {
  const parsed = AvisoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, destinatarios: 0, creadas: 0 };
  const { titulo, mensaje, segmento, requiereAcuse } = parsed.data;
  return emitirNotificacion({
    tipo: "aviso_manual",
    titulo,
    mensaje,
    segmento,
    requiereAccion: requiereAcuse,
    accionLabel: requiereAcuse ? "Confirmar" : "Visto",
  });
}
