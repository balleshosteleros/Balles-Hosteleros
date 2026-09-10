import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { metaGetTodas } from "@/features/marketing/meta-ads/services/meta-client";
import type { MetaCredenciales } from "@/features/marketing/meta-ads/services/meta-credenciales";

/**
 * PRP-087 · Traer de Meta los tres niveles y volcarlos al espejo.
 *
 * Trae TODO lo de la cuenta publicitaria, no solo lo creado desde el software:
 * el objetivo de la pantalla es que no haya publicidad invisible. Lo que el
 * traffiquer monte en el Administrador de anuncios tiene que aparecer aquí.
 *
 * El volcado es un `upsert` por (empresa, id de Meta): repetir la sincronización
 * es inofensivo y nunca duplica.
 */

/** Campos que pedimos de cada nivel. Menos es más: la API cobra por tamaño. */
const CAMPOS_CAMPANA =
  "id,name,objective,status,effective_status,daily_budget,lifetime_budget,created_time";
const CAMPOS_CONJUNTO =
  "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,start_time,end_time";
const CAMPOS_ANUNCIO =
  "id,name,adset_id,campaign_id,status,effective_status,creative{id,object_story_spec,thumbnail_url,object_type},preview_shareable_link";

interface CampanaMeta {
  id?: string;
  name?: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
}

interface ConjuntoMeta {
  id?: string;
  name?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  targeting?: Record<string, unknown>;
  optimization_goal?: string;
  billing_event?: string;
  start_time?: string;
  end_time?: string;
}

interface AnuncioMeta {
  id?: string;
  name?: string;
  adset_id?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  preview_shareable_link?: string;
  creative?: {
    id?: string;
    object_story_spec?: Record<string, unknown>;
    thumbnail_url?: string;
    object_type?: string;
  };
}

/** Meta manda los presupuestos como texto en céntimos; puede no venir. */
function aCentimos(valor: string | undefined): number | null {
  if (!valor) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Deduce el formato del anuncio mirando la creatividad.
 *
 * Se mira `child_attachments` ANTES que el vídeo: un carrusel cuyas tarjetas
 * son vídeos también trae `video_id`, y si se comprobara primero el vídeo se
 * etiquetaría como vídeo suelto un carrusel entero.
 */
export function deducirFormato(creative: AnuncioMeta["creative"]): string {
  const spec = creative?.object_story_spec as
    | { link_data?: { child_attachments?: unknown[]; video_id?: string }; video_data?: unknown }
    | undefined;

  const tarjetas = spec?.link_data?.child_attachments;
  if (Array.isArray(tarjetas) && tarjetas.length > 1) return "carrusel";
  if (spec?.video_data) return "video";
  if (spec?.link_data?.video_id) return "video";
  if (spec?.link_data) return "imagen";

  const tipo = creative?.object_type?.toLowerCase();
  if (tipo === "video") return "video";
  if (tipo === "photo" || tipo === "share") return "imagen";
  return "otro";
}

export interface ResumenSincronizacion {
  campanas: number;
  conjuntos: number;
  anuncios: number;
}

/**
 * Lee los tres niveles de la cuenta publicitaria y los vuelca al espejo.
 * Devuelve cuántos elementos ha visto de cada nivel.
 */
export async function sincronizarEstructura(
  admin: SupabaseClient,
  empresaId: string,
  cred: MetaCredenciales,
): Promise<ResumenSincronizacion> {
  const { accessToken, adAccountId } = cred;
  const ahora = new Date().toISOString();

  const [campanas, conjuntos, anuncios] = await Promise.all([
    metaGetTodas<CampanaMeta>(`/${adAccountId}/campaigns`, accessToken, { fields: CAMPOS_CAMPANA }),
    metaGetTodas<ConjuntoMeta>(`/${adAccountId}/adsets`, accessToken, { fields: CAMPOS_CONJUNTO }),
    metaGetTodas<AnuncioMeta>(`/${adAccountId}/ads`, accessToken, { fields: CAMPOS_ANUNCIO }),
  ]);

  const filasCampanas = campanas
    .filter((c) => c.id)
    .map((c) => ({
      empresa_id: empresaId,
      meta_id: c.id as string,
      nombre: c.name?.trim() || "(sin nombre)",
      objetivo: c.objective ?? null,
      estado: c.status ?? null,
      estado_efectivo: c.effective_status ?? null,
      presupuesto_diario_cent: aCentimos(c.daily_budget),
      presupuesto_total_cent: aCentimos(c.lifetime_budget),
      creada_en_meta_at: c.created_time ?? null,
      raw: c as unknown as Record<string, unknown>,
      sincronizado_at: ahora,
    }));

  const filasConjuntos = conjuntos
    .filter((s) => s.id && s.campaign_id)
    .map((s) => ({
      empresa_id: empresaId,
      meta_id: s.id as string,
      campana_meta_id: s.campaign_id as string,
      nombre: s.name?.trim() || "(sin nombre)",
      estado: s.status ?? null,
      estado_efectivo: s.effective_status ?? null,
      presupuesto_diario_cent: aCentimos(s.daily_budget),
      presupuesto_total_cent: aCentimos(s.lifetime_budget),
      publico: s.targeting ?? {},
      optimization_goal: s.optimization_goal ?? null,
      billing_event: s.billing_event ?? null,
      inicio_at: s.start_time ?? null,
      fin_at: s.end_time ?? null,
      raw: s as unknown as Record<string, unknown>,
      sincronizado_at: ahora,
    }));

  const filasAnuncios = anuncios
    .filter((a) => a.id && a.adset_id)
    .map((a) => ({
      empresa_id: empresaId,
      meta_id: a.id as string,
      conjunto_meta_id: a.adset_id as string,
      campana_meta_id: a.campaign_id ?? null,
      nombre: a.name?.trim() || "(sin nombre)",
      estado: a.status ?? null,
      estado_efectivo: a.effective_status ?? null,
      formato: deducirFormato(a.creative),
      creatividad: (a.creative ?? {}) as unknown as Record<string, unknown>,
      vista_previa_url: a.preview_shareable_link ?? null,
      raw: a as unknown as Record<string, unknown>,
      sincronizado_at: ahora,
    }));

  // En este orden: primero campañas, luego conjuntos, luego anuncios. Si algo
  // falla a mitad, el espejo queda incompleto pero nunca con hijos huérfanos
  // apuntando a un padre que no está.
  await upsertPorLotes(admin, "meta_campanas", filasCampanas);
  await upsertPorLotes(admin, "meta_conjuntos", filasConjuntos);
  await upsertPorLotes(admin, "meta_anuncios", filasAnuncios);

  return {
    campanas: filasCampanas.length,
    conjuntos: filasConjuntos.length,
    anuncios: filasAnuncios.length,
  };
}

/**
 * Escribe en lotes de 500. Una cuenta con años de historia trae miles de
 * anuncios y un `upsert` único con todo se atraganta.
 */
async function upsertPorLotes(
  admin: SupabaseClient,
  tabla: string,
  filas: Record<string, unknown>[],
  tamano = 500,
): Promise<void> {
  for (let i = 0; i < filas.length; i += tamano) {
    const lote = filas.slice(i, i + tamano);
    const { error } = await admin.from(tabla).upsert(lote, { onConflict: "empresa_id,meta_id" });
    if (error) throw new Error(`No se pudo guardar en ${tabla}: ${error.message}`);
  }
}
