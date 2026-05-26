"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import {
  estadoActividadParaFase,
  normalizarNombre,
  normalizarTelefono,
} from "./data";
import { sendInspectorFaseEmail } from "./email-sender";
import type {
  BolsaCamposActivos,
  BolsaConfig,
  Inspector,
  InspectorDetalle,
  InspectorFase,
  InspectorHistorialItem,
  InspectorListItem,
} from "./types";
import { BOLSA_CONFIG_DEFAULTS, mergeCamposActivos } from "./types";

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

function mapInspector(row: Record<string, unknown>): Inspector {
  return {
    id: row.id as string,
    empresa_id: row.empresa_id as string,
    numero_secuencial: (row.numero_secuencial as number | null) ?? null,
    nombre: row.nombre as string,
    apellidos: (row.apellidos as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    telefono: row.telefono as string,
    dni_nie: (row.dni_nie as string | null) ?? null,
    fecha_nacimiento: (row.fecha_nacimiento as string | null) ?? null,
    ciudad: (row.ciudad as string | null) ?? null,
    provincia: (row.provincia as string | null) ?? null,
    pais: (row.pais as string | null) ?? null,
    disponibilidad: (row.disponibilidad as Inspector["disponibilidad"]) ?? null,
    cv_url: (row.cv_url as string | null) ?? null,
    foto_url: (row.foto_url as string | null) ?? null,
    fase: row.fase as InspectorFase,
    estado_actividad: row.estado_actividad as Inspector["estado_actividad"],
    origen: row.origen as Inspector["origen"],
    pagina_slug: (row.pagina_slug as string | null) ?? null,
    notas: (row.notas as string | null) ?? null,
    notas_internas: (row.notas_internas as string | null) ?? null,
    rating_interno: (row.rating_interno as number | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ─── Listado con métricas agregadas (nº inspecciones, nota media) ────
export async function listInspectores(): Promise<InspectorListItem[]> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return [];

  const { data: rows, error } = await supabase
    .from("inspectores")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });
  if (error || !rows) return [];

  const inspectorIds = rows.map((r) => r.id);
  if (inspectorIds.length === 0) {
    return rows.map((r) => ({
      ...mapInspector(r),
      num_inspecciones: 0,
      ultima_inspeccion_at: null,
      nota_media: null,
    }));
  }

  const { data: asignaciones } = await supabase
    .from("inspector_asignaciones")
    .select("inspector_id, envio:inspeccion_envios(nota_final, created_at)")
    .in("inspector_id", inspectorIds);

  const aggPorInspector = new Map<
    string,
    { count: number; sumaNota: number; cuentaNota: number; ultima: string | null }
  >();
  for (const a of asignaciones ?? []) {
    const inspId = a.inspector_id as string;
    const envio = Array.isArray(a.envio) ? a.envio[0] : a.envio;
    if (!envio) continue;
    const agg = aggPorInspector.get(inspId) ?? {
      count: 0,
      sumaNota: 0,
      cuentaNota: 0,
      ultima: null,
    };
    agg.count += 1;
    const nota = envio.nota_final != null ? Number(envio.nota_final) : null;
    if (nota != null) {
      agg.sumaNota += nota;
      agg.cuentaNota += 1;
    }
    const createdAt = envio.created_at as string;
    if (createdAt && (!agg.ultima || createdAt > agg.ultima)) {
      agg.ultima = createdAt;
    }
    aggPorInspector.set(inspId, agg);
  }

  return rows.map((r): InspectorListItem => {
    const agg = aggPorInspector.get(r.id);
    return {
      ...mapInspector(r),
      num_inspecciones: agg?.count ?? 0,
      ultima_inspeccion_at: agg?.ultima ?? null,
      nota_media:
        agg && agg.cuentaNota > 0
          ? Number((agg.sumaNota / agg.cuentaNota).toFixed(2))
          : null,
    };
  });
}

export async function getInspectorDetalle(
  inspectorId: string,
): Promise<InspectorDetalle | null> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return null;

  const { data: row, error } = await supabase
    .from("inspectores")
    .select("*")
    .eq("id", inspectorId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error || !row) return null;

  const { data: asignaciones } = await supabase
    .from("inspector_asignaciones")
    .select(
      "envio:inspeccion_envios(id, numero_secuencial, fecha_inspeccion, nota_final, estado, verificado_at, local:locales(nombre))",
    )
    .eq("inspector_id", inspectorId)
    .order("created_at", { ascending: false });

  const historial: InspectorHistorialItem[] = (asignaciones ?? [])
    .map((a) => (Array.isArray(a.envio) ? a.envio[0] : a.envio))
    .filter(Boolean)
    .map((envio) => {
      const localNombre =
        (Array.isArray(envio.local)
          ? envio.local[0]?.nombre
          : (envio.local as { nombre: string } | null)?.nombre) ?? null;
      return {
        envio_id: envio.id as string,
        numero_secuencial: (envio.numero_secuencial as number | null) ?? null,
        fecha_inspeccion: (envio.fecha_inspeccion as string | null) ?? null,
        local_nombre: localNombre,
        nota_final: envio.nota_final != null ? Number(envio.nota_final) : null,
        estado: envio.estado as InspectorHistorialItem["estado"],
        verificado_at: (envio.verificado_at as string | null) ?? null,
      };
    });

  const notas = historial
    .map((h) => h.nota_final)
    .filter((n): n is number => n != null);
  const nota_media =
    notas.length > 0
      ? Number((notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(2))
      : null;

  return {
    ...mapInspector(row),
    historial,
    num_inspecciones: historial.length,
    nota_media,
  };
}

// ─── Mutaciones ──────────────────────────────────────────────────────

export interface CrearInspectorInput {
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  ciudad: string;
  horario_disponibilidad: string;
  vehiculo_propio: boolean;
  provincia?: string | null;
  notas?: string | null;
  fase?: InspectorFase;
}

export async function crearInspectorManual(
  input: CrearInspectorInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const tel = input.telefono?.trim();
  const nombre = normalizarNombre(input.nombre);
  const apellidos = normalizarNombre(input.apellidos);
  const email = input.email?.trim();
  const ciudad = input.ciudad?.trim();
  const horario = input.horario_disponibilidad?.trim();
  if (!nombre || nombre.length < 2) {
    return { ok: false, error: "Nombre inválido" };
  }
  if (!apellidos) {
    return { ok: false, error: "Apellidos obligatorios" };
  }
  if (!tel) {
    return { ok: false, error: "Teléfono obligatorio" };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Email inválido" };
  }
  if (!ciudad) {
    return { ok: false, error: "Ciudad obligatoria" };
  }
  if (!horario) {
    return { ok: false, error: "Selecciona al menos una disponibilidad horaria" };
  }
  if (typeof input.vehiculo_propio !== "boolean") {
    return { ok: false, error: "Indica si tiene vehículo propio" };
  }

  const fase: InspectorFase = input.fase ?? "bolsa";

  const { data, error } = await supabase
    .from("inspectores")
    .insert({
      empresa_id: empresaId,
      nombre,
      apellidos,
      email,
      telefono: tel,
      ciudad,
      provincia: input.provincia?.trim() || null,
      disponibilidad: { horario, vehiculo_propio: input.vehiculo_propio },
      notas: input.notas?.trim() || null,
      fase,
      estado_actividad: estadoActividadParaFase(fase),
      origen: "alta_manual",
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Ya existe un inspector con ese teléfono" };
    }
    return { ok: false, error: error?.message ?? "Error al crear" };
  }

  // Email automático correspondiente a la fase de creación (normalmente "Nuevo").
  const res = await sendInspectorFaseEmail(empresaId, data.id, fase);
  if (!res.sent) {
    console.log(
      `[crearInspectorManual] email fase=${fase} no enviado: ${res.reason}`,
    );
  }

  revalidatePath("/calidad/inspecciones");
  return { ok: true, id: data.id };
}

export async function actualizarInspector(
  inspectorId: string,
  patch: Partial<{
    nombre: string;
    apellidos: string | null;
    email: string | null;
    telefono: string;
    ciudad: string | null;
    provincia: string | null;
    disponibilidad: Inspector["disponibilidad"];
    cv_url: string | null;
    foto_url: string | null;
    notas: string | null;
    notas_internas: string | null;
    rating_interno: number | null;
  }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId, user } = await ctx();
  if (!empresaId || !user) return { ok: false, error: "Sin sesión" };

  const { error } = await supabase
    .from("inspectores")
    .update({ ...patch, updated_por: user.id })
    .eq("id", inspectorId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

export async function moverInspectorFase(
  inspectorId: string,
  fase: InspectorFase,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId, user } = await ctx();
  if (!empresaId || !user) return { ok: false, error: "Sin sesión" };

  // Fase actual para evitar reenviar el email si no hay cambio real.
  const { data: actual } = await supabase
    .from("inspectores")
    .select("fase")
    .eq("id", inspectorId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const faseAnterior = (actual?.fase as InspectorFase | undefined) ?? null;

  const { error } = await supabase
    .from("inspectores")
    .update({
      fase,
      estado_actividad: estadoActividadParaFase(fase),
      updated_por: user.id,
    })
    .eq("id", inspectorId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };

  // Dispara el email automático de la fase destino (no bloquea ni revierte).
  if (faseAnterior !== fase) {
    const res = await sendInspectorFaseEmail(empresaId, inspectorId, fase);
    if (!res.sent) {
      console.log(
        `[moverInspectorFase] email fase=${fase} no enviado: ${res.reason}`,
      );
    }
  }

  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

export async function eliminarInspector(
  inspectorId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };
  const { error } = await supabase
    .from("inspectores")
    .delete()
    .eq("id", inspectorId)
    .eq("empresa_id", empresaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

// ─── Vincular inspector ↔ envío manualmente ────────────────────────
export async function vincularInspectorEnvio(
  inspectorId: string,
  envioId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const { error } = await supabase
    .from("inspector_asignaciones")
    .upsert(
      { empresa_id: empresaId, inspector_id: inspectorId, envio_id: envioId },
      { onConflict: "envio_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

// ─── Config de la Bolsa Pública ─────────────────────────────────────

export async function getBolsaConfig(): Promise<
  | { ok: true; config: BolsaConfig; empresaSlug: string | null }
  | { ok: false; error: string }
> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const [{ data: row }, { data: emp }] = await Promise.all([
    supabase
      .from("inspecciones_bolsa_config")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    supabase.from("empresas").select("slug").eq("id", empresaId).maybeSingle(),
  ]);

  const config: BolsaConfig = row
    ? {
        activa: row.activa,
        titulo_seccion: row.titulo_seccion,
        titulo_principal: row.titulo_principal,
        descripcion: row.descripcion,
        mensaje_exito_titulo: row.mensaje_exito_titulo,
        mensaje_exito_texto: row.mensaje_exito_texto,
        texto_boton: row.texto_boton,
        color_fondo: row.color_fondo,
        color_acento: row.color_acento,
        color_texto: row.color_texto,
        campos_activos: mergeCamposActivos(
          row.campos_activos as Partial<BolsaCamposActivos> | null,
        ),
      }
    : { ...BOLSA_CONFIG_DEFAULTS };

  return { ok: true, config, empresaSlug: emp?.slug ?? null };
}

export async function saveBolsaConfig(
  patch: Partial<BolsaConfig>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const { error } = await supabase
    .from("inspecciones_bolsa_config")
    .upsert(
      { empresa_id: empresaId, ...patch },
      { onConflict: "empresa_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calidad/inspecciones");
  return { ok: true };
}

// ─── Auto-match por teléfono al revisar envío ───────────────────────
// Busca un inspector existente cuyo teléfono (normalizado) coincida con
// el del envío. Si encuentra exactamente uno, crea la asignación.
export async function autoVincularInspectorPorTelefono(
  envioId: string,
): Promise<{ ok: true; vinculado: boolean } | { ok: false; error: string }> {
  const { supabase, empresaId } = await ctx();
  if (!empresaId) return { ok: false, error: "Sin sesión" };

  const { data: envio } = await supabase
    .from("inspeccion_envios")
    .select("id, telefono_inspector")
    .eq("id", envioId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!envio?.telefono_inspector) return { ok: true, vinculado: false };

  const telNorm = normalizarTelefono(envio.telefono_inspector);
  if (!telNorm) return { ok: true, vinculado: false };

  const { data: candidatos } = await supabase
    .from("inspectores")
    .select("id, telefono")
    .eq("empresa_id", empresaId);
  const matches = (candidatos ?? []).filter(
    (c) => normalizarTelefono(c.telefono) === telNorm,
  );
  if (matches.length !== 1) return { ok: true, vinculado: false };

  const { error } = await supabase
    .from("inspector_asignaciones")
    .upsert(
      {
        empresa_id: empresaId,
        inspector_id: matches[0].id,
        envio_id: envioId,
      },
      { onConflict: "envio_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true, vinculado: true };
}
