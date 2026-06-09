"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "../types";
import crypto from "node:crypto";

const BUCKET = "nuevas-recetas-fotos-cata";

/**
 * Genera un token firmado temporal para que el móvil suba una foto
 * vinculada a una cata específica. El token expira en 15 minutos.
 *
 * Flujo:
 * 1. Ordenador: llama a `generarQrUpload(cataId)` → devuelve URL pública
 *    que el móvil abre vía QR.
 * 2. Móvil: abre la URL, hace foto, la sube al endpoint del token.
 * 3. Backend: valida token, sube a Storage, actualiza cata.foto_url.
 */
export async function generarQrUpload(input: {
  recetaId: string;
  cataId: string;
}): Promise<ActionResult<{ url: string; token: string; expires_at: string }>> {
  try {
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    const _token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Guardamos el token en una tabla ligera (creada on-demand vía upsert seguro)
    // Para simplificar V1: codificamos empresaId + cataId + expira en el propio token
    // El endpoint de subida valida el payload firmado.
    const payload = JSON.stringify({
      empresaId,
      recetaId: input.recetaId,
      cataId: input.cataId,
      exp: expiresAt,
    });
    const secret = process.env.QR_UPLOAD_SECRET || "fallback-dev-secret-change-me";
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    const signed = Buffer.from(payload).toString("base64url") + "." + signature;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const url = `${baseUrl}/cocina/nuevas-recetas/qr-upload?t=${signed}`;

    return { ok: true, data: { url, token: signed, expires_at: expiresAt } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

/**
 * Valida token + sube foto + actualiza cata. Llamado desde el móvil.
 */
export async function subirFotoCata(input: {
  token: string;
  fileBase64: string;
  fileName: string;
  mime: string;
}): Promise<ActionResult<{ foto_url: string }>> {
  try {
    // Decodificar y validar token
    const [payloadB64, signature] = input.token.split(".");
    if (!payloadB64 || !signature) return { ok: false, error: "Token inválido" };

    const secret = process.env.QR_UPLOAD_SECRET || "fallback-dev-secret-change-me";
    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payloadStr)
      .digest("hex");
    if (expected !== signature) return { ok: false, error: "Token no válido" };

    const payload = JSON.parse(payloadStr) as {
      empresaId: string;
      recetaId: string;
      cataId: string;
      exp: string;
    };
    if (new Date(payload.exp) < new Date()) {
      return { ok: false, error: "Token expirado. Genera un QR nuevo." };
    }

    // Subir a Storage (admin client para evitar RLS en el endpoint público)
    const admin = createAdminClient();
    const buffer = Buffer.from(input.fileBase64, "base64");
    const path = `${payload.empresaId}/${payload.recetaId}/cata-${payload.cataId}-${Date.now()}-${input.fileName}`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: input.mime, upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
    const foto_url = urlData.publicUrl;

    // Actualizar cata
    const { error: updErr } = await admin
      .from("nueva_receta_cata")
      .update({ foto_url })
      .eq("id", payload.cataId);
    if (updErr) throw updErr;

    return { ok: true, data: { foto_url } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[qr-foto][subir]", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Subida directa desde ordenador (sin QR). Usa la sesión autenticada.
 */
export async function subirFotoCataDirecto(input: {
  recetaId: string;
  cataId: string;
  fileBase64: string;
  fileName: string;
  mime: string;
}): Promise<ActionResult<{ foto_url: string }>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    const buffer = Buffer.from(input.fileBase64, "base64");
    const path = `${empresaId}/${input.recetaId}/cata-${input.cataId}-${Date.now()}-${input.fileName}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: input.mime, upsert: false });
    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const foto_url = urlData.publicUrl;

    const { error: updErr } = await supabase
      .from("nueva_receta_cata")
      .update({ foto_url })
      .eq("id", input.cataId);
    if (updErr) throw updErr;

    return { ok: true, data: { foto_url } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
