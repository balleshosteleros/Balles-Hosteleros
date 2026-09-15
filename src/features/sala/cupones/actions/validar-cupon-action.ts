"use server";

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validarCuponServer } from "@/features/sala/cupones/lib/validar-cupon";
import type { CuponValidacionResult } from "@/features/sala/cupones/data/cupones";

/**
 * Validación inline para el formulario interno de reserva (admin).
 * Resuelve la empresa activa del usuario autenticado y llama a la RPC.
 */
export async function validarCuponAdminAction(args: {
  codigo: string;
  fecha: string;
  turno: "COMIDA" | "CENA" | null;
  /** Comensales de la reserva: es lo que decide si se cumple el mínimo. */
  personas?: number | null;
  /**
   * Correo del cliente de la reserva. Los cupones de cumpleaños son suyos y solo
   * suyos: sala tiene que escribir el correo del cliente para poder aplicarlos,
   * igual que si reservara él por la web.
   */
  email?: string | null;
}): Promise<CuponValidacionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "NO_EXISTE", cupon: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  if (!empresaId) return { ok: false, motivo: "NO_EXISTE", cupon: null };
  return validarCuponServer(supabase as unknown as SupabaseClient, {
    empresaId,
    codigo: args.codigo,
    fecha: args.fecha,
    turno: args.turno,
    personas: args.personas ?? null,
    email: args.email ?? null,
  });
}
