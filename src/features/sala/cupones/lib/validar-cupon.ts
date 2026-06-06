/**
 * PRP-052 — Helper compartido de validación de cupones (server-side).
 * Llama a la RPC `validar_cupon` con SECURITY DEFINER y normaliza el resultado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CuponMotivoInvalidez,
  CuponValidacionResult,
  CuponPublico,
  CuponBeneficioTipo,
} from "@/features/sala/cupones/data/cupones";

interface RpcRow {
  ok: boolean;
  motivo: string | null;
  cupon_id: string | null;
  titulo_cliente_efectivo: string | null;
  beneficio_tipo: string | null;
  beneficio_valor: number | null;
  producto_descripcion: string | null;
  fecha_caducidad: string | null;
}

export async function validarCuponServer(
  supabase: SupabaseClient,
  args: { empresaId: string; codigo: string; fecha: string; turno: "COMIDA" | "CENA" | null },
): Promise<CuponValidacionResult> {
  const { data, error } = await supabase.rpc("validar_cupon", {
    p_empresa_id: args.empresaId,
    p_codigo: args.codigo,
    p_fecha: args.fecha,
    p_turno: args.turno,
  });

  if (error) {
    console.error("[cupones] validar_cupon RPC error:", error);
    return { ok: false, motivo: "NO_EXISTE", cupon: null };
  }

  const rows = (data ?? []) as RpcRow[];
  if (rows.length === 0) {
    return { ok: false, motivo: "NO_EXISTE", cupon: null };
  }

  const row = rows[0];
  const cupon: CuponPublico | null = row.cupon_id
    ? {
        id: row.cupon_id,
        tituloClienteEfectivo: row.titulo_cliente_efectivo ?? "",
        beneficioTipo: (row.beneficio_tipo ?? "porcentaje") as CuponBeneficioTipo,
        beneficioValor: row.beneficio_valor,
        productoDescripcion: row.producto_descripcion,
        fechaCaducidad: row.fecha_caducidad,
      }
    : null;

  if (row.ok) {
    return { ok: true, motivo: null, cupon };
  }
  return { ok: false, motivo: (row.motivo as CuponMotivoInvalidez) ?? "NO_EXISTE", cupon };
}
