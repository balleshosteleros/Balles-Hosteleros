"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CategoriaDocumento =
  | "nominas"
  | "contratos"
  | "justificantes"
  | "registros-jornada"
  | "sanciones";

export interface DocumentoEmpleado {
  id: string;
  categoria: CategoriaDocumento;
  nombre: string;
  tipoMime: string | null;
  tamanoBytes: number | null;
  fecha: string; // YYYY-MM-DD
}

/** Documentos personales del empleado autenticado, agrupados por categoría. */
export async function listMisDocumentos(): Promise<{
  ok: boolean;
  data: Record<CategoriaDocumento, DocumentoEmpleado[]>;
}> {
  const vacio: Record<CategoriaDocumento, DocumentoEmpleado[]> = {
    nominas: [],
    contratos: [],
    justificantes: [],
    "registros-jornada": [],
    sanciones: [],
  };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: true, data: vacio };

    // La RLS ya limita a los documentos del propio empleado.
    const { data, error } = await supabase
      .from("documentos_empleado")
      .select("id, categoria, nombre, tipo_mime, tamano_bytes, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const grupos: Record<CategoriaDocumento, DocumentoEmpleado[]> = {
      nominas: [],
      contratos: [],
      justificantes: [],
      "registros-jornada": [],
      sanciones: [],
    };
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        categoria: CategoriaDocumento;
        nombre: string;
        tipo_mime: string | null;
        tamano_bytes: number | null;
        created_at: string;
      };
      if (!grupos[r.categoria]) continue;
      grupos[r.categoria].push({
        id: r.id,
        categoria: r.categoria,
        nombre: r.nombre,
        tipoMime: r.tipo_mime,
        tamanoBytes: r.tamano_bytes,
        fecha: (r.created_at ?? "").slice(0, 10),
      });
    }
    // Las NÓMINAS no viven en `documentos_empleado`: están en `rrhh_pagos_nominas`
    // (+ bucket `rrhh-nominas`), que es donde las deja el volcado de la gestoría.
    // Se listan aquí para que el empleado las vea en su carpeta, sin duplicar
    // ficheros. La RLS solo devuelve las SUYAS y solo de meses CONFIRMADOS por
    // RRHH: mientras el mes está en borrador, no debe verlas.
    const { data: nominas } = await supabase
      .from("rrhh_pagos_nominas")
      .select("id, periodo, orden, created_at, nomina_path")
      .not("nomina_path", "is", null)
      .neq("revision_estado", "denegada")
      .order("periodo", { ascending: false })
      .order("orden", { ascending: true });

    for (const row of nominas ?? []) {
      const r = row as { id: string; periodo: string; orden: number; created_at: string };
      // Varias nóminas del mismo mes (p.ej. finiquito + normal) se numeran para
      // que el empleado las distinga.
      const total = (nominas ?? []).filter((x) => (x as { periodo: string }).periodo === r.periodo).length;
      const sufijo = total > 1 ? ` (${(r.orden ?? 0) + 1} de ${total})` : "";
      grupos.nominas.push({
        id: `nom:${r.id}`,
        categoria: "nominas",
        nombre: `Nómina ${nombreMesPeriodo(r.periodo)}${sufijo}`,
        tipoMime: "application/pdf",
        tamanoBytes: null,
        fecha: (r.created_at ?? "").slice(0, 10),
      });
    }

    return { ok: true, data: grupos };
  } catch (err) {
    console.error("[mi-panel] listMisDocumentos:", err);
    return { ok: false, data: vacio };
  }
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-07" → "julio 2026". */
function nombreMesPeriodo(periodo: string): string {
  const [y, m] = (periodo ?? "").split("-");
  const mes = MESES_ES[Number(m) - 1];
  return mes ? `${mes} ${y}` : periodo;
}

/**
 * URL firmada (1h) para descargar un documento del empleado. Verifica primero
 * vía RLS que el documento es suyo; la firma se genera con cliente admin para
 * no depender de políticas de storage por carpeta.
 */
export async function getDocumentoEmpleadoUrl(
  documentoId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado" };

    // Las nóminas viven en otra tabla y otro bucket: se marcan con el prefijo
    // "nom:" al listarlas. La RLS de `rrhh_pagos_nominas` es la que garantiza que
    // solo llega si es SUYA y de un mes ya confirmado por RRHH.
    if (documentoId.startsWith("nom:")) {
      const nominaId = documentoId.slice(4);
      const { data: nom, error: nErr } = await supabase
        .from("rrhh_pagos_nominas")
        .select("nomina_path")
        .eq("id", nominaId)
        .maybeSingle();
      if (nErr) throw nErr;
      const path = (nom as { nomina_path: string | null } | null)?.nomina_path ?? null;
      if (!path) return { ok: false, error: "Nómina no disponible" };

      const adminN = createAdminClient();
      const { data: signedN, error: sErrN } = await adminN.storage
        .from("rrhh-nominas")
        .createSignedUrl(path, 60 * 60);
      if (sErrN) throw sErrN;
      return { ok: true, url: signedN?.signedUrl };
    }

    // RLS garantiza que solo recupera el documento si es del propio empleado.
    const { data: doc, error } = await supabase
      .from("documentos_empleado")
      .select("storage_path")
      .eq("id", documentoId)
      .maybeSingle();
    if (error) throw error;
    if (!doc) return { ok: false, error: "Documento no disponible" };

    const admin = createAdminClient();
    const { data: signed, error: sErr } = await admin.storage
      .from("empleados-docs")
      .createSignedUrl((doc as { storage_path: string }).storage_path, 60 * 60);
    if (sErr) throw sErr;
    return { ok: true, url: signed?.signedUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[mi-panel] getDocumentoEmpleadoUrl:", msg);
    return { ok: false, error: msg };
  }
}
