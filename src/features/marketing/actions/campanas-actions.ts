"use server";

import { revalidatePath } from "next/cache";
import { getMarketingContext } from "@/features/marketing/lib/supabase-context";
import {
  syncCampanaToMeta,
  updateCampanaMetaStatus,
  fetchCampanaMetaInsights,
  isMetaConfigured,
} from "@/features/marketing/services/meta-ads-service";
import { sendEmailCampana, isResendConfigured } from "@/features/marketing/services/resend-service";
import { abrirEdicion } from "@/features/marketing/services/concurso";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppCampana, isWhatsAppConfigured } from "@/features/marketing/services/whatsapp-service";
import type {
  Campana,
  CampanaEmail,
  CampanaMeta,
  CampanaSms,
  CampanaWhatsApp,
  SegmentoJson,
} from "@/features/marketing/data/campanas";

// ─── Row ↔ Campana ──────────────────────────────────────────────

type Row = Record<string, unknown>;

const SEGMENTO_VACIO: SegmentoJson = { operador: "AND", condiciones: [] };

function rowToCampana(row: Row): Campana {
  const canal = row.canal as Campana["canal"];
  const payloadRow = (row.payload as Record<string, unknown>) ?? {};
  const reglas = payloadRow.claveSeed === "CUMPLEANOS"
    ? {
        diasAntes: Number(payloadRow.diasAntes ?? 7),
        diasValidezDespues: Number(payloadRow.diasValidezDespues ?? 7),
        minimoPersonas: Number(payloadRow.minimoPersonas ?? 6),
      }
    : null;
  const base = {
    id: row.id as string,
    claveSeed: (payloadRow.claveSeed as string | null) ?? null,
    reglasCumpleanos: reglas,
    empresaId: row.empresa_id as string,
    nombre: row.nombre as string,
    estado: row.estado as Campana["estado"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    estadisticas: (row.estadisticas as Campana["estadisticas"]) ?? {},
    // PRP-046 campos comunes
    reservaLinkId: (row.reserva_link_id as string | null) ?? null,
    recurrenciaCron: (row.recurrencia_cron as string | null) ?? null,
    segmentoJson: (row.segmento_json as SegmentoJson) ?? SEGMENTO_VACIO,
    mediaUrls: (row.media_urls as string[]) ?? [],
    ultimaEjecucion: (row.ultima_ejecucion as string | null) ?? null,
  };
  const payload = (row.payload as Record<string, unknown>) ?? {};

  if (canal === "email") {
    return {
      ...base,
      canal: "email",
      asunto: (payload.asunto as string) ?? "",
      remitenteNombre: (payload.remitenteNombre as string) ?? "",
      remitenteEmail: (payload.remitenteEmail as string) ?? "",
      cuerpoHtml: (payload.cuerpoHtml as string) ?? "",
      preheader: (payload.preheader as string) ?? "",
      mes: payload.mes == null ? null : Number(payload.mes),
      fechaEnvio: (row.fecha_envio as string | null) ?? null,
    } as CampanaEmail;
  }
  if (canal === "whatsapp") {
    return {
      ...base,
      canal: "whatsapp",
      plantilla: (payload.plantilla as string) ?? "",
      idioma: (payload.idioma as string) ?? "es",
      cuerpo: (payload.cuerpo as string) ?? "",
      variables: (payload.variables as Record<string, string>) ?? {},
      fechaEnvio: (row.fecha_envio as string | null) ?? null,
    } as CampanaWhatsApp;
  }
  if (canal === "sms") {
    return {
      ...base,
      canal: "sms",
      cuerpo: (payload.cuerpo as string) ?? "",
      remitente: (payload.remitente as string) ?? "",
      fechaEnvio: (row.fecha_envio as string | null) ?? null,
    } as CampanaSms;
  }
  // meta (canal === "meta" || "google" → "google" se mapea a meta hasta que se implemente)
  return {
    ...base,
    canal: "meta",
    objetivo: (payload.objetivo as CampanaMeta["objetivo"]) ?? "LEADS",
    plataformas: (payload.plataformas as CampanaMeta["plataformas"]) ?? ["facebook", "instagram"],
    presupuestoDiario: Number(payload.presupuestoDiario ?? 10),
    duracionDias: Number(payload.duracionDias ?? 7),
    publicoObjetivo: (payload.publicoObjetivo as CampanaMeta["publicoObjetivo"]) ?? {
      edadMin: 25, edadMax: 55, genero: "todos", ubicaciones: [], intereses: [],
    },
    creatividad: (payload.creatividad as CampanaMeta["creatividad"]) ?? {
      titular: "", descripcion: "", textoPrincipal: "", imagenUrl: "",
      cta: "RESERVAR", urlDestino: "",
    },
    fechaInicio: (row.fecha_inicio as string | null) ?? null,
    fechaFin: (row.fecha_fin as string | null) ?? null,
    metaCampaignId: (row.meta_campaign_id as string | null) ?? null,
    metaAdSetId: (row.meta_adset_id as string | null) ?? null,
    metaAdId: (row.meta_ad_id as string | null) ?? null,
    metaSyncedAt: (row.meta_synced_at as string | null) ?? null,
    metaSyncError: (row.meta_sync_error as string | null) ?? null,
  } as CampanaMeta;
}

function campanaToRow(c: Campana, empresaId: string): Record<string, unknown> {
  // Lo que toda campaña arrastra en su payload, escriba quien escriba encima:
  // sin la clave, una campaña sembrada deja de reconocerse y la de cumpleaños
  // se podría disparar a mano.
  const selloSeed = {
    claveSeed: c.claveSeed,
    ...(c.reglasCumpleanos ?? {}),
  };
  const base = {
    id: c.id.length === 36 ? c.id : undefined, // UUIDs válidos, los IDs locales no
    empresa_id: empresaId,
    canal: c.canal,
    nombre: c.nombre,
    estado: c.estado,
    estadisticas: c.estadisticas,
    updated_at: new Date().toISOString(),
    // PRP-046 columnas top-level
    reserva_link_id: c.reservaLinkId,
    recurrencia_cron: c.recurrenciaCron,
    segmento_json: c.segmentoJson,
    media_urls: c.mediaUrls,
    ultima_ejecucion: c.ultimaEjecucion,
  };

  if (c.canal === "email") {
    return {
      ...base,
      fecha_envio: c.fechaEnvio,
      payload: {
        ...selloSeed,
        asunto: c.asunto,
        preheader: c.preheader,
        remitenteNombre: c.remitenteNombre,
        remitenteEmail: c.remitenteEmail,
        cuerpoHtml: c.cuerpoHtml,
        mes: c.mes,
      },
    };
  }
  if (c.canal === "whatsapp") {
    return {
      ...base,
      fecha_envio: c.fechaEnvio,
      payload: {
        ...selloSeed,
        plantilla: c.plantilla,
        idioma: c.idioma,
        cuerpo: c.cuerpo,
        variables: c.variables,
      },
    };
  }
  if (c.canal === "sms") {
    return {
      ...base,
      fecha_envio: c.fechaEnvio,
      payload: {
        ...selloSeed,
        cuerpo: c.cuerpo,
        remitente: c.remitente,
      },
    };
  }
  // meta
  return {
    ...base,
    fecha_inicio: c.fechaInicio,
    fecha_fin: c.fechaFin,
    meta_campaign_id: c.metaCampaignId,
    meta_adset_id: c.metaAdSetId,
    meta_ad_id: c.metaAdId,
    meta_synced_at: c.metaSyncedAt,
    meta_sync_error: c.metaSyncError,
    payload: {
      ...selloSeed,
      objetivo: c.objetivo,
      plataformas: c.plataformas,
      presupuestoDiario: c.presupuestoDiario,
      duracionDias: c.duracionDias,
      publicoObjetivo: c.publicoObjetivo,
      creatividad: c.creatividad,
    },
  };
}

// ─── CRUD ────────────────────────────────────────────────────────

export async function listCampanasAction() {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false, data: [] as Campana[], error: "Sin empresa" };
    const { data, error } = await supabase
      .from("campanas_marketing")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []).map(rowToCampana) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, data: [] as Campana[], error: msg };
  }
}

export async function guardarCampanaAction(campana: Campana) {
  try {
    const { supabase, empresaId, userId } = await getMarketingContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const row = campanaToRow(campana, empresaId);
    // Si es un UUID válido (previamente guardado), upsert; si no, insert
    const esUuid = typeof campana.id === "string" && /^[0-9a-f-]{36}$/i.test(campana.id);
    if (esUuid) {
      const { data, error } = await supabase
        .from("campanas_marketing")
        .update(row)
        .eq("id", campana.id)
        .eq("empresa_id", empresaId)
        .select()
        .single();
      if (error) throw error;
      revalidatePath("/marketing/campanas");
      return { ok: true, data: rowToCampana(data) };
    }
    // nuevo
    const { id: _ignoreId, ...insertRow } = row;
    void _ignoreId;
    const { data, error } = await supabase
      .from("campanas_marketing")
      .insert({ ...insertRow, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/marketing/campanas");
    return { ok: true, data: rowToCampana(data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

export async function eliminarCampanaAction(id: string) {
  try {
    const { supabase, empresaId } = await getMarketingContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };
    const { error } = await supabase
      .from("campanas_marketing")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) throw error;
    revalidatePath("/marketing/campanas");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

// ─── Integraciones externas ─────────────────────────────────────

export async function verificarIntegracionesAction() {
  return {
    meta: isMetaConfigured(),
    resend: isResendConfigured(),
    whatsapp: isWhatsAppConfigured(),
  };
}

/**
 * La de cumpleaños no es una campaña de las de "enviar ahora": su texto lleva
 * dentro el nombre y el código de cada persona, y sale sola el día que le toca a
 * cada una. Dispararla a mano mandaría el mismo correo a toda la base con los
 * huecos sin rellenar y regalaría una comida a nadie. Se bloquea en el servidor,
 * no solo en el botón: el botón se puede saltar.
 */
const MOTIVO_CUMPLEANOS =
  "La campaña de cumpleaños se envía sola: cada cliente recibe la suya el día que le toca. " +
  "Ponla en marcha cambiando su estado a Activa.";

function esCampanaCumpleanos(campana: { claveSeed?: string | null }): boolean {
  return campana.claveSeed === "CUMPLEANOS";
}

export async function enviarEmailAction(campana: CampanaEmail) {
  const { supabase, empresaId } = await getMarketingContext();
  if (!empresaId) return { success: false, error: "Sin empresa" };
  if (campana.empresaId !== empresaId) {
    return { success: false, error: "Empresa no autorizada" };
  }
  if (esCampanaCumpleanos(campana)) {
    return { success: false, error: MOTIVO_CUMPLEANOS };
  }

  // Las campañas del calendario anual llevan dentro el concurso del mes. La
  // edición se abre AQUÍ, en el mismo acto de enviar: antes no, porque quien
  // adivinara la dirección jugaría sin haber recibido el correo y se llevaría
  // los tres premios; después tampoco, porque el primero en abrir el correo se
  // encontraría el concurso cerrado.
  const claveSeed = campana.claveSeed;
  if (claveSeed && campana.mes) {
    const admin = createAdminClient();
    const abierta = await abrirEdicion(admin, empresaId, claveSeed, campana.mes);
    if (!abierta.ok) {
      return {
        success: false,
        error: `No se puede enviar: el concurso del mes no ha podido abrirse (${abierta.error})`,
      };
    }
  }

  const result = await sendEmailCampana(campana);
  if (result.success) {
    await supabase
      .from("campanas_marketing")
      .update({
        estado: "finalizada",
        ultima_ejecucion: new Date().toISOString(),
        fecha_envio: new Date().toISOString(),
      })
      .eq("id", campana.id)
      .eq("empresa_id", empresaId);
    revalidatePath("/marketing/campanas");
  }
  return result;
}

export async function enviarWhatsAppAction(campana: CampanaWhatsApp) {
  const { empresaId } = await getMarketingContext();
  if (!empresaId) return { success: false, error: "Sin empresa" };
  if (campana.empresaId !== empresaId) {
    return { success: false, error: "Empresa no autorizada" };
  }
  if (esCampanaCumpleanos(campana)) {
    return { success: false, error: MOTIVO_CUMPLEANOS };
  }
  const result = await sendWhatsAppCampana(campana);
  if (result.success) revalidatePath("/marketing/campanas");
  return result;
}

export async function sincronizarCampanaMetaAction(campana: CampanaMeta) {
  const result = await syncCampanaToMeta(campana);
  if (result.success) revalidatePath("/marketing/campanas");
  return result;
}

export async function cambiarEstadoMetaAction(
  metaCampaignId: string,
  status: "ACTIVE" | "PAUSED" | "DELETED",
) {
  const result = await updateCampanaMetaStatus(metaCampaignId, status);
  if (result.success) revalidatePath("/marketing/campanas");
  return result;
}

export async function traerInsightsMetaAction(metaCampaignId: string) {
  return fetchCampanaMetaInsights(metaCampaignId);
}
