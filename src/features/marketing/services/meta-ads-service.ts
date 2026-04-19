/**
 * Meta Marketing API integration layer.
 *
 * Traduce la configuración simple del usuario (presupuesto, público, creatividad)
 * a llamadas de la API de Meta (Graph API v19+) para crear Campaign + AdSet + Ad.
 *
 * Endpoints usados:
 *  - POST /{ad_account_id}/campaigns
 *  - POST /{ad_account_id}/adsets
 *  - POST /{ad_account_id}/adcreatives
 *  - POST /{ad_account_id}/ads
 *
 * Credenciales (definir en .env.local y en Vercel):
 *  - META_ACCESS_TOKEN          → System User token con permisos ads_management
 *  - META_AD_ACCOUNT_ID         → act_123456789
 *  - META_PAGE_ID               → página de Facebook asociada al negocio
 *  - META_INSTAGRAM_ACTOR_ID    → cuenta de Instagram vinculada
 *  - META_API_VERSION           → v19.0 (default)
 */

import type { CampanaMeta, ObjetivoMeta } from "@/features/marketing/data/campanas";

const API_VERSION = process.env.META_API_VERSION ?? "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${API_VERSION}`;

interface MetaConfig {
  accessToken: string;
  adAccountId: string;
  pageId: string;
  instagramActorId?: string;
}

export interface MetaSyncResult {
  success: boolean;
  campaignId?: string;
  adSetId?: string;
  adId?: string;
  error?: string;
}

// ─── Config helper ──────────────────────────────────────────────

export function getMetaConfig(): MetaConfig | null {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const pageId = process.env.META_PAGE_ID;
  if (!accessToken || !adAccountId || !pageId) return null;
  return {
    accessToken,
    adAccountId,
    pageId,
    instagramActorId: process.env.META_INSTAGRAM_ACTOR_ID,
  };
}

export function isMetaConfigured(): boolean {
  return getMetaConfig() !== null;
}

// ─── Objetivo mapping ───────────────────────────────────────────

function mapObjetivoToMeta(objetivo: ObjetivoMeta): string {
  // Meta usa códigos "OUTCOME_*" en el SDK nuevo.
  const map: Record<ObjetivoMeta, string> = {
    AWARENESS: "OUTCOME_AWARENESS",
    TRAFFIC: "OUTCOME_TRAFFIC",
    ENGAGEMENT: "OUTCOME_ENGAGEMENT",
    LEADS: "OUTCOME_LEADS",
    SALES: "OUTCOME_SALES",
    APP_PROMOTION: "OUTCOME_APP_PROMOTION",
  };
  return map[objetivo];
}

function mapCtaToMeta(cta: CampanaMeta["creatividad"]["cta"]): string {
  const map: Record<CampanaMeta["creatividad"]["cta"], string> = {
    RESERVAR: "BOOK_TRAVEL",
    SABER_MAS: "LEARN_MORE",
    PEDIR_AHORA: "ORDER_NOW",
    LLAMAR: "CALL_NOW",
    CONTACTAR: "CONTACT_US",
  };
  return map[cta];
}

// ─── API calls ──────────────────────────────────────────────────

async function metaPost(path: string, params: Record<string, unknown>, token: string) {
  const url = `${GRAPH_BASE}${path}`;
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    body.append(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  body.append("access_token", token);
  const res = await fetch(url, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Meta API: ${msg}`);
  }
  return data as Record<string, unknown>;
}

/**
 * Sincroniza una campaña local con Meta creando Campaign + AdSet + Ad.
 * Si ya existía metaCampaignId, se omite la creación (idempotente).
 */
export async function syncCampanaToMeta(campana: CampanaMeta): Promise<MetaSyncResult> {
  const cfg = getMetaConfig();
  if (!cfg) {
    return { success: false, error: "Meta no está configurado. Añade META_ACCESS_TOKEN y META_AD_ACCOUNT_ID en Ajustes → Integraciones." };
  }

  try {
    // 1. Campaign
    const campaignRes = campana.metaCampaignId
      ? { id: campana.metaCampaignId }
      : await metaPost(`/${cfg.adAccountId}/campaigns`, {
          name: campana.nombre,
          objective: mapObjetivoToMeta(campana.objetivo),
          status: "PAUSED",
          special_ad_categories: [],
          buying_type: "AUCTION",
        }, cfg.accessToken);
    const campaignId = campaignRes.id as string;

    // 2. AdSet
    const startTime = campana.fechaInicio ?? new Date().toISOString();
    const endTime = campana.fechaFin ??
      new Date(Date.now() + campana.duracionDias * 864e5).toISOString();
    const adSetRes = await metaPost(`/${cfg.adAccountId}/adsets`, {
      name: `${campana.nombre} — AdSet`,
      campaign_id: campaignId,
      daily_budget: Math.round(campana.presupuestoDiario * 100), // en céntimos
      billing_event: "IMPRESSIONS",
      optimization_goal: campana.objetivo === "LEADS" ? "LEAD_GENERATION" : "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: {
        age_min: campana.publicoObjetivo.edadMin,
        age_max: campana.publicoObjetivo.edadMax,
        genders:
          campana.publicoObjetivo.genero === "hombre" ? [1]
          : campana.publicoObjetivo.genero === "mujer" ? [2]
          : [1, 2],
        geo_locations: {
          cities: campana.publicoObjetivo.ubicaciones.map((u) => ({ key: u })),
        },
        publisher_platforms: campana.plataformas,
        interests: campana.publicoObjetivo.intereses.map((i) => ({ name: i })),
      },
      start_time: startTime,
      end_time: endTime,
      status: "PAUSED",
    }, cfg.accessToken);
    const adSetId = adSetRes.id as string;

    // 3. AdCreative
    const creativeRes = await metaPost(`/${cfg.adAccountId}/adcreatives`, {
      name: `${campana.nombre} — Creative`,
      object_story_spec: {
        page_id: cfg.pageId,
        ...(cfg.instagramActorId && { instagram_actor_id: cfg.instagramActorId }),
        link_data: {
          message: campana.creatividad.textoPrincipal,
          link: campana.creatividad.urlDestino,
          name: campana.creatividad.titular,
          description: campana.creatividad.descripcion,
          picture: campana.creatividad.imagenUrl,
          call_to_action: {
            type: mapCtaToMeta(campana.creatividad.cta),
            value: { link: campana.creatividad.urlDestino },
          },
        },
      },
    }, cfg.accessToken);
    const creativeId = creativeRes.id as string;

    // 4. Ad
    const adRes = await metaPost(`/${cfg.adAccountId}/ads`, {
      name: `${campana.nombre} — Ad`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: "PAUSED",
    }, cfg.accessToken);

    return {
      success: true,
      campaignId,
      adSetId,
      adId: adRes.id as string,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
}

/**
 * Cambia el estado de una Campaign en Meta (ACTIVE / PAUSED / DELETED).
 */
export async function updateCampanaMetaStatus(
  metaCampaignId: string,
  status: "ACTIVE" | "PAUSED" | "DELETED",
): Promise<MetaSyncResult> {
  const cfg = getMetaConfig();
  if (!cfg) return { success: false, error: "Meta no configurado" };
  try {
    await metaPost(`/${metaCampaignId}`, { status }, cfg.accessToken);
    return { success: true, campaignId: metaCampaignId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Trae insights (impresiones, clicks, gasto...) de una campaña de Meta.
 */
export async function fetchCampanaMetaInsights(metaCampaignId: string) {
  const cfg = getMetaConfig();
  if (!cfg) return null;
  const url = `${GRAPH_BASE}/${metaCampaignId}/insights?fields=impressions,reach,clicks,ctr,cpc,spend,actions&access_token=${cfg.accessToken}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const row = data?.data?.[0];
  if (!row) return null;
  return {
    impresiones: Number(row.impressions ?? 0),
    alcance: Number(row.reach ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctr: Number(row.ctr ?? 0),
    cpc: Number(row.cpc ?? 0),
    gasto: Number(row.spend ?? 0),
    conversiones: Number(
      (row.actions ?? []).find((a: { action_type: string }) => a.action_type === "lead")?.value ?? 0,
    ),
  };
}
