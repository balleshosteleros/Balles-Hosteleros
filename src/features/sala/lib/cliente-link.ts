import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarNombre, normalizarNombreOrNull } from "@/shared/lib/normalizar-nombre";

export interface ClienteSalaRow {
  id: string;
  empresa_id: string;
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  email_normalizado: string | null;
  telefono_normalizado: string | null;
  clasificacion: string;
  visitas: number;
  ultima_visita: string | null;
}

export type CampoDistinto = "nombre" | "apellidos" | "email" | "telefono";

/** Qué dato provocó el enganche con una ficha existente. */
export type VinculacionMotivo = "email" | "telefono";

export interface FindOrLinkClienteResult {
  cliente: ClienteSalaRow;
  existed: boolean;
  camposDistintos: CampoDistinto[];
}

/** Datos tal y como los escribió quien reservó, cuando difieren de la ficha. */
export interface DatosDeclarados {
  nombre?: string;
  apellidos?: string;
  email?: string;
  telefono?: string;
}

/**
 * Deduce por qué dato enganchó la reserva con la ficha.
 *
 * La RPC empareja por email O por teléfono y devuelve qué campos difieren. Si
 * el email NO está entre los distintos, es que coincidía: ése fue el enganche.
 * En caso contrario sólo pudo ser el teléfono.
 */
export function deducirMotivoVinculacion(
  camposDistintos: CampoDistinto[],
  emailAportado: string | null | undefined,
): VinculacionMotivo {
  const hayEmail = Boolean((emailAportado ?? "").trim());
  if (hayEmail && !camposDistintos.includes("email")) return "email";
  return "telefono";
}

/**
 * Qué escribió quien reservó en los campos que NO coinciden con la ficha.
 *
 * Sólo se guarda lo que difiere: repetir lo que ya es igual no aporta nada a
 * quien tenga que revisar la vinculación en Sala.
 */
export function construirDatosDeclarados(
  camposDistintos: CampoDistinto[],
  formulario: { nombre: string; apellidos?: string | null; email?: string | null; telefono?: string | null },
): DatosDeclarados | null {
  const out: DatosDeclarados = {};
  if (camposDistintos.includes("nombre")) out.nombre = normalizarNombre(formulario.nombre);
  if (camposDistintos.includes("apellidos") && formulario.apellidos?.trim()) {
    out.apellidos = normalizarNombre(formulario.apellidos);
  }
  if (camposDistintos.includes("email") && formulario.email?.trim()) {
    out.email = formulario.email.trim();
  }
  if (camposDistintos.includes("telefono") && formulario.telefono?.trim()) {
    out.telefono = formulario.telefono.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

interface FindOrLinkInput {
  empresaId: string;
  nombre: string;
  apellidos?: string | null;
  email?: string | null;
  telefono?: string | null;
}

/**
 * Llama a la RPC atómica `find_or_link_cliente_sala`:
 * - Si existe un cliente con mismo email o teléfono normalizado en la empresa, lo devuelve.
 * - Si no, lo crea.
 * - Nunca sobrescribe datos del cliente vigente; devuelve qué campos del input difieren.
 */
export async function findOrLinkClienteSala(
  supabase: SupabaseClient,
  input: FindOrLinkInput,
): Promise<{ ok: true; result: FindOrLinkClienteResult } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("find_or_link_cliente_sala", {
    p_empresa_id: input.empresaId,
    p_nombre: normalizarNombre(input.nombre),
    p_apellidos: normalizarNombreOrNull(input.apellidos),
    p_email: input.email ?? null,
    p_telefono: input.telefono ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  const r = data as {
    cliente: ClienteSalaRow;
    existed: boolean;
    camposDistintos: CampoDistinto[];
  } | null;
  if (!r?.cliente?.id) {
    return { ok: false, error: "No se pudo vincular el cliente" };
  }
  return { ok: true, result: r };
}

/**
 * Completa la ficha con los datos que el cliente acaba de dar al reservar.
 *
 * Solo RELLENA HUECOS: si la ficha ya tiene fecha de nacimiento o prefijo, se
 * respetan (mismo criterio que la RPC de vinculación, que nunca pisa datos del
 * cliente vigente). El consentimiento comercial sí se actualiza siempre que
 * venga marcado, porque es un acto voluntario del cliente en ese momento; y
 * nunca se retira desde aquí: un "no marcado" en el formulario no es lo mismo
 * que revocar un consentimiento dado antes.
 */
export async function completarFichaCliente(
  supabase: SupabaseClient,
  clienteId: string,
  datos: {
    fechaNacimiento?: string | null;
    aceptaMarketing?: boolean;
    origen?: string | null;
  },
): Promise<void> {
  try {
    const { data: actual } = await supabase
      .from("clientes_sala")
      .select("fecha_nacimiento, acepta_marketing_email")
      .eq("id", clienteId)
      .maybeSingle();

    const patch: Record<string, unknown> = {};

    if (datos.fechaNacimiento && !actual?.fecha_nacimiento) {
      patch.fecha_nacimiento = datos.fechaNacimiento;
    }
    if (datos.aceptaMarketing && !actual?.acepta_marketing_email) {
      patch.acepta_marketing_email = true;
      patch.acepta_marketing_sms = true;
      patch.marketing_optin_origen = datos.origen ?? "RESERVA_WEB";
      patch.marketing_optin_at = new Date().toISOString();
    }

    if (Object.keys(patch).length === 0) return;
    patch.updated_at = new Date().toISOString();
    await supabase.from("clientes_sala").update(patch).eq("id", clienteId);
  } catch (err) {
    // Completar la ficha no debe tumbar una reserva ya aceptada.
    console.error("[cliente-link] completarFicha:", err);
  }
}

export async function registrarVisitaCliente(
  supabase: SupabaseClient,
  clienteId: string,
  fechaIso: string,
): Promise<void> {
  await supabase.rpc("registrar_visita_cliente_sala", {
    p_cliente_id: clienteId,
    p_fecha: fechaIso,
  });
}
