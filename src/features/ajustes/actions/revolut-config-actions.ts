"use server";

/**
 * Credenciales de Revolut por empresa.
 *
 * La clave secreta y el secreto del webhook se guardan CIFRADOS y nunca
 * vuelven al navegador: al leerlas solo se devuelve una vista enmascarada
 * (sk_l****Lmkw) para que se vea que están puestas sin poder copiarlas.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { encrypt, decrypt } from "@/features/accesos/lib/crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RevolutEntorno } from "@/lib/revolut/merchant";

export interface RevolutConfigVista {
  configurado: boolean;
  activo: boolean;
  entorno: RevolutEntorno;
  /** Clave secreta enmascarada, solo para mostrar. */
  secretKeyMascara: string | null;
  publicKey: string | null;
  webhookConfigurado: boolean;
}

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

/** sk_live_abcd...wxyz → sk_l****wxyz */
function enmascarar(clave: string): string {
  if (clave.length <= 8) return "****";
  return `${clave.slice(0, 4)}****${clave.slice(-4)}`;
}

export async function getRevolutConfig(): Promise<RevolutConfigVista> {
  const vacia: RevolutConfigVista = {
    configurado: false,
    activo: false,
    entorno: "produccion",
    secretKeyMascara: null,
    publicKey: null,
    webhookConfigurado: false,
  };

  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return vacia;

    const { data, error } = await supabase
      .from("empresa_revolut_config")
      .select("secret_key_cifrada, public_key, webhook_secret_cifrado, entorno, activo")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.secret_key_cifrada) return vacia;

    let mascara: string | null = null;
    try {
      mascara = enmascarar(decrypt(data.secret_key_cifrada as string));
    } catch {
      // Clave ilegible (cambió CREDENCIALES_ENCRYPTION_KEY): hay que volver a
      // pegarla. No se rompe la pantalla por esto.
      mascara = null;
    }

    return {
      configurado: mascara !== null,
      activo: (data.activo as boolean) ?? false,
      entorno: ((data.entorno as string) ?? "produccion") as RevolutEntorno,
      secretKeyMascara: mascara,
      publicKey: (data.public_key as string | null) ?? null,
      webhookConfigurado: !!data.webhook_secret_cifrado,
    };
  } catch (err) {
    console.error("[revolut-config] get:", err);
    return vacia;
  }
}

export interface GuardarRevolutInput {
  /** Vacío = no se cambia la que ya está guardada. */
  secretKey?: string;
  publicKey?: string;
  webhookSecret?: string;
  entorno?: RevolutEntorno;
  activo?: boolean;
}

export async function guardarRevolutConfig(input: GuardarRevolutInput) {
  try {
    const { empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const fila: Record<string, unknown> = { empresa_id: empresaId };

    const secret = input.secretKey?.trim();
    if (secret) {
      if (!secret.startsWith("sk_")) {
        return { ok: false as const, error: "La clave secreta debe empezar por sk_" };
      }
      fila.secret_key_cifrada = encrypt(secret);
    }

    const pub = input.publicKey?.trim();
    if (pub !== undefined && pub !== "") {
      if (!pub.startsWith("pk_")) {
        return { ok: false as const, error: "La clave pública debe empezar por pk_" };
      }
      fila.public_key = pub;
    }

    const hook = input.webhookSecret?.trim();
    if (hook) fila.webhook_secret_cifrado = encrypt(hook);

    if (input.entorno !== undefined) fila.entorno = input.entorno;
    if (input.activo !== undefined) fila.activo = input.activo;

    // Escritura con admin: la tabla solo permite leer a los usuarios.
    const admin = createAdminClient();
    const { error } = await admin
      .from("empresa_revolut_config")
      .upsert(fila, { onConflict: "empresa_id" });
    if (error) throw error;

    revalidatePath("/sala/reservas/config");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[revolut-config] guardar:", msg);
    return { ok: false as const, error: msg };
  }
}

/** Borra las credenciales y desactiva el cobro. */
export async function borrarRevolutConfig() {
  try {
    const { empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const admin = createAdminClient();
    const { error } = await admin
      .from("empresa_revolut_config")
      .update({
        secret_key_cifrada: null,
        public_key: null,
        webhook_secret_cifrado: null,
        webhook_id: null,
        activo: false,
      })
      .eq("empresa_id", empresaId);
    if (error) throw error;

    revalidatePath("/sala/reservas/config");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[revolut-config] borrar:", msg);
    return { ok: false as const, error: msg };
  }
}

/**
 * Comprueba contra Revolut que las claves guardadas funcionan, creando un
 * pedido de 1 céntimo que no se cobra a nadie (no se le enseña a ningún
 * cliente; solo sirve para validar la credencial).
 */
export async function probarRevolutConfig() {
  try {
    const { empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const cred = await getCredencialesRevolut(empresaId);
    if (!cred) return { ok: false as const, error: "No hay clave secreta guardada" };

    const { crearOrden } = await import("@/lib/revolut/merchant");
    const r = await crearOrden({
      secretKey: cred.secretKey,
      entorno: cred.entorno,
      importe: 0.01,
      referencia: `test-${Date.now()}`,
      descripcion: "Comprobación de conexión",
    });

    if (!r.ok) return { ok: false as const, error: r.error };
    return { ok: true as const, mensaje: "Conexión correcta con Revolut" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[revolut-config] probar:", msg);
    return { ok: false as const, error: msg };
  }
}

/**
 * Devuelve las credenciales EN CLARO para uso interno del servidor.
 * No se exporta a componentes de cliente: solo la usan las acciones de cobro.
 */
export async function getCredencialesRevolut(
  empresaId: string,
  /**
   * `ignorarActivo` sirve para el momento de CONECTAR: ahí el cobro todavía no
   * está encendido —se enciende justo al terminar—, así que exigirlo impediría
   * dar de alta el aviso de pagos.
   */
  opciones?: { ignorarActivo?: boolean },
): Promise<
  { secretKey: string; entorno: RevolutEntorno; webhookSecret: string | null } | null
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("empresa_revolut_config")
    .select("secret_key_cifrada, webhook_secret_cifrado, entorno, activo")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error || !data?.secret_key_cifrada) return null;
  if (!data.activo && !opciones?.ignorarActivo) return null;

  try {
    return {
      secretKey: decrypt(data.secret_key_cifrada as string),
      entorno: ((data.entorno as string) ?? "produccion") as RevolutEntorno,
      webhookSecret: data.webhook_secret_cifrado
        ? decrypt(data.webhook_secret_cifrado as string)
        : null,
    };
  } catch (err) {
    console.error("[revolut-config] descifrado:", err);
    return null;
  }
}

/**
 * Conecta el aviso de pagos de esta empresa, de una sola vez.
 *
 * Es lo que hace que un restaurante nuevo pueda ponerse en marcha solo: el
 * panel de Revolut NO deja crear webhooks de la Merchant API a mano, así que
 * sin este botón cada cliente necesitaría a un técnico que lo diera de alta
 * por programa.
 *
 * Si ya había uno apuntando a otra dirección (por ejemplo, de una prueba en
 * otro dominio), se sustituye: dos avisos activos duplicarían los correos.
 */
export async function conectarWebhookRevolut() {
  try {
    const { empresaId } = await getCtx();
    if (!empresaId) return { ok: false as const, error: "Sin empresa activa" };

    const cred = await getCredencialesRevolut(empresaId, { ignorarActivo: true });
    if (!cred) {
      return {
        ok: false as const,
        error: "Guarda antes la clave secreta de Revolut.",
      };
    }

    const { listarWebhooks, crearWebhook, borrarWebhook } = await import(
      "@/lib/revolut/merchant"
    );
    const { getSiteUrl } = await import("@/lib/site-url");
    const url = `${getSiteUrl()}/api/revolut/webhook`;

    // En local la dirección sería localhost, que Revolut no puede alcanzar:
    // se avisa en vez de dar de alta un aviso muerto.
    if (!/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url)) {
      return {
        ok: false as const,
        error:
          "Esto solo puede conectarse desde la dirección real del software, no desde una copia local.",
      };
    }

    // Se limpian los avisos previos de este mismo software: si el dominio
    // cambió, el viejo dejaría de funcionar y ensuciaría la cuenta.
    const previos = await listarWebhooks(cred.secretKey, cred.entorno);
    if (previos.ok) {
      for (const w of previos.webhooks) {
        if (w.url === url || w.url.endsWith("/api/revolut/webhook")) {
          await borrarWebhook(cred.secretKey, cred.entorno, w.id);
        }
      }
    }

    const creado = await crearWebhook(cred.secretKey, cred.entorno, url);
    if (!creado.ok) return { ok: false as const, error: creado.error };

    const secreto = creado.webhook.signing_secret;
    if (!secreto) {
      return {
        ok: false as const,
        error: "Revolut no devolvió el secreto de firma. Inténtalo de nuevo.",
      };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("empresa_revolut_config")
      .update({
        webhook_secret_cifrado: encrypt(secreto),
        webhook_id: creado.webhook.id,
        activo: true,
      })
      .eq("empresa_id", empresaId);
    if (error) throw error;

    revalidatePath("/ajustes");
    return { ok: true as const, mensaje: "Cobro conectado y listo para vender." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[revolut-config] conectarWebhook:", msg);
    return { ok: false as const, error: msg };
  }
}
