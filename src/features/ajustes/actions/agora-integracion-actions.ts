"use server";

import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/features/accesos/lib/crypto";
import { getAgoraCredenciales } from "@/features/logistica/services/agora-credenciales";

/**
 * Integración Ágora self-service por empresa (PRP-059).
 * El cliente introduce SUS claves en Ajustes → Integraciones. El token se guarda
 * cifrado (AES-256-GCM) y nunca se devuelve al navegador (write-only).
 */

export type AgoraIntegracionEstado = {
  activo: boolean;
  url: string;
  workplaceId: number | null;
  tieneToken: boolean;
};

const guardarSchema = z.object({
  activo: z.boolean(),
  url: z.string().trim().url("La dirección debe ser una URL válida (https://…)").max(500).or(z.literal("")),
  workplaceId: z.coerce.number().int().positive("El nº de TPV debe ser un entero positivo").nullable(),
  // Write-only: si llega vacío, se conserva el token ya guardado.
  token: z.string().trim().max(2000).optional(),
});

export type GuardarAgoraInput = z.input<typeof guardarSchema>;

/** Devuelve el estado actual de la integración (sin exponer el token). */
export async function getAgoraIntegracion(): Promise<
  { ok: true; estado: AgoraIntegracionEstado } | { ok: false; error: string }
> {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return { ok: false, error: "Sesión no válida." };
  if (!empresaId) return { ok: false, error: "Sin empresa activa." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("empresas")
    .select("agora_activo, agora_api_url, agora_api_token_cifrado, agora_workplace_id")
    .eq("id", empresaId)
    .single();
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    estado: {
      activo: Boolean(data?.agora_activo),
      url: (data?.agora_api_url as string | null) ?? "",
      workplaceId: (data?.agora_workplace_id as number | null) ?? null,
      tieneToken: Boolean(data?.agora_api_token_cifrado),
    },
  };
}

/** Guarda la configuración de Ágora de la empresa activa (token cifrado). */
export async function guardarAgoraIntegracion(
  input: GuardarAgoraInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return { ok: false, error: "Sesión no válida." };
  if (!empresaId) return { ok: false, error: "Sin empresa activa." };

  const parsed = guardarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const { activo, url, workplaceId, token } = parsed.data;

  // Activar exige configuración completa (datos completos, no a medias).
  if (activo && (!url || workplaceId == null)) {
    return { ok: false, error: "Para activar Ágora necesitas la dirección y el nº de TPV." };
  }

  const admin = createAdminClient();

  // ¿Hay token ya guardado? (para no exigirlo de nuevo al editar)
  const { data: actual } = await admin
    .from("empresas")
    .select("agora_api_token_cifrado")
    .eq("id", empresaId)
    .single();
  const tieneTokenPrevio = Boolean(actual?.agora_api_token_cifrado);

  if (activo && !token && !tieneTokenPrevio) {
    return { ok: false, error: "Para activar Ágora necesitas introducir el token." };
  }

  const update: Record<string, unknown> = {
    agora_activo: activo,
    agora_api_url: url || null,
    agora_workplace_id: workplaceId,
  };
  // Solo se reescribe el token si el usuario ha introducido uno nuevo.
  if (token) update.agora_api_token_cifrado = encrypt(token);

  const { error } = await admin.from("empresas").update(update).eq("id", empresaId);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

const probarSchema = z.object({
  url: z.string().trim().url().max(500),
  workplaceId: z.coerce.number().int().positive(),
  token: z.string().trim().max(2000).optional(),
});

export type ProbarAgoraInput = z.input<typeof probarSchema>;

function ayerIso(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

/**
 * Prueba la conexión con Ágora usando las claves del formulario.
 * Si el token llega vacío (editando), usa el ya guardado. Devuelve el nº de
 * facturas de ayer para ese TPV — prueba real de extremo a extremo.
 */
export async function probarConexionAgora(
  input: ProbarAgoraInput,
): Promise<{ ok: true; facturas: number; dia: string } | { ok: false; error: string }> {
  const { userId, empresaId } = await getAppContext();
  if (!userId) return { ok: false, error: "Sesión no válida." };
  if (!empresaId) return { ok: false, error: "Sin empresa activa." };

  const parsed = probarSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const { url, workplaceId } = parsed.data;
  let token = parsed.data.token;

  // Sin token en el formulario → reutiliza el guardado (descifrado).
  if (!token) {
    const admin = createAdminClient();
    const cred = await getAgoraCredenciales(admin, empresaId);
    if (!cred) {
      return { ok: false, error: "Introduce el token: no hay ninguno guardado todavía." };
    }
    token = cred.token;
  }

  const dia = ayerIso();
  try {
    const base = url.replace(/\/$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let r: Response;
    try {
      r = await fetch(`${base}/api/export/?business-day=${dia}&filter=Invoices`, {
        signal: controller.signal,
        headers: { "Api-Token": token, Accept: "application/json" },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!r.ok) {
      return { ok: false, error: `Ágora respondió HTTP ${r.status}. Revisa la dirección y el token.` };
    }
    const json = (await r.json()) as { Invoices?: Array<{ Workplace?: { Id?: number } }> };
    const facturas = (json.Invoices ?? []).filter((f) => f.Workplace?.Id === workplaceId).length;
    return { ok: true, facturas, dia };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de red";
    return { ok: false, error: `No se pudo conectar con Ágora: ${msg}` };
  }
}
