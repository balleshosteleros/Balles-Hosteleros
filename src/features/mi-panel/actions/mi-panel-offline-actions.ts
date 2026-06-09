"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaId } from "@/features/empresa/actions/empresa-activa-actions";

const DRIFT_MAX_SEG = Number(process.env.FICHAJE_OFFLINE_DRIFT_MAX_SEG ?? 300);

const itemSchema = z.object({
  kind: z.enum(["entrada", "salida", "pausa_inicio", "pausa_fin"]),
  fichajeId: z.string().uuid().nullable(),
  deviceTimestampIso: z.string().datetime(),
  deviceMonotonicMs: z.number(),
  offlineSeconds: z.number().min(0),
  geo: z
    .object({
      lat: z.number(),
      lng: z.number(),
      precision: z.number(),
    })
    .nullable()
    .optional(),
});

const inputSchema = z.object({
  items: z.array(itemSchema).min(1).max(50),
});

export type SincronizarItemResult = {
  ok: boolean;
  kind: string;
  fichajeId?: string;
  requiere_revision?: boolean;
  error?: string;
};

function calcularDelta(deviceIso: string, offlineSeconds: number): {
  delta: number;
  requiere_revision: boolean;
  motivo: string | null;
} {
  const deviceMs = new Date(deviceIso).getTime();
  const expectedNowMs = deviceMs + offlineSeconds * 1000;
  const realNowMs = Date.now();
  const delta = Math.round(Math.abs(realNowMs - expectedNowMs) / 1000);
  if (delta > DRIFT_MAX_SEG) {
    return { delta, requiere_revision: true, motivo: "deriva_reloj" };
  }
  return { delta, requiere_revision: false, motivo: null };
}

function todayISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function sincronizarFichajesOffline(
  raw: unknown,
): Promise<{ ok: boolean; results: SincronizarItemResult[]; error?: string }> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, results: [], error: "Payload inválido" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, results: [], error: "No autenticado" };
  const empresaId = await getEmpresaActivaId();
  if (!empresaId) return { ok: false, results: [], error: "Sin empresa activa" };

  const { data: profile } = await supabase
    .from("usuarios")
    .select("nombre, apellidos")
    .eq("user_id", user.id)
    .maybeSingle();
  const nombre =
    `${profile?.nombre ?? ""} ${profile?.apellidos ?? ""}`.trim() ||
    user.email?.split("@")[0] ||
    "Empleado";

  const { data: empleado } = await supabase
    .from("empleados")
    .select("local_id, permite_teletrabajo")
    .eq("user_id", user.id)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const results: SincronizarItemResult[] = [];

  for (const item of parsed.data.items) {
    const drift = calcularDelta(item.deviceTimestampIso, item.offlineSeconds);
    const deviceDate = new Date(item.deviceTimestampIso);

    try {
      if (item.kind === "entrada") {
        const { data, error } = await supabase
          .from("fichajes")
          .insert({
            empresa_id: empresaId,
            empleado_id: user.id,
            empleado_nombre: nombre,
            fecha: todayISO(deviceDate),
            hora_entrada: item.deviceTimestampIso,
            estado: "trabajando",
            local_id: empleado?.local_id ?? null,
            lat_entrada: item.geo?.lat ?? null,
            lng_entrada: item.geo?.lng ?? null,
            precision_entrada_metros: item.geo?.precision ?? null,
            modo_teletrabajo: Boolean(empleado?.permite_teletrabajo),
            origen: "offline_sync",
            device_timestamp_iso: item.deviceTimestampIso,
            device_monotonic_ms: Math.round(item.deviceMonotonicMs),
            sync_delta_segundos: drift.delta,
            requiere_revision: drift.requiere_revision,
            revision_motivo: drift.motivo,
          })
          .select("id")
          .single();
        if (error) throw error;
        results.push({
          ok: true,
          kind: item.kind,
          fichajeId: data.id as string,
          requiere_revision: drift.requiere_revision,
        });
      } else if (item.kind === "salida" && item.fichajeId) {
        const { data: fichaje } = await supabase
          .from("fichajes")
          .select("hora_entrada")
          .eq("id", item.fichajeId)
          .maybeSingle();

        let horasTotales = 0;
        if (fichaje?.hora_entrada) {
          const entrada = new Date(fichaje.hora_entrada as string);
          horasTotales =
            Math.round(((deviceDate.getTime() - entrada.getTime()) / 3600000) * 10000) /
            10000;
        }

        const { error } = await supabase
          .from("fichajes")
          .update({
            hora_salida: item.deviceTimestampIso,
            horas_totales: horasTotales,
            estado: "completado",
            lat_salida: item.geo?.lat ?? null,
            lng_salida: item.geo?.lng ?? null,
            precision_salida_metros: item.geo?.precision ?? null,
            origen: "offline_sync",
            device_timestamp_iso: item.deviceTimestampIso,
            device_monotonic_ms: Math.round(item.deviceMonotonicMs),
            sync_delta_segundos: drift.delta,
            requiere_revision: drift.requiere_revision,
            revision_motivo: drift.motivo,
          })
          .eq("id", item.fichajeId);
        if (error) throw error;
        results.push({
          ok: true,
          kind: item.kind,
          fichajeId: item.fichajeId,
          requiere_revision: drift.requiere_revision,
        });
      } else if (item.kind === "pausa_inicio" && item.fichajeId) {
        const horaStr = deviceDate.toTimeString().slice(0, 8);
        const { error } = await supabase
          .from("fichajes")
          .update({ pausa_inicio: horaStr, estado: "pausa" })
          .eq("id", item.fichajeId);
        if (error) throw error;
        results.push({ ok: true, kind: item.kind, fichajeId: item.fichajeId });
      } else if (item.kind === "pausa_fin" && item.fichajeId) {
        const horaStr = deviceDate.toTimeString().slice(0, 8);
        const { error } = await supabase
          .from("fichajes")
          .update({ pausa_fin: horaStr, estado: "trabajando" })
          .eq("id", item.fichajeId);
        if (error) throw error;
        results.push({ ok: true, kind: item.kind, fichajeId: item.fichajeId });
      } else {
        results.push({ ok: false, kind: item.kind, error: "Item incompleto" });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error sincronizando";
      results.push({ ok: false, kind: item.kind, error: msg });
    }
  }

  return { ok: true, results };
}
