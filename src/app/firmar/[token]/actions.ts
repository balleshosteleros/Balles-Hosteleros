"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  compararOTP,
  compararToken,
  generarOTP,
  hashOTP,
  hashToken,
  sha256,
} from "@/features/rrhh/services/firmas/crypto";
import { registrarEvento, listarEventos } from "@/features/rrhh/services/firmas/audit";
import { enviarCodigoOTP, enviarCopiaFirmada } from "@/features/rrhh/services/firmas/email";
import { generarActa, aplicarFirmaYConcatenar, type DatosActa } from "@/features/rrhh/services/firmas/pdf";
import { marcarNotificacionesVistasPorRef } from "@/features/notificaciones/actions/notificaciones-actions";

const BUCKET = "firmas";
const OTP_TTL_MIN = 10;
const OTP_MAX_INTENTOS = 3;
const VISOR_TTL_SECONDS = 60 * 10;
const COPIA_TTL_SECONDS = 60 * 60 * 24 * 7;

async function getMeta() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  return { ip, userAgent: h.get("user-agent") || null };
}

async function resolverToken(token: string) {
  const admin = createAdminClient();
  const tokenHash = hashToken(token);
  const { data, error } = await admin
    .from("firmas_tokens")
    .select("id, documento_id, expira_en, consumido_en, token_hash")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false as const, reason: "not_found" as const };
  if (!compararToken(token, data.token_hash as string)) {
    return { ok: false as const, reason: "not_found" as const };
  }
  if (data.consumido_en) return { ok: false as const, reason: "consumed" as const };
  if (new Date(data.expira_en as string).getTime() < Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }
  return { ok: true as const, tokenRow: data };
}

export type AbrirDocumentoResult =
  | {
      ok: true;
      documento: {
        id: string;
        titulo: string;
        tipo: string;
        modalidad: "click_to_sign" | "email_otp" | "manuscrita_digital";
        validez: string;
        estado: string;
        expiraEn: string;
        observaciones: string | null;
        empleado: { nombre: string; emailEnmascarado: string | null };
        empresa: { nombre: string };
        /** Zona horaria de la empresa, para mostrar fechas al firmante (PRP-069). */
        zonaHoraria: string;
        enviadoPor: string;
        enviadoEn: string;
        pdfUrl: string;
      };
    }
  | { ok: false; reason: "not_found" | "consumed" | "expired" | "estado_invalido"; message: string };

function enmascararEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return null;
  if (user.length <= 2) return `${user[0] ?? "*"}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

export async function abrirDocumento(token: string): Promise<AbrirDocumentoResult> {
  try {
    const res = await resolverToken(token);
    if (!res.ok) {
      const message =
        res.reason === "expired"
          ? "El enlace ha caducado. Pide a RRHH que te lo reenvíe."
          : res.reason === "consumed"
            ? "Este enlace ya se usó. Si necesitas firmar de nuevo, contacta con RRHH."
            : "Enlace no válido.";
      return { ok: false, reason: res.reason, message };
    }

    const admin = createAdminClient();
    const documentoId = res.tokenRow.documento_id as string;

    const { data: doc } = await admin
      .from("firmas_documentos")
      .select(
        "id, titulo, tipo, modalidad, validez, estado, expira_en, observaciones, empleado_id, empresa_id, enviado_por, enviado_en, pdf_original_path",
      )
      .eq("id", documentoId)
      .maybeSingle();
    if (!doc) return { ok: false, reason: "not_found", message: "Documento no encontrado" };
    if (doc.estado !== "pendiente") {
      return {
        ok: false,
        reason: "estado_invalido",
        message: "Este documento ya no admite firma.",
      };
    }

    const { data: emp } = await admin
      .from("empleados")
      .select("nombre, apellidos, email_empresa, email_personal")
      .eq("id", doc.empleado_id)
      .maybeSingle();
    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre, logo_url, config_operativa")
      .eq("id", doc.empresa_id)
      .maybeSingle();
    const { data: enviadoPorUser } = await admin
      .from("usuarios")
      .select("full_name, email")
      .eq("id", doc.enviado_por)
      .maybeSingle();

    const signed = await admin.storage
      .from(BUCKET)
      .createSignedUrl(doc.pdf_original_path as string, VISOR_TTL_SECONDS);
    if (signed.error || !signed.data?.signedUrl) {
      return { ok: false, reason: "not_found", message: "No se pudo abrir el PDF" };
    }

    const meta = await getMeta();
    await registrarEvento({
      documentoId,
      tipo: "abierto",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {},
    });

    const empleadoNombre = `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim() || "Empleado";
    const emailEmp = (emp?.email_empresa as string | null) || (emp?.email_personal as string | null);

    return {
      ok: true,
      documento: {
        id: doc.id as string,
        titulo: doc.titulo as string,
        tipo: doc.tipo as string,
        modalidad: doc.modalidad as "click_to_sign" | "email_otp" | "manuscrita_digital",
        validez: doc.validez as string,
        estado: doc.estado as string,
        expiraEn: doc.expira_en as string,
        observaciones: (doc.observaciones as string | null) ?? null,
        empleado: { nombre: empleadoNombre, emailEnmascarado: enmascararEmail(emailEmp) },
        empresa: { nombre: (empresa?.nombre as string) ?? "Empresa" },
        zonaHoraria:
          ((empresa?.config_operativa as Record<string, unknown> | null)?.zonaHoraria as string | undefined)?.trim() ||
          "Europe/Madrid",
        enviadoPor: (enviadoPorUser?.full_name as string) || (enviadoPorUser?.email as string) || "Administrador",
        enviadoEn: doc.enviado_en as string,
        pdfUrl: signed.data.signedUrl,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error abriendo documento";
    console.error("[firmar/abrir]", msg);
    return { ok: false, reason: "not_found", message: msg };
  }
}

export type SolicitarOtpResult =
  | { ok: true; otpId: string; destinoEnmascarado: string; expiraMin: number }
  | { ok: false; error: string };

export async function solicitarOTP(token: string): Promise<SolicitarOtpResult> {
  try {
    const res = await resolverToken(token);
    if (!res.ok) return { ok: false, error: "Enlace no válido o caducado" };

    const admin = createAdminClient();
    const documentoId = res.tokenRow.documento_id as string;

    const { data: doc } = await admin
      .from("firmas_documentos")
      .select("titulo, empleado_id, empresa_id, estado")
      .eq("id", documentoId)
      .maybeSingle();
    if (!doc) return { ok: false, error: "Documento no encontrado" };
    if (doc.estado !== "pendiente") return { ok: false, error: "Documento ya cerrado" };

    const { data: emp } = await admin
      .from("empleados")
      .select("nombre, apellidos, email_empresa, email_personal")
      .eq("id", doc.empleado_id)
      .maybeSingle();
    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre, logo_url, config_operativa")
      .eq("id", doc.empresa_id)
      .maybeSingle();

    const destino = (emp?.email_empresa as string | null) || (emp?.email_personal as string | null);
    if (!destino) return { ok: false, error: "El empleado no tiene email; contacta con RRHH" };

    const meta = await getMeta();

    const { data: bloqueado } = await admin
      .from("firmas_otps")
      .select("bloqueado_hasta")
      .eq("documento_id", documentoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bloqueado?.bloqueado_hasta) {
      const hasta = new Date(bloqueado.bloqueado_hasta as string);
      if (hasta.getTime() > Date.now()) {
        return { ok: false, error: "Demasiados intentos. Vuelve a intentarlo en unos minutos." };
      }
    }

    const codigo = generarOTP();
    const codigoHash = hashOTP(codigo, documentoId);
    const expiraEn = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();

    // R3 (TASK-008): devolvemos el otpId al cliente para que pueda referenciar
    // este OTP exacto en validarOTP. Evita race si el usuario pidió varios
    // códigos seguidos (el último "order by created_at desc" ya no es la única
    // forma de seleccionarlo).
    const { data: otpIns, error: insErr } = await admin
      .from("firmas_otps")
      .insert({
        documento_id: documentoId,
        codigo_hash: codigoHash,
        canal: "email",
        destino,
        expira_en: expiraEn,
      })
      .select("id")
      .single();
    if (insErr || !otpIns) return { ok: false, error: insErr?.message ?? "No se pudo crear OTP" };

    const empleadoNombre = `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim() || "Empleado";
    const send = await enviarCodigoOTP({
      to: destino,
      empresaId: doc.empresa_id as string,
      empresaNombre: (empresa?.nombre as string) ?? "Empresa",
      empresaLogoUrl: (empresa?.logo_url as string | null) ?? null,
      empleadoNombre,
      tituloDocumento: doc.titulo as string,
      codigo,
      expiraMin: OTP_TTL_MIN,
    });

    await registrarEvento({
      documentoId,
      tipo: "otp_enviado",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { canal: "email", destinoEnmascarado: enmascararEmail(destino), emailOk: send.ok },
    });

    return {
      ok: true,
      otpId: otpIns.id as string,
      destinoEnmascarado: enmascararEmail(destino) ?? destino,
      expiraMin: OTP_TTL_MIN,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error enviando OTP";
    console.error("[firmar/solicitarOTP]", msg);
    return { ok: false, error: msg };
  }
}

export type ValidarOtpResult =
  | { ok: true }
  | { ok: false; error: string; bloqueado?: boolean };

/**
 * Valida el OTP. Si se pasa `otpId` (R3, TASK-008) se usa ese OTP exacto;
 * sin él se cae al comportamiento legacy (último OTP del documento por
 * created_at desc), retrocompatible para callers no actualizados.
 */
export async function validarOTP(
  token: string,
  codigo: string,
  otpId?: string,
): Promise<ValidarOtpResult> {
  try {
    const limpio = (codigo ?? "").trim();
    if (!/^\d{6}$/.test(limpio)) return { ok: false, error: "El código debe tener 6 dígitos" };

    const res = await resolverToken(token);
    if (!res.ok) return { ok: false, error: "Enlace no válido o caducado" };

    const admin = createAdminClient();
    const documentoId = res.tokenRow.documento_id as string;
    const meta = await getMeta();

    // R3: si el caller pasó otpId, lo usamos exacto; si no, fallback al
    // último OTP del documento (legacy).
    const otpQuery = admin
      .from("firmas_otps")
      .select("id, codigo_hash, expira_en, intentos, validado_en, bloqueado_hasta")
      .eq("documento_id", documentoId);
    const { data: otp } = otpId
      ? await otpQuery.eq("id", otpId).maybeSingle()
      : await otpQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!otp) return { ok: false, error: "No hay OTP activo. Solicita un nuevo código." };
    if (otp.validado_en) return { ok: false, error: "Este código ya se usó. Solicita uno nuevo." };
    if (otp.bloqueado_hasta && new Date(otp.bloqueado_hasta as string).getTime() > Date.now()) {
      return { ok: false, error: "Bloqueado por intentos. Espera unos minutos.", bloqueado: true };
    }
    if (new Date(otp.expira_en as string).getTime() < Date.now()) {
      return { ok: false, error: "El código ha caducado. Solicita uno nuevo." };
    }

    if (!compararOTP(limpio, documentoId, otp.codigo_hash as string)) {
      const nuevoIntentos = (otp.intentos as number) + 1;
      const bloquear = nuevoIntentos >= OTP_MAX_INTENTOS;
      await admin
        .from("firmas_otps")
        .update({
          intentos: nuevoIntentos,
          bloqueado_hasta: bloquear ? new Date(Date.now() + 30 * 60_000).toISOString() : null,
        })
        .eq("id", otp.id);
      await registrarEvento({
        documentoId,
        tipo: bloquear ? "otp_bloqueado" : "otp_fallido",
        ip: meta.ip,
        userAgent: meta.userAgent,
        metadata: { intentos: nuevoIntentos },
      });
      return {
        ok: false,
        error: bloquear ? "Demasiados intentos. Bloqueado 30 min." : "Código incorrecto",
        bloqueado: bloquear,
      };
    }

    await admin
      .from("firmas_otps")
      .update({ validado_en: new Date().toISOString() })
      .eq("id", otp.id);

    await registrarEvento({
      documentoId,
      tipo: "otp_validado",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {},
    });

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error validando OTP";
    console.error("[firmar/validarOTP]", msg);
    return { ok: false, error: msg };
  }
}

export type PosicionFirma = {
  pagina: number;
  xPct: number;
  yPct: number;
  anchoPct: number;
};

export type FirmarDocumentoInput = {
  token: string;
  trazoFirmaBase64?: string | null;
  posicionFirma?: PosicionFirma | null;
};

export type FirmarResult =
  | { ok: true; descargaUrl: string }
  | { ok: false; error: string };

export async function firmarDocumento(input: FirmarDocumentoInput): Promise<FirmarResult> {
  try {
    const res = await resolverToken(input.token);
    if (!res.ok) return { ok: false, error: "Enlace no válido o caducado" };

    const admin = createAdminClient();
    const documentoId = res.tokenRow.documento_id as string;
    const meta = await getMeta();

    const { data: otpRow } = await admin
      .from("firmas_otps")
      .select("validado_en")
      .eq("documento_id", documentoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!otpRow?.validado_en) {
      return { ok: false, error: "Verifica el código OTP antes de firmar" };
    }

    // R1 (TASK-008): compare-and-swap atómico del token para impedir doble firma
    // concurrente. Si dos requests entran a la vez, solo una marca consumido_en
    // y avanza; la otra recibe error claro y la UI debe recargar.
    // Si algún paso posterior falla, el token queda consumido — recovery manual
    // desde admin (preferible a un rollback que pueda introducir otra race).
    const { data: tokenClaim, error: tokenClaimErr } = await admin
      .from("firmas_tokens")
      .update({ consumido_en: new Date().toISOString() })
      .eq("id", res.tokenRow.id)
      .is("consumido_en", null)
      .select("id")
      .maybeSingle();
    if (tokenClaimErr) {
      return { ok: false, error: tokenClaimErr.message };
    }
    if (!tokenClaim) {
      return {
        ok: false,
        error: "Este enlace ya se está usando para firmar. Recarga la página.",
      };
    }

    const { data: doc } = await admin
      .from("firmas_documentos")
      .select(
        "id, empresa_id, empleado_id, titulo, tipo, modalidad, validez, estado, sha256_original, pdf_original_path, enviado_por, enviado_en",
      )
      .eq("id", documentoId)
      .maybeSingle();
    if (!doc) return { ok: false, error: "Documento no encontrado" };
    if (doc.estado !== "pendiente") return { ok: false, error: "Documento ya cerrado" };

    const { data: emp } = await admin
      .from("empleados")
      .select("nombre, apellidos, dni_nie, email_empresa, email_personal, user_id")
      .eq("id", doc.empleado_id)
      .maybeSingle();
    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre, logo_url, config_operativa")
      .eq("id", doc.empresa_id)
      .maybeSingle();
    const { data: enviadoPorUser } = await admin
      .from("usuarios")
      .select("full_name, email")
      .eq("id", doc.enviado_por)
      .maybeSingle();

    let trazoPng: Uint8Array | null = null;
    if (doc.modalidad === "manuscrita_digital") {
      if (!input.trazoFirmaBase64) {
        return { ok: false, error: "Falta el trazo de firma manuscrita" };
      }
      if (!input.posicionFirma) {
        return { ok: false, error: "Falta la posición de la firma sobre el documento" };
      }
      const b64 = input.trazoFirmaBase64.replace(/^data:image\/png;base64,/, "");
      try {
        trazoPng = Buffer.from(b64, "base64");
      } catch {
        return { ok: false, error: "Trazo de firma inválido" };
      }
      const trazoPath = `${doc.empresa_id}/${documentoId}/signature.png`;
      await admin.storage.from(BUCKET).upload(trazoPath, trazoPng, {
        upsert: true,
        contentType: "image/png",
      });
    }

    const firmadoEnIso = new Date().toISOString();
    const firmadoEvento = await registrarEvento({
      documentoId,
      tipo: "firmado",
      actorUserId: (emp?.user_id as string) ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { modalidad: doc.modalidad, firmadoEn: firmadoEnIso },
    });

    const eventos = await listarEventos(documentoId);

    const empleadoEmail =
      (emp?.email_empresa as string | null) || (emp?.email_personal as string | null);
    const datos: DatosActa = {
      documentoId,
      titulo: doc.titulo as string,
      tipo: doc.tipo as string,
      modalidad: doc.modalidad as string,
      validez: doc.validez as string,
      empresaNombre: (empresa?.nombre as string) ?? "—",
      empleadoNombre: `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim() || "—",
      empleadoDni: (emp?.dni_nie as string | null) ?? null,
      empleadoEmail,
      enviadoPor: (enviadoPorUser?.full_name as string) || (enviadoPorUser?.email as string) || "Administrador",
      enviadoEn: doc.enviado_en as string,
      firmadoEn: firmadoEnIso,
      ipFirma: meta.ip,
      userAgent: meta.userAgent,
      sha256Original: doc.sha256_original as string,
      trazoFirmaPng: trazoPng,
    };

    const actaBytes = await generarActa(datos, eventos);
    const { data: originalDl, error: dlErr } = await admin.storage
      .from(BUCKET)
      .download(doc.pdf_original_path as string);
    if (dlErr || !originalDl) {
      return { ok: false, error: "No se pudo cargar el PDF original" };
    }
    const originalBytes = new Uint8Array(await originalDl.arrayBuffer());
    const firmadoBytes = await aplicarFirmaYConcatenar(
      originalBytes,
      actaBytes,
      trazoPng,
      input.posicionFirma ?? null,
    );
    const sha256Acta = sha256(Buffer.from(firmadoBytes));

    const firmadoPath = `${doc.empresa_id}/${documentoId}/firmado.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(firmadoPath, firmadoBytes, { upsert: true, contentType: "application/pdf" });
    if (upErr) return { ok: false, error: `No se pudo guardar el PDF firmado: ${upErr.message}` };

    await admin
      .from("firmas_documentos")
      .update({
        estado: "firmado",
        firmado_en: firmadoEnIso,
        ip_firma: meta.ip,
        user_agent: meta.userAgent,
        metodo_firma: doc.modalidad,
        pdf_firmado_path: firmadoPath,
        sha256_acta: sha256Acta,
      })
      .eq("id", documentoId);

    // Token ya marcado consumido_en al inicio (R1).
    void firmadoEvento;

    const signed = await admin.storage
      .from(BUCKET)
      .createSignedUrl(firmadoPath, COPIA_TTL_SECONDS);
    const descargaUrl = signed.data?.signedUrl ?? "";

    if (empleadoEmail && descargaUrl) {
      await enviarCopiaFirmada({
        to: empleadoEmail,
        empresaId: doc.empresa_id as string,
        empresaNombre: (empresa?.nombre as string) ?? "Empresa",
        empresaLogoUrl: (empresa?.logo_url as string | null) ?? null,
        empleadoNombre: datos.empleadoNombre,
        tituloDocumento: doc.titulo as string,
        firmadoEn: new Date(firmadoEnIso),
        signedUrl: descargaUrl,
      });
    }

    // Documento firmado: el aviso in-app de "documento para firmar" queda leído.
    // Corre con service role porque la firma ocurre por enlace público, sin sesión
    // del empleado. Complementario: si falla, no debe tumbar la firma ya completada.
    try {
      await marcarNotificacionesVistasPorRef("firmas_documentos", documentoId);
    } catch (e) {
      console.error("[firmar/firmar] cerrar notificación:", e);
    }

    return { ok: true, descargaUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error firmando documento";
    console.error("[firmar/firmar]", msg);
    return { ok: false, error: msg };
  }
}

export async function getEstadoFirma(
  token: string,
): Promise<{ estado: "pendiente" | "firmado" | "rechazado" | "expirado" | null; descargaUrl?: string }> {
  try {
    const admin = createAdminClient();
    const tokenHash = hashToken(token);
    const { data: tk } = await admin
      .from("firmas_tokens")
      .select("documento_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!tk) return { estado: null };
    const { data: doc } = await admin
      .from("firmas_documentos")
      .select("estado, pdf_firmado_path")
      .eq("id", tk.documento_id)
      .maybeSingle();
    if (!doc) return { estado: null };
    let descargaUrl: string | undefined;
    if (doc.estado === "firmado" && doc.pdf_firmado_path) {
      const signed = await admin.storage
        .from(BUCKET)
        .createSignedUrl(doc.pdf_firmado_path as string, COPIA_TTL_SECONDS);
      descargaUrl = signed.data?.signedUrl ?? undefined;
    }
    return { estado: doc.estado as "pendiente" | "firmado" | "rechazado" | "expirado", descargaUrl };
  } catch {
    return { estado: null };
  }
}

export async function rechazarDocumento(
  token: string,
  motivo?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await resolverToken(token);
    if (!res.ok) return { ok: false, error: "Enlace no válido o caducado" };

    const admin = createAdminClient();
    const documentoId = res.tokenRow.documento_id as string;
    const meta = await getMeta();

    const { data: doc } = await admin
      .from("firmas_documentos")
      .select("estado, empleado_id")
      .eq("id", documentoId)
      .maybeSingle();
    if (!doc) return { ok: false, error: "Documento no encontrado" };
    if (doc.estado !== "pendiente") return { ok: false, error: "Documento ya cerrado" };

    const { data: emp } = await admin
      .from("empleados")
      .select("user_id")
      .eq("id", doc.empleado_id)
      .maybeSingle();

    await admin
      .from("firmas_documentos")
      .update({
        estado: "rechazado",
        motivo_rechazo: motivo?.trim() || null,
        ip_firma: meta.ip,
        user_agent: meta.userAgent,
      })
      .eq("id", documentoId);

    await admin
      .from("firmas_tokens")
      .update({ consumido_en: new Date().toISOString() })
      .eq("id", res.tokenRow.id);

    await registrarEvento({
      documentoId,
      tipo: "rechazado",
      actorUserId: (emp?.user_id as string) ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { motivo: motivo?.trim() || null },
    });

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error rechazando";
    console.error("[firmar/rechazar]", msg);
    return { ok: false, error: msg };
  }
}
