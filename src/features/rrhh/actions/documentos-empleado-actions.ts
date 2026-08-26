"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { MAX_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES } from "@/shared/lib/documentos";

/**
 * Subida MANUAL de la documentación identificativa de un empleado, desde su
 * ficha de RRHH.
 *
 * Quien entra por el proceso de selección ya trae estos documentos: los aporta
 * como candidato y se copian a su ficha al contratarlo. Pero un alta hecha a
 * mano no pasa por ahí, y hasta ahora la ficha era SOLO LECTURA: no había forma
 * de adjuntarle el DNI ni el justificante de la cuenta.
 */

const BUCKET = "empleados-docs";

/** Los cuatro documentos de la ficha y la columna donde se guarda cada ruta. */
const TIPOS = {
  dni_anverso: "doc_dni_anverso_path",
  dni_reverso: "doc_dni_reverso_path",
  iban: "doc_iban_path",
  ss: "doc_ss_path",
} as const;

export type TipoDocumentoEmpleado = keyof typeof TIPOS;

const EXT_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export async function subirDocumentoEmpleado(input: {
  empleadoId: string;
  tipo: TipoDocumentoEmpleado;
  file: File;
}): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    // El tipo compone la ruta del fichero: se acota a los cuatro válidos para
    // que no pueda usarse para escribir fuera de su sitio.
    const columna = TIPOS[input.tipo];
    if (!columna) return { ok: false, error: "Tipo de documento no válido" };

    if (!input.file || input.file.size === 0) {
      return { ok: false, error: "No se ha recibido ningún archivo" };
    }
    if (input.file.size > MAX_DOCUMENTO_BYTES) {
      return { ok: false, error: `El archivo supera ${MAX_DOCUMENTO_MB} MB` };
    }
    const ext = EXT_POR_TIPO[input.file.type];
    if (!ext) {
      return { ok: false, error: "Formato no admitido. Sube una imagen (JPG, PNG) o un PDF." };
    }

    const { supabase } = await getAppContext();

    // La empresa sale de la ficha, no del cliente: así el archivo no puede
    // acabar en la carpeta de otra empresa.
    const { data: emp } = await supabase
      .from("empleados")
      .select("id, empresa_id")
      .eq("id", input.empleadoId)
      .maybeSingle();
    if (!emp) return { ok: false, error: "Empleado no encontrado" };

    const path = `${emp.empresa_id}/${emp.id}/${input.tipo}.${ext}`;
    const buffer = Buffer.from(await input.file.arrayBuffer());
    const { error: errSubida } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: input.file.type, upsert: true });
    if (errSubida) return { ok: false, error: errSubida.message };

    const { error } = await supabase
      .from("empleados")
      .update({ [columna]: path })
      .eq("id", input.empleadoId);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/rrhh/empleados/${input.empleadoId}`);
    return { ok: true, path };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[documentos-empleado] subir:", msg);
    return { ok: false, error: msg };
  }
}
