import "server-only";

/**
 * Servicios del flujo «email a la gestoría → enlace tokenizado → subida de los
 * modelos de un periodo». Espejo de gestoria-contrato.ts (PRP-068), adaptado a
 * PRP-072: un enlace por periodo (trimestral o anual), la gestoría sube cada
 * modelo por separado y una IA valida que cada PDF corresponde al hueco.
 *
 * Lo usan: el cron de emails (genera el token) y la API pública de subida.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generarToken, hashToken, compararToken } from "@/features/rrhh/services/firmas/crypto";
import type { ModeloTipo, ModeloPeriodo, GrupoModelo } from "../types/modelos";
import { MODELO_LABEL, COMBOS_MODELOS_DEFAULT, grupoDeModelo } from "../types/modelos";
import { validarModeloPdfIA } from "./validar-modelo-ia";
import { getModelosConfigPorEmpresa, tiposObligatoriosEfectivos } from "./modelos-config";

const BUCKET_MODELOS = "modelos-aeat-pdf";
const MAX_PDF_BYTES = 25 * 1024 * 1024;

export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Enlace público que abre la gestoría para subir los modelos del periodo. */
export function urlSubidaModelos(token: string): string {
  return `${getSiteUrl()}/gestoria/modelos/subir/${encodeURIComponent(token)}`;
}

/** Botón HTML «Subir modelos» para el correo a la gestoría. */
export function botonSubidaModelosHtml(token: string): string {
  const url = urlSubidaModelos(token);
  return `
    <div style="margin:20px 0">
      <a href="${url}"
         style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;
                padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px">
        Subir modelos
      </a>
      <p style="color:#888;font-size:12px;margin-top:8px">
        Al pulsar verás cada modelo del periodo. Adjunta el PDF en su casilla; se
        verificará automáticamente que el documento es correcto.
      </p>
    </div>`;
}

export interface ModelosTokenRow {
  id: string;
  empresa_id: string;
  ejercicio: number;
  grupo: GrupoModelo;
  periodo: ModeloPeriodo;
}

/**
 * Crea un token de subida de modelos para un periodo y devuelve el token en
 * claro (para el correo). Se ejecuta con service role desde el cron.
 */
export async function crearTokenModelosGestoria(
  admin: SupabaseClient,
  params: {
    empresaId: string;
    ejercicio: number;
    grupo: GrupoModelo;
    periodo: ModeloPeriodo;
    plazoDias?: number;
  },
): Promise<{ ok: true; token: string; tokenId: string } | { ok: false; error: string }> {
  try {
    const plazoDias = Math.max(1, Math.min(60, params.plazoDias ?? 30));
    const token = generarToken();
    const tokenHash = hashToken(token);
    const expira = new Date(Date.now() + plazoDias * 86_400_000).toISOString();

    const { data, error } = await admin
      .from("gestoria_modelos_tokens")
      .insert({
        empresa_id: params.empresaId,
        ejercicio: params.ejercicio,
        grupo: params.grupo,
        periodo: params.periodo,
        token_hash: tokenHash,
        expira_en: expira,
        email_enviado_en: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear el token" };
    return { ok: true, token, tokenId: data.id as string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error creando token de modelos";
    return { ok: false, error: msg };
  }
}

/** Resuelve un token de subida de modelos (multi-uso hasta expirar/completar). */
export async function resolverTokenModelosGestoria(
  admin: SupabaseClient,
  token: string,
): Promise<
  | { ok: true; row: ModelosTokenRow }
  | { ok: false; reason: "not_found" | "expired" | "completed" }
> {
  const tokenHash = hashToken(token);
  const { data } = await admin
    .from("gestoria_modelos_tokens")
    .select("id, empresa_id, ejercicio, grupo, periodo, token_hash, expira_en, completado_en")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (!compararToken(token, data.token_hash as string)) return { ok: false, reason: "not_found" };
  if (data.completado_en) return { ok: false, reason: "completed" };
  if (new Date(data.expira_en as string).getTime() < Date.now()) return { ok: false, reason: "expired" };
  return {
    ok: true,
    row: {
      id: data.id as string,
      empresa_id: data.empresa_id as string,
      ejercicio: data.ejercicio as number,
      grupo: data.grupo as GrupoModelo,
      periodo: data.periodo as ModeloPeriodo,
    },
  };
}

export interface ModeloDelPeriodo {
  tipo: ModeloTipo;
  label: string;
  periodo: ModeloPeriodo;
  /** Ya está en el software (subido y confirmado en modelos_aeat). */
  yaEnSoftware: boolean;
  /** Adjuntado y validado en staging, pendiente de confirmar. */
  enStaging: boolean;
  /** Validación IA OK del que está en staging. */
  iaOk: boolean;
  iaMotivo: string | null;
  /** Es obligatorio subirlo para poder confirmar. */
  obligatorio: boolean;
}

/** Tipos esperados en el enlace según el grupo del token. */
function tiposEsperadosDelToken(row: ModelosTokenRow): ModeloTipo[] {
  return COMBOS_MODELOS_DEFAULT.filter((c) => {
    if (row.grupo === "TRIMESTRALES")
      return c.periodo === row.periodo && grupoDeModelo(c.tipo) === "TRIMESTRALES";
    return c.periodo === "ANUAL" && grupoDeModelo(c.tipo) === "ANUALES";
  }).map((c) => c.tipo);
}

/**
 * Devuelve los modelos del enlace con su estado: ya-en-software, en-staging
 * (pendiente de confirmar) y si son obligatorios (según config de la empresa).
 */
export async function listarModelosDelToken(
  admin: SupabaseClient,
  row: ModelosTokenRow,
): Promise<ModeloDelPeriodo[]> {
  const tipos = tiposEsperadosDelToken(row);

  // Config de obligatorios/visibles de la empresa.
  const cfg = await getModelosConfigPorEmpresa(admin, row.empresa_id);
  const obligatorios = tiposObligatoriosEfectivos(cfg, tipos);

  // Ya en software.
  const { data: existentes } = await admin
    .from("modelos_aeat")
    .select("tipo, pdf_url")
    .eq("empresa_id", row.empresa_id)
    .eq("ejercicio", row.ejercicio)
    .eq("periodo", row.periodo);
  const yaSoftware = new Set(
    ((existentes ?? []) as Array<{ tipo: string; pdf_url: string | null }>)
      .filter((m) => m.pdf_url)
      .map((m) => m.tipo),
  );

  // En staging.
  const { data: staging } = await admin
    .from("gestoria_modelos_staging")
    .select("tipo, ia_ok, ia_motivo")
    .eq("token_id", row.id);
  const stagingPorTipo = new Map<string, { ia_ok: boolean; ia_motivo: string | null }>();
  for (const s of (staging ?? []) as Array<{ tipo: string; ia_ok: boolean; ia_motivo: string | null }>) {
    stagingPorTipo.set(s.tipo, { ia_ok: s.ia_ok, ia_motivo: s.ia_motivo });
  }

  return tipos.map((tipo) => {
    const st = stagingPorTipo.get(tipo);
    return {
      tipo,
      label: MODELO_LABEL[tipo],
      periodo: row.periodo,
      yaEnSoftware: yaSoftware.has(tipo),
      enStaging: Boolean(st),
      iaOk: st?.ia_ok ?? false,
      iaMotivo: st?.ia_motivo ?? null,
      obligatorio: obligatorios.includes(tipo),
    };
  });
}

/**
 * Adjunta UN modelo en STAGING: valida el PDF con IA y lo guarda en una zona
 * temporal del token. NO entra a modelos_aeat todavía (subida todo-o-nada).
 * La validación IA se hace al momento para dar feedback inmediato.
 */
export async function stagingSubidaModelo(
  admin: SupabaseClient,
  row: ModelosTokenRow,
  tipo: ModeloTipo,
  file: File,
): Promise<
  | { ok: true; iaMotivo: string }
  | { ok: false; error: string; status: number; iaMotivo?: string }
> {
  if (file.type !== "application/pdf") return { ok: false, error: "El modelo debe ser un PDF", status: 400 };
  if (file.size === 0) return { ok: false, error: "Adjunta el modelo (PDF)", status: 400 };
  if (file.size > MAX_PDF_BYTES) return { ok: false, error: "El PDF supera 25 MB", status: 400 };

  const buffer = Buffer.from(await file.arrayBuffer());

  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre, razon_social, nif")
    .eq("id", row.empresa_id)
    .maybeSingle();

  // Validación IA (feedback inmediato). No coincide → se rechaza, no se guarda.
  const ia = await validarModeloPdfIA({
    buffer,
    esperado: {
      tipo,
      ejercicio: row.ejercicio,
      periodo: row.periodo,
      nif: (empresa?.nif as string | null) ?? null,
      razonSocial:
        (empresa?.razon_social as string | null) ?? (empresa?.nombre as string | null) ?? null,
    },
  });
  if (!ia.coincide) {
    return {
      ok: false,
      status: 422,
      error: "El documento no coincide con el modelo solicitado",
      iaMotivo: ia.motivo,
    };
  }

  // Subida a staging: staging/<token_id>/<tipo>.pdf (upsert para reemplazos).
  const stagingPath = `staging/${row.id}/${tipo}.pdf`;
  const { error: upErr } = await admin.storage
    .from(BUCKET_MODELOS)
    .upload(stagingPath, buffer, { contentType: "application/pdf", upsert: true });
  if (upErr) return { ok: false, error: `No se pudo guardar el PDF: ${upErr.message}`, status: 500 };

  const { error: stErr } = await admin.from("gestoria_modelos_staging").upsert(
    { token_id: row.id, tipo, staging_path: stagingPath, ia_ok: true, ia_motivo: ia.motivo },
    { onConflict: "token_id,tipo" },
  );
  if (stErr) {
    await admin.storage.from(BUCKET_MODELOS).remove([stagingPath]);
    return { ok: false, error: `No se pudo registrar el documento: ${stErr.message}`, status: 500 };
  }

  await admin
    .from("gestoria_modelos_tokens")
    .update({
      primer_uso_en:
        (row as { primer_uso_en?: string }).primer_uso_en ?? new Date().toISOString(),
    })
    .eq("id", row.id)
    .is("primer_uso_en", null);

  return { ok: true, iaMotivo: ia.motivo };
}

/**
 * CONFIRMA la subida (todo-o-nada): si faltan modelos OBLIGATORIOS en staging,
 * no confirma nada y devuelve la lista de los que faltan. Si están todos, mueve
 * cada PDF de staging a su path final y hace upsert en modelos_aeat, marca el
 * token completado y limpia el staging.
 */
export async function confirmarSubidaModelos(
  admin: SupabaseClient,
  row: ModelosTokenRow,
): Promise<
  | { ok: true; confirmados: number }
  | { ok: false; error: string; status: number; faltan?: string[] }
> {
  const modelos = await listarModelosDelToken(admin, row);

  // Obligatorios que aún no están ni en software ni en staging (con IA OK).
  const faltan = modelos
    .filter((m) => m.obligatorio && !m.yaEnSoftware && !(m.enStaging && m.iaOk))
    .map((m) => m.label);
  if (faltan.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "Debes subir TODOS los modelos obligatorios antes de enviar.",
      faltan,
    };
  }

  // Modelos en staging listos para confirmar.
  const { data: staging } = await admin
    .from("gestoria_modelos_staging")
    .select("tipo, staging_path, ia_ok")
    .eq("token_id", row.id)
    .eq("ia_ok", true);

  let confirmados = 0;
  for (const s of (staging ?? []) as Array<{ tipo: string; staging_path: string }>) {
    const finalPath = `${row.empresa_id}/${row.ejercicio}/${row.periodo}/${s.tipo}_${Date.now()}.pdf`;
    // Copiar de staging a la ruta final (move no siempre disponible entre prefijos).
    const { error: mvErr } = await admin.storage
      .from(BUCKET_MODELOS)
      .move(s.staging_path, finalPath);
    if (mvErr) {
      // Si move falla, intentamos copy+remove implícito vía descarga.
      const { data: blob } = await admin.storage.from(BUCKET_MODELOS).download(s.staging_path);
      if (!blob) continue;
      const buf = Buffer.from(await blob.arrayBuffer());
      const { error: upErr } = await admin.storage
        .from(BUCKET_MODELOS)
        .upload(finalPath, buf, { contentType: "application/pdf", upsert: true });
      if (upErr) continue;
      await admin.storage.from(BUCKET_MODELOS).remove([s.staging_path]);
    }

    // Upsert de la fila con el PDF definitivo.
    await admin.from("modelos_aeat").upsert(
      {
        empresa_id: row.empresa_id,
        tipo: s.tipo,
        periodo: row.periodo,
        ejercicio: row.ejercicio,
        estado: "PRESENTADO",
        pdf_url: finalPath,
        ia_corrida_en: new Date().toISOString(),
      },
      { onConflict: "empresa_id,tipo,periodo,ejercicio" },
    );
    confirmados++;
  }

  // Limpiar staging y marcar token completado.
  await admin.from("gestoria_modelos_staging").delete().eq("token_id", row.id);
  await admin
    .from("gestoria_modelos_tokens")
    .update({ completado_en: new Date().toISOString(), modelos_subidos: confirmados })
    .eq("id", row.id);

  return { ok: true, confirmados };
}
