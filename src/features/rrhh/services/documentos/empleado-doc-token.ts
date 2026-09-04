import "server-only";

/**
 * Enlace PROPIO de cada empleado para subir su documentación a su ficha.
 *
 * El circuito manual era: el trabajador manda el documento por correo, RRHH lo
 * reenvía a Dirección y Dirección lo sube a la ficha. Lento, y con los datos
 * bancarios pasando por varios buzones — en el envío del 4-sep-2026 los
 * empleados iban todos en copia y, al responder en cadena, cada uno acabó
 * viendo el certificado bancario de los anteriores.
 *
 * Con este enlace el empleado sube el documento y entra DIRECTO en su ficha:
 * sin intermediarios y sin que nadie más lo vea.
 *
 * Token hash-only y validación en tiempo constante, igual que la subida de la
 * gestoría (`gestoria-baja-documentos.ts`), porque el enlace se abre sin sesión.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generarToken, hashToken, compararToken } from "@/features/rrhh/services/firmas/crypto";
import { getSiteUrl } from "@/lib/site-url";
import { MAX_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES } from "@/shared/lib/documentos";

const BUCKET_EMPLEADO = "empleados-docs";

/** Días que vive el enlace. Suficiente para pedir el papel al banco sin prisa. */
const DIAS_VALIDEZ = 30;

/** Los cuatro documentos identificativos, con la columna que guarda su ruta. */
export const DOCS_EMPLEADO = {
  dni_anverso: { columna: "doc_dni_anverso_path", label: "DNI/NIE (anverso)" },
  dni_reverso: { columna: "doc_dni_reverso_path", label: "DNI/NIE (reverso)" },
  iban: { columna: "doc_iban_path", label: "Certificado bancario" },
  ss: { columna: "doc_ss_path", label: "Documento de la Seguridad Social" },
} as const;

export type TipoDocEmpleado = keyof typeof DOCS_EMPLEADO;

/** Formatos admitidos y su extensión. Mismo criterio que la subida manual. */
const EXT_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

/** Enlace público donde el empleado sube su documento. */
export function urlSubidaDocEmpleado(token: string): string {
  return `${getSiteUrl()}/documentos/${encodeURIComponent(token)}`;
}

export interface DocEmpleadoRow {
  id: string;
  empresa_id: string;
  empleado_id: string;
  tipo_doc: TipoDocEmpleado;
  subido_en: string | null;
}

/**
 * Crea (o renueva) el enlace de subida de un documento para un empleado.
 *
 * Hay un único enlace vivo por empleado y tipo: al reenviar la petición se
 * reemplaza el token anterior en vez de dejar varios enlaces válidos sueltos.
 */
export async function crearTokenDocEmpleado(
  admin: SupabaseClient,
  params: { empresaId: string; empleadoId: string; tipoDoc: TipoDocEmpleado },
): Promise<{ ok: true; token: string; url: string; expiraEn: string } | { ok: false; error: string }> {
  try {
    const token = generarToken();
    const tokenHash = hashToken(token);
    const expira = new Date(Date.now() + DIAS_VALIDEZ * 86_400_000).toISOString();

    const { error } = await admin.from("empleado_doc_tokens").upsert(
      {
        empresa_id: params.empresaId,
        empleado_id: params.empleadoId,
        tipo_doc: params.tipoDoc,
        token_hash: tokenHash,
        expira_en: expira,
        enviado_en: new Date().toISOString(),
        // Renovar el enlace reabre la petición: se limpian los ticks anteriores.
        recordatorio_en: null,
        subido_en: null,
        doc_path: null,
      },
      { onConflict: "empleado_id,tipo_doc" },
    );
    if (error) return { ok: false, error: error.message };

    return { ok: true, token, url: urlSubidaDocEmpleado(token), expiraEn: expira };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error creando el enlace";
    return { ok: false, error: msg };
  }
}

/** Resuelve el token del enlace. Sigue siendo válido tras subir: si el
 *  documento sale mal, el empleado puede repetirlo sin pedir enlace nuevo. */
export async function resolverTokenDocEmpleado(
  admin: SupabaseClient,
  token: string,
): Promise<{ ok: true; row: DocEmpleadoRow } | { ok: false; reason: "not_found" | "expired" }> {
  const tokenHash = hashToken(token);
  const { data } = await admin
    .from("empleado_doc_tokens")
    .select("id, empresa_id, empleado_id, tipo_doc, token_hash, expira_en, subido_en")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (!compararToken(token, data.token_hash as string)) return { ok: false, reason: "not_found" };
  if (new Date(data.expira_en as string).getTime() < Date.now()) return { ok: false, reason: "expired" };
  return {
    ok: true,
    row: {
      id: data.id as string,
      empresa_id: data.empresa_id as string,
      empleado_id: data.empleado_id as string,
      tipo_doc: data.tipo_doc as TipoDocEmpleado,
      subido_en: data.subido_en as string | null,
    },
  };
}

/**
 * Núcleo de la subida: valida el archivo, lo guarda en la carpeta del empleado
 * y lo enlaza en su ficha.
 *
 * La ruta es la MISMA que usa la subida manual desde RRHH
 * (`{empresa}/{empleado}/{tipo}.{ext}`), para que el documento se vea en la
 * ficha sin ningún tratamiento especial por haber llegado de fuera.
 */
export async function procesarSubidaDocEmpleado(
  admin: SupabaseClient,
  row: DocEmpleadoRow,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const meta = DOCS_EMPLEADO[row.tipo_doc];
  if (!meta) return { ok: false, error: "Documento no reconocido", status: 400 };
  if (!file || file.size === 0) return { ok: false, error: "Adjunta el documento", status: 400 };
  if (file.size > MAX_DOCUMENTO_BYTES) {
    return { ok: false, error: `El archivo supera ${MAX_DOCUMENTO_MB} MB`, status: 400 };
  }
  const ext = EXT_POR_TIPO[file.type];
  if (!ext) {
    return {
      ok: false,
      error: "Formato no admitido. Sube una imagen (JPG, PNG) o un PDF.",
      status: 400,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `${row.empresa_id}/${row.empleado_id}/${row.tipo_doc}.${ext}`;

  const { error: upErr } = await admin.storage
    .from(BUCKET_EMPLEADO)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (upErr) {
    return { ok: false, error: `No se pudo guardar el documento: ${upErr.message}`, status: 500 };
  }

  // La ficha apunta al archivo recién subido. Se filtra por empresa además de
  // por id: el token ya trae ambos y así la escritura no puede desviarse.
  const { error: updErr } = await admin
    .from("empleados")
    .update({ [meta.columna]: path })
    .eq("id", row.empleado_id)
    .eq("empresa_id", row.empresa_id);
  if (updErr) {
    return { ok: false, error: `No se pudo enlazar en la ficha: ${updErr.message}`, status: 500 };
  }

  await admin
    .from("empleado_doc_tokens")
    .update({ subido_en: new Date().toISOString(), doc_path: path })
    .eq("id", row.id);

  return { ok: true };
}
