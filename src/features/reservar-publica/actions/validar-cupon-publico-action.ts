"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { validarCuponServer } from "@/features/sala/cupones/lib/validar-cupon";
import type { CuponValidacionResult } from "@/features/sala/cupones/data/cupones";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Validación de cupón desde el formulario público `/reservar/<slug>`.
 * Resuelve `empresa_id` a partir del slug del enlace público y delega
 * en la RPC `validar_cupon`. No expone stock interno.
 */
export async function validarCuponPublicoAction(args: {
  empresaSlug: string;
  codigo: string;
  fecha: string;
  turno: "COMIDA" | "CENA" | null;
}): Promise<CuponValidacionResult> {
  const admin = createAdminClient();
  const { data: empresa } = await admin
    .from("empresas")
    .select("id")
    .eq("slug", args.empresaSlug)
    .maybeSingle();
  if (!empresa) return { ok: false, motivo: "NO_EXISTE", cupon: null };
  return validarCuponServer(admin as unknown as SupabaseClient, {
    empresaId: empresa.id as string,
    codigo: args.codigo,
    fecha: args.fecha,
    turno: args.turno,
  });
}
