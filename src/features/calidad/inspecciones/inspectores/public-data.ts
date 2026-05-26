/**
 * Lectura pública de la bolsa de inspectores por empresa-slug.
 * Mismo patrón que /carta/[slug]: admin client + branding empresa.
 * PRP-040.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BolsaCamposActivos,
  BolsaConfig,
  BolsaPublicaEmpresa,
} from "./types";
import { BOLSA_CONFIG_DEFAULTS, mergeCamposActivos } from "./types";

export async function fetchBolsaPublicaEmpresa(
  slug: string,
): Promise<BolsaPublicaEmpresa | null> {
  if (!slug) return null;
  const admin = createAdminClient();

  const { data: empresa } = await admin
    .from("empresas")
    .select("id, slug, nombre, logo_url, color, color_secundario, color_texto")
    .eq("slug", slug)
    .maybeSingle();
  if (!empresa) return null;

  const { data: cfg } = await admin
    .from("inspecciones_bolsa_config")
    .select("*")
    .eq("empresa_id", empresa.id)
    .maybeSingle();

  // Bolsa desactivada → tratamos como inexistente (404 público).
  if (cfg && cfg.activa === false) return null;

  const config: BolsaConfig = cfg
    ? {
        activa: cfg.activa,
        titulo_seccion: cfg.titulo_seccion,
        titulo_principal: cfg.titulo_principal,
        descripcion: cfg.descripcion,
        mensaje_exito_titulo: cfg.mensaje_exito_titulo,
        mensaje_exito_texto: cfg.mensaje_exito_texto,
        texto_boton: cfg.texto_boton,
        color_fondo: cfg.color_fondo,
        color_acento: cfg.color_acento,
        color_texto: cfg.color_texto,
        campos_activos: mergeCamposActivos(
          cfg.campos_activos as Partial<BolsaCamposActivos> | null,
        ),
      }
    : { ...BOLSA_CONFIG_DEFAULTS };

  return {
    empresa: {
      id: empresa.id,
      slug: empresa.slug,
      nombre: empresa.nombre,
      logo_url: empresa.logo_url ?? null,
      color: empresa.color ?? null,
      color_secundario: empresa.color_secundario ?? null,
      color_texto: empresa.color_texto ?? null,
    },
    config,
  };
}
