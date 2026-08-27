"use server";

/**
 * PRP-079 — Uso de almacenamiento de la galería de Archivos.
 *
 * Cuenta contra la MISMA cuota por empresa que las grabaciones
 * (`storage_usage_por_empresa`, 500 GB por defecto): el almacén es uno solo.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

export interface UsoArchivos {
  /** Bytes ocupados por la galería de Archivos. */
  bytesArchivos: number;
  /** Bytes ocupados en total por la empresa (incluye grabaciones). */
  bytesTotal: number;
  /** Cuota contratada. */
  bytesLimite: number;
  /** Número de fotos y vídeos guardados. */
  numArchivos: number;
  /** Desglose por departamento, de mayor a menor. */
  porDepartamento: Array<{ departamento: string; bytes: number; num: number }>;
}

export async function getUsoArchivos(): Promise<
  { ok: true; data: UsoArchivos } | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado" };

    const empresaId = await getEmpresaActivaForUser(supabase, user.id);
    if (!empresaId) return { ok: false, error: "Sin empresa activa" };

    const admin = createAdminClient();

    const [{ data: usage }, { data: filas }, { data: raices }] = await Promise.all([
      admin
        .from("storage_usage_por_empresa")
        .select("bytes_used, bytes_limit")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
      admin
        .from("documentos")
        .select("departamento, tamano_bytes")
        .eq("empresa_id", empresaId)
        .not("r2_key", "is", null),
      // `documentos.departamento` guarda la clave canónica (RRHH, LOGISTICA…).
      // Para mostrarla usamos el nombre legible de su carpeta raíz.
      admin
        .from("carpetas_documentos")
        .select("departamento, nombre")
        .eq("empresa_id", empresaId)
        .eq("es_raiz", true),
    ]);

    const etiqueta = new Map(
      (raices ?? []).map((r) => [r.departamento as string, r.nombre as string]),
    );

    const acumulado = new Map<string, { bytes: number; num: number }>();
    let bytesArchivos = 0;

    for (const f of filas ?? []) {
      const clave = (f.departamento as string) || "";
      const depto = etiqueta.get(clave) || clave || "Sin departamento";
      const bytes = Number(f.tamano_bytes ?? 0);
      bytesArchivos += bytes;
      const prev = acumulado.get(depto) ?? { bytes: 0, num: 0 };
      acumulado.set(depto, { bytes: prev.bytes + bytes, num: prev.num + 1 });
    }

    return {
      ok: true,
      data: {
        bytesArchivos,
        bytesTotal: Number(usage?.bytes_used ?? 0),
        bytesLimite: Number(usage?.bytes_limit ?? 500 * 1024 ** 3),
        numArchivos: filas?.length ?? 0,
        porDepartamento: [...acumulado.entries()]
          .map(([departamento, v]) => ({ departamento, ...v }))
          .sort((a, b) => b.bytes - a.bytes),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[archivos] getUsoArchivos:", msg);
    return { ok: false, error: msg };
  }
}
