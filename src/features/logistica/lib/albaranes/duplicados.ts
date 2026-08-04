import "server-only";

/**
 * Detección de posibles albaranes duplicados de NEGOCIO (PRP-073 Fase 2).
 *
 * Política (del PRP): mismo proveedor + número normalizado = candidato fuerte,
 * aunque fecha o total difieran; sin número fiable, proveedor + fecha. La
 * huella exacta por archivo (SHA-256) la garantiza aparte el unique parcial de
 * `albaran_importaciones` y el bloqueo en `completarSubidaAlbaran`.
 *
 * No se impone restricción dura sobre el número del proveedor (puede repetirse
 * entre ejercicios o venir mal leído): el candidato exige decisión humana
 * (abrir el existente o registrar la excepción con motivo).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CandidatoDuplicado {
  id: string;
  numero: string;
  numeroProveedor: string | null;
  proveedorNombre: string;
  fecha: string;
  estado: string;
}

/** Normaliza el número del proveedor para comparar: minúsculas y solo alfanumérico. */
export function normalizarNumeroProveedor(numero: string | null | undefined): string {
  return (numero ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface FilaAlbaran {
  id: string;
  numero: string;
  numero_proveedor: string | null;
  proveedor_nombre: string;
  fecha: string;
  estado: string;
}

function aCandidato(a: FilaAlbaran): CandidatoDuplicado {
  return {
    id: a.id,
    numero: a.numero,
    numeroProveedor: a.numero_proveedor,
    proveedorNombre: a.proveedor_nombre,
    fecha: a.fecha,
    estado: a.estado,
  };
}

/**
 * Busca un albarán existente que pueda ser el mismo documento.
 * Devuelve el candidato más probable o null. `excluirId` permite usarlo como
 * re-check sobre un albarán ya creado (confirmación).
 */
export async function detectarDuplicadoNegocio(
  supabase: SupabaseClient,
  empresaId: string,
  input: {
    proveedorNombre: string;
    numeroProveedor?: string | null;
    fecha?: string | null;
    excluirId?: string | null;
  },
): Promise<CandidatoDuplicado | null> {
  const proveedor = input.proveedorNombre.trim();
  if (!proveedor) return null;

  // Candidatos del mismo proveedor (snapshot de nombre, case-insensitive).
  let query = supabase
    .from("albaranes")
    .select("id, numero, numero_proveedor, proveedor_nombre, fecha, estado")
    .eq("empresa_id", empresaId)
    .ilike("proveedor_nombre", proveedor);
  if (input.excluirId) query = query.neq("id", input.excluirId);
  const { data } = await query;
  const filas = (data ?? []) as FilaAlbaran[];
  if (filas.length === 0) return null;

  // 1. Candidato FUERTE: mismo número de proveedor normalizado (fecha/total pueden diferir).
  const numero = normalizarNumeroProveedor(input.numeroProveedor);
  if (numero) {
    const porNumero = filas.find((a) => normalizarNumeroProveedor(a.numero_proveedor) === numero);
    if (porNumero) return aCandidato(porNumero);
  }

  // 2. Sin número fiable: mismo proveedor + misma fecha.
  if (!numero && input.fecha) {
    const porFecha = filas.find((a) => a.fecha === input.fecha);
    if (porFecha) return aCandidato(porFecha);
  }

  return null;
}
