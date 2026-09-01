"use server";

/**
 * Monedero de mensajería: leer el saldo, leer el extracto y abonar recargas.
 *
 * El saldo NUNCA se mueve con un UPDATE desde aquí: siempre por las RPC
 * `abonar_saldo_mensajeria` / `consumir_saldo_mensajeria`, que son atómicas y
 * escriben el movimiento en el mismo paso. Un saldo que cambia sin dejar
 * rastro en el extracto es un saldo que no se puede auditar.
 */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mensajesRestantes,
  type MonederoSaldo,
  type MonederoMovimiento,
  type TarifasMensajeria,
  type TipoMovimiento,
} from "@/features/mensajeria/data/monedero";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null };
  const empresaId = await getEmpresaActivaForUser(
    supabase as unknown as SupabaseClient,
    user.id,
  );
  return { supabase, user, empresaId };
}

/** Nombre de quien hace la acción, para dejarlo escrito en el movimiento. */
async function nombreDeUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  // La fila de `usuarios` se busca por `user_id` (el id de auth), no por su
  // propia clave primaria.
  const { data } = await supabase
    .from("usuarios")
    .select("nombre, apellidos")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return [data.nombre, data.apellidos].filter(Boolean).join(" ").trim() || null;
}

/** Precio de venta vigente por canal. */
export async function getTarifas(): Promise<TarifasMensajeria> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("mensajeria_tarifas")
    .select("canal, precio_cents, vigente_desde")
    .lte("vigente_desde", new Date().toISOString().slice(0, 10))
    .order("vigente_desde", { ascending: false });

  // La consulta trae el histórico ordenado de más nuevo a más viejo: la
  // primera fila de cada canal es la tarifa vigente.
  const primera = (canal: string) =>
    (data ?? []).find((r) => r.canal === canal)?.precio_cents as number | undefined;

  return {
    whatsappCents: primera("WHATSAPP") ?? 0,
    smsCents: primera("SMS") ?? 0,
  };
}

/**
 * Saldo de la empresa activa. Una empresa que nunca recargó no tiene fila:
 * eso es saldo cero, no un error.
 */
export async function getSaldo(): Promise<{ ok: boolean; data: MonederoSaldo }> {
  const vacio: MonederoSaldo = { saldoCents: 0, whatsappRestantes: 0, smsRestantes: 0 };
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: vacio };

    // El filtro por empresa va explícito: la RLS acota a las empresas DEL
    // usuario, no a la ACTIVA.
    const { data, error } = await supabase
      .from("empresa_mensajeria_saldo")
      .select("saldo_cents")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;

    const saldoCents = (data?.saldo_cents as number | undefined) ?? 0;
    const tarifas = await getTarifas();

    return {
      ok: true,
      data: {
        saldoCents,
        whatsappRestantes: mensajesRestantes(saldoCents, tarifas.whatsappCents),
        smsRestantes: mensajesRestantes(saldoCents, tarifas.smsCents),
      },
    };
  } catch {
    return { ok: false, data: vacio };
  }
}

/** Extracto de la empresa activa, del movimiento más reciente al más antiguo. */
export async function listMovimientos(limite = 50) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: [] as MonederoMovimiento[] };

    const { data, error } = await supabase
      .from("empresa_mensajeria_movimientos")
      .select("id, tipo, importe_cents, saldo_despues_cents, concepto, usuario_nombre, created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) throw error;

    const movimientos: MonederoMovimiento[] = (data ?? []).map((row) => ({
      id: row.id as string,
      tipo: row.tipo as TipoMovimiento,
      importeCents: row.importe_cents as number,
      saldoDespuesCents: row.saldo_despues_cents as number,
      concepto: row.concepto as string,
      usuarioNombre: (row.usuario_nombre as string | null) ?? null,
      creadoAt: row.created_at as string,
    }));

    return { ok: true, data: movimientos };
  } catch {
    return { ok: false, data: [] as MonederoMovimiento[] };
  }
}

const recargaSchema = z.object({
  /** Importe en céntimos. Tope de 500 € por recarga: un dedo torpe no puede
   *  meter 50.000 € de golpe. */
  importeCents: z.number().int().min(100).max(50000),
  concepto: z.string().trim().min(1).max(200),
});

export type RecargaInput = z.input<typeof recargaSchema>;

/**
 * Abona saldo a la empresa activa (fase 1: recarga registrada a mano tras una
 * transferencia).
 *
 * Cuando entre la pasarela propia (fase 4), el abono lo disparará el webhook
 * del pago confirmado y esta acción se quedará solo para ajustes manuales.
 */
export async function recargarSaldo(input: RecargaInput) {
  const parsed = recargaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Importe o concepto no válidos" };
  }

  try {
    const { supabase, user, empresaId } = await getCtx();
    if (!user || !empresaId) {
      return { ok: false as const, error: "Sesión no válida" };
    }

    const nombre = await nombreDeUsuario(supabase, user.id);
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("abonar_saldo_mensajeria", {
      p_empresa_id: empresaId,
      p_importe_cents: parsed.data.importeCents,
      p_tipo: "RECARGA",
      p_concepto: parsed.data.concepto,
      p_usuario_id: user.id,
      p_usuario_nombre: nombre,
    });
    if (error) throw error;

    return { ok: true as const, saldoCents: data as number };
  } catch {
    return { ok: false as const, error: "No se pudo registrar la recarga" };
  }
}
