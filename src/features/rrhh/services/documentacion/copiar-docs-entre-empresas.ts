import "server-only";

/**
 * Duplica la documentación identificativa de un empleado a su ficha de OTRA
 * empresa del grupo.
 *
 * Por qué hace falta: al añadir a alguien a una segunda empresa se copian sus
 * DATOS (DNI, IBAN, Seguridad Social, dirección) pero no sus ARCHIVOS, porque el
 * almacén está separado por empresa — `empleados-docs` guarda en
 * `{empresa_id}/{empleado_id}/…` y la ruta lleva la empresa dentro. Resultado: la
 * ficha nueva nacía con todos los datos y sin un solo documento, y a esa persona
 * el sistema le volvía a pedir el DNI que ya había entregado. Le pasó a Iván
 * Ballesteros, con documentos en BACANAL y la ficha de HABANA vacía.
 *
 * Copia FÍSICA, igual que la del candidato al contratar: cada empresa se queda
 * con su propio ejemplar. Así una empresa no depende de los archivos de la otra
 * y `/api/empleados/doc` —que rechaza cualquier ruta que no empiece por la
 * empresa activa— puede servirlos con normalidad.
 *
 * Best-effort: NUNCA lanza. Copiar a un empleado a otra empresa es la operación
 * importante; si un archivo no se puede duplicar se anota y se sigue, que peor
 * que una ficha sin documentos es una copia de empleado a medio hacer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "empleados-docs";

/** Los cuatro documentos de la ficha y la columna que guarda cada ruta. */
const DOCS = [
  { tipo: "dni_anverso", columna: "doc_dni_anverso_path" },
  { tipo: "dni_reverso", columna: "doc_dni_reverso_path" },
  { tipo: "iban", columna: "doc_iban_path" },
  { tipo: "ss", columna: "doc_ss_path" },
] as const;

/** Extensión (con punto) de una ruta de almacén, o cadena vacía. */
function extDe(path: string): string {
  const base = path.split("/").pop() ?? "";
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i) : "";
}

export async function copiarDocsEntreEmpresas(
  admin: SupabaseClient,
  params: {
    /** Ficha de la que se copian los documentos. */
    empleadoOrigenId: string;
    /** Ficha recién creada en la otra empresa. */
    empleadoDestinoId: string;
    empresaDestinoId: string;
  },
): Promise<{ copiados: number }> {
  let copiados = 0;

  try {
    const { data: origen } = await admin
      .from("empleados")
      .select("doc_dni_anverso_path, doc_dni_reverso_path, doc_iban_path, doc_ss_path")
      .eq("id", params.empleadoOrigenId)
      .maybeSingle();
    if (!origen) return { copiados: 0 };

    const patch: Record<string, string> = {};

    for (const doc of DOCS) {
      const rutaOrigen = (origen as Record<string, unknown>)[doc.columna] as string | null;
      if (!rutaOrigen) continue;

      const { data: archivo, error: errBajada } = await admin.storage
        .from(BUCKET)
        .download(rutaOrigen);
      if (errBajada || !archivo) {
        console.error(`[docs-entre-empresas] no se pudo leer ${rutaOrigen}:`, errBajada?.message);
        continue;
      }

      const destino = `${params.empresaDestinoId}/${params.empleadoDestinoId}/${doc.tipo}${extDe(rutaOrigen)}`;
      const buffer = Buffer.from(await archivo.arrayBuffer());
      const { error: errSubida } = await admin.storage
        .from(BUCKET)
        .upload(destino, buffer, {
          contentType: archivo.type || "application/octet-stream",
          upsert: true,
        });
      if (errSubida) {
        console.error(`[docs-entre-empresas] no se pudo escribir ${destino}:`, errSubida.message);
        continue;
      }

      patch[doc.columna] = destino;
      copiados += 1;
    }

    if (Object.keys(patch).length > 0) {
      await admin
        .from("empleados")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", params.empleadoDestinoId);
    }
  } catch (e) {
    console.error("[docs-entre-empresas] fallo copiando documentación:", e);
  }

  return { copiados };
}
