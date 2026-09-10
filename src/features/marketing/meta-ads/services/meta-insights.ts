import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { metaGetTodas } from "@/features/marketing/meta-ads/services/meta-client";
import type { MetaCredenciales } from "@/features/marketing/meta-ads/services/meta-credenciales";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";

/**
 * PRP-087 · Resultados de Meta, guardados POR DÍA.
 *
 * Por día y no en un único total porque el tope de gasto es mensual, y el mes
 * es el del reloj de la empresa. Con un total acumulado no se puede saber
 * cuánto se lleva gastado "este mes" sin volver a preguntar a Meta cada vez.
 */

const NIVELES = {
  campana: "campaign",
  conjunto: "adset",
  anuncio: "ad",
} as const;

export type NivelMeta = keyof typeof NIVELES;

interface FilaInsight {
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  actions?: Array<{ action_type?: string; value?: string }>;
  cost_per_action_type?: Array<{ action_type?: string; value?: string }>;
}

/**
 * Qué cuenta como "resultado" para un restaurante, en orden de preferencia.
 *
 * Meta devuelve decenas de tipos de acción a la vez (cada clic cuenta en
 * varios). Sumarlas todas infla el número hasta lo absurdo, así que se coge la
 * primera que aparezca de esta lista y solo esa.
 */
const ACCIONES_RELEVANTES = [
  "offsite_conversion.fct_purchase",
  "purchase",
  "lead",
  "onsite_conversion.messaging_conversation_started_7d",
  "link_click",
  "landing_page_view",
];

function primeraAccion(
  lista: Array<{ action_type?: string; value?: string }> | undefined,
): { tipo: string; valor: number } | null {
  if (!lista?.length) return null;
  for (const tipo of ACCIONES_RELEVANTES) {
    const encontrada = lista.find((a) => a.action_type === tipo);
    if (encontrada) {
      const valor = Number(encontrada.value ?? 0);
      if (Number.isFinite(valor)) return { tipo, valor };
    }
  }
  return null;
}

function aCentimos(euros: string | undefined): number {
  const n = Number(euros ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function aEntero(valor: string | undefined): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Trae los resultados día a día de un nivel y los vuelca al espejo.
 *
 * `desde`/`hasta` en formato aaaa-mm-dd. Por defecto, los últimos 90 días:
 * suficiente para la pantalla y para el tope del mes, sin pedirle a Meta el
 * histórico entero en cada pasada.
 */
export async function sincronizarInsights(
  admin: SupabaseClient,
  empresaId: string,
  cred: MetaCredenciales,
  nivel: NivelMeta,
  desde?: string,
  hasta?: string,
): Promise<number> {
  const zona = await getZonaHorariaEmpresa(admin, empresaId);
  const hoy = hoyEnZona(zona);
  const hastaFinal = hasta ?? hoy;
  const desdeFinal =
    desde ?? new Date(new Date(`${hoy}T00:00:00Z`).getTime() - 89 * 86_400_000).toISOString().slice(0, 10);

  const campoId =
    nivel === "campana" ? "campaign_id" : nivel === "conjunto" ? "adset_id" : "ad_id";

  const filas = await metaGetTodas<FilaInsight>(
    `/${cred.adAccountId}/insights`,
    cred.accessToken,
    {
      level: NIVELES[nivel],
      fields: `${campoId},spend,impressions,reach,clicks,actions,cost_per_action_type`,
      time_increment: 1, // un registro por día, que es justo lo que queremos
      time_range: JSON.stringify({ since: desdeFinal, until: hastaFinal }),
      limit: 500,
    },
  );

  const ahora = new Date().toISOString();
  const registros = filas
    .filter((f) => f.date_start && f[campoId as keyof FilaInsight])
    .map((f) => {
      const resultado = primeraAccion(f.actions);
      const coste = resultado
        ? primeraAccion(f.cost_per_action_type)?.valor ?? null
        : null;
      return {
        empresa_id: empresaId,
        nivel,
        meta_id: String(f[campoId as keyof FilaInsight]),
        dia: f.date_start as string,
        gasto_cent: aCentimos(f.spend),
        impresiones: aEntero(f.impressions),
        alcance: aEntero(f.reach),
        clics: aEntero(f.clicks),
        resultados: resultado?.valor ?? 0,
        coste_resultado_cent: coste != null ? Math.round(coste * 100) : null,
        raw: f as unknown as Record<string, unknown>,
        sincronizado_at: ahora,
      };
    });

  for (let i = 0; i < registros.length; i += 500) {
    const lote = registros.slice(i, i + 500);
    const { error } = await admin
      .from("meta_insights")
      .upsert(lote, { onConflict: "empresa_id,nivel,meta_id,dia" });
    if (error) throw new Error(`No se pudieron guardar los resultados: ${error.message}`);
  }

  return registros.length;
}

export interface GastoDelMes {
  gastadoCent: number;
  topeCent: number | null;
  /** true cuando ya no se puede activar nada más este mes. */
  bloqueado: boolean;
  /** Mes en curso según el reloj de la empresa, aaaa-mm. */
  mes: string;
}

/**
 * Cuánto lleva gastado la cuenta publicitaria en el mes EN CURSO del reloj de
 * la empresa, y si eso ya bloquea activar más.
 *
 * Se suma el nivel campaña, que es la suma de toda la cuenta sin contar dos
 * veces (los conjuntos y anuncios son subdivisiones del mismo gasto). Y cuenta
 * TODO, también lo lanzado directamente desde Meta: si el traffiquer se gasta
 * el presupuesto fuera del software, el tope tiene que enterarse igual.
 */
export async function getGastoDelMes(
  admin: SupabaseClient,
  empresaId: string,
  topeCent: number | null,
): Promise<GastoDelMes> {
  const zona = await getZonaHorariaEmpresa(admin, empresaId);
  const hoy = hoyEnZona(zona); // aaaa-mm-dd en la zona de la empresa
  const mes = hoy.slice(0, 7);
  const primerDia = `${mes}-01`;

  // La suma la hace Postgres, no nosotros: leyendo las filas, Supabase corta a
  // 1.000 y el gasto saldría más bajo del real, dejando pasar el tope.
  const { data, error } = await admin.rpc("meta_gasto_periodo", {
    p_empresa: empresaId,
    p_desde: primerDia,
    p_hasta: hoy,
  });

  if (error) {
    // Ante la duda con dinero, se bloquea: mejor que alguien tenga que revisar
    // el tope a mano que gastar de más porque no se pudo comprobar.
    throw new Error(`No se pudo calcular el gasto del mes: ${error.message}`);
  }

  const gastadoCent = Number(data ?? 0);

  return {
    gastadoCent,
    topeCent,
    bloqueado: topeCent != null && gastadoCent >= topeCent,
    mes,
  };
}
