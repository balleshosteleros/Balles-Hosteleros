/**
 * Copia la documentación aportada por el candidato (paso «Documentación» del
 * reclutamiento) a la ficha del EMPLEADO al contratar. Copia FÍSICA: los archivos
 * se duplican en el bucket privado `empleados-docs`, de modo que el empleado
 * conserva sus documentos aunque el candidato se borre en el futuro. Los
 * documentos NO se eliminan del candidato (quedan también en reclutamiento).
 *
 * · Documentos identificativos (DNI/NIE anverso+reverso, IBAN, SS) →
 *   bucket `empleados-docs`, path <empresa_id>/<empleado_id>/<tipo>.<ext>,
 *   y sus paths en `empleados.doc_*_path`.
 * · Foto de perfil → bucket público `avatars`, y su URL en `usuarios.avatar_url`
 *   (avatar permanente del empleado). Se marca `avatar_obligatorio = false`.
 *
 * Best-effort: nunca lanza. La contratación ya está hecha; si algún archivo no
 * se puede copiar, se registra en consola y se continúa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_DOC_CANDIDATOS } from "@/features/rrhh/lib/documentacion-candidato";

const BUCKET_EMPLEADOS_DOCS = "empleados-docs";
const BUCKET_AVATARS = "avatars";

/** Extensión (con punto) de un path de storage, o cadena vacía. */
function extDe(path: string): string {
  const base = path.split("/").pop() ?? "";
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i) : "";
}

/**
 * Descarga un objeto del bucket origen y lo sube al bucket destino. Devuelve el
 * path destino, o null si no había origen o falló la copia.
 */
async function copiarObjeto(
  supabase: SupabaseClient,
  origenBucket: string,
  origenPath: string | null | undefined,
  destinoBucket: string,
  destinoPath: string,
): Promise<{ path: string; contentType: string } | null> {
  if (!origenPath) return null;
  const { data, error } = await supabase.storage.from(origenBucket).download(origenPath);
  if (error || !data) {
    console.error(`[docs→empleado] descarga ${origenPath}:`, error?.message);
    return null;
  }
  const contentType = data.type || "application/octet-stream";
  const buffer = Buffer.from(await data.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(destinoBucket)
    .upload(destinoPath, buffer, { contentType, upsert: true });
  if (upErr) {
    console.error(`[docs→empleado] subida ${destinoPath}:`, upErr.message);
    return null;
  }
  return { path: destinoPath, contentType };
}

/**
 * Copia documentos + foto del candidato al empleado. Usa un cliente service-role
 * (ignora RLS). `candidatoId` puede ser null si se llama en una reactivación sin
 * candidato ligado (no hace nada en ese caso).
 */
export async function copiarDocumentacionCandidatoAEmpleado(params: {
  admin: SupabaseClient;
  empresaId: string;
  candidatoId: string;
  empleadoId: string;
  /** user_id del empleado, para fijar su avatar (si tiene cuenta de acceso). */
  userId: string | null;
}): Promise<void> {
  const { admin, empresaId, candidatoId, empleadoId, userId } = params;
  try {
    const { data: cand } = await admin
      .from("candidatos")
      .select(
        "doc_dni_anverso_path, doc_dni_reverso_path, doc_iban_path, doc_ss_path, foto_perfil_path",
      )
      .eq("id", candidatoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!cand) return;

    // 1) Documentos identificativos → empleados-docs + columnas del empleado.
    const tipos: Array<{ campoCand: string; campoEmp: string; tipo: string }> = [
      { campoCand: "doc_dni_anverso_path", campoEmp: "doc_dni_anverso_path", tipo: "dni_anverso" },
      { campoCand: "doc_dni_reverso_path", campoEmp: "doc_dni_reverso_path", tipo: "dni_reverso" },
      { campoCand: "doc_iban_path", campoEmp: "doc_iban_path", tipo: "iban" },
      { campoCand: "doc_ss_path", campoEmp: "doc_ss_path", tipo: "ss" },
    ];
    const updateEmpleado: Record<string, string> = {};
    for (const t of tipos) {
      const origen = (cand as Record<string, string | null>)[t.campoCand];
      if (!origen) continue;
      const destino = `${empresaId}/${empleadoId}/${t.tipo}${extDe(origen)}`;
      const res = await copiarObjeto(admin, BUCKET_DOC_CANDIDATOS, origen, BUCKET_EMPLEADOS_DOCS, destino);
      if (res) updateEmpleado[t.campoEmp] = res.path;
    }
    if (Object.keys(updateEmpleado).length > 0) {
      await admin.from("empleados").update(updateEmpleado).eq("id", empleadoId);
    }

    // 2) Foto de perfil → avatar permanente (bucket público avatars).
    const fotoOrigen = (cand as Record<string, string | null>).foto_perfil_path;
    if (fotoOrigen && userId) {
      const destino = `${userId}/reclutamiento-${Date.now()}${extDe(fotoOrigen)}`;
      const res = await copiarObjeto(admin, BUCKET_DOC_CANDIDATOS, fotoOrigen, BUCKET_AVATARS, destino);
      if (res) {
        const { data: pub } = admin.storage.from(BUCKET_AVATARS).getPublicUrl(destino);
        if (pub?.publicUrl) {
          // Avatar de SESIÓN (usuarios): la foto que ve el propio empleado.
          await admin
            .from("usuarios")
            .update({ avatar_url: pub.publicUrl, avatar_obligatorio: false, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
          // Avatar de la FICHA (empleados): lo que ve RRHH en la ficha del empleado.
          await admin
            .from("empleados")
            .update({ avatar_url: pub.publicUrl })
            .eq("id", empleadoId);
        }
      }
    }
  } catch (err) {
    console.error("[docs→empleado] fatal:", err);
  }
}
