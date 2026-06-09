"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAppContext } from "@/lib/supabase/get-context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256, generarToken, hashToken } from "@/features/rrhh/services/firmas/crypto";
import { registrarEvento, listarEventos, verificarCadena } from "@/features/rrhh/services/firmas/audit";
import { enviarInvitacionFirma } from "@/features/rrhh/services/firmas/email";

const BUCKET = "firmas";
const SIGNED_URL_TTL_DESCARGA = 60 * 60 * 24 * 7; // 7 días para copia firmada
const SIGNED_URL_TTL_VISOR = 60 * 5;              // 5 min para visor de firma
const ROLES_ADMIN = ["admin", "director"] as const;
const MAX_PDF_BYTES = 10 * 1024 * 1024;            // 10 MB
const MODALIDADES = ["click_to_sign", "email_otp", "manuscrita_digital"] as const;

type Modalidad = (typeof MODALIDADES)[number];

type FirmaResumen = {
  id: string;
  titulo: string;
  tipo: string;
  modalidad: Modalidad;
  validez: string;
  estado: string;
  empleadoId: string;
  empleadoNombre: string;
  departamento: string;
  enviadoPor: string;
  enviadoEn: string;
  expiraEn: string;
  firmadoEn: string | null;
  ipFirma: string | null;
  sha256Original: string;
  sha256Acta: string | null;
  reenviadoCount: number;
};

async function getRequestMeta() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const userAgent = h.get("user-agent") || null;
  return { ip, userAgent };
}

async function requireAdmin(): Promise<{ userId: string; userName: string; empresaId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: roles } = await supabase
    .from("usuario_roles")
    .select("role")
    .eq("user_id", user.id);
  const ok = (roles ?? []).some((r: { role: string }) =>
    (ROLES_ADMIN as readonly string[]).includes(r.role),
  );
  if (!ok) throw new Error("Solo admin o director pueden gestionar firmas");

  const { empresaId } = await getAppContext();
  if (!empresaId) throw new Error("Empresa no resuelta para el usuario actual");

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.email as string | undefined) ||
    "Administrador";

  return { userId: user.id, userName: fullName, empresaId };
}

export async function listFirmasPorEmpleado(
  empleadoId: string,
): Promise<{ ok: true; data: FirmaResumen[] } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("firmas_documentos")
      .select(`
        id, titulo, tipo, modalidad, validez, estado,
        empleado_id, enviado_por, enviado_en, expira_en, firmado_en,
        ip_firma, sha256_original, sha256_acta, reenviado_count,
        empleados!firmas_documentos_empleado_id_fkey ( id, nombre, apellidos, departamentos ( nombre ) )
      `)
      .eq("empresa_id", empresaId)
      .eq("empleado_id", empleadoId)
      .order("enviado_en", { ascending: false });
    if (error) throw error;

    type Row = {
      id: string; titulo: string; tipo: string; modalidad: Modalidad;
      validez: string; estado: string; empleado_id: string;
      enviado_por: string; enviado_en: string; expira_en: string;
      firmado_en: string | null; ip_firma: string | null;
      sha256_original: string; sha256_acta: string | null; reenviado_count: number;
      empleados: { id: string; nombre: string | null; apellidos: string | null;
        departamentos: { nombre: string | null } | null; } | null;
    };
    const items: FirmaResumen[] = (data as unknown as Row[]).map((r) => ({
      id: r.id, titulo: r.titulo, tipo: r.tipo, modalidad: r.modalidad,
      validez: r.validez, estado: r.estado, empleadoId: r.empleado_id,
      empleadoNombre: `${r.empleados?.nombre ?? ""} ${r.empleados?.apellidos ?? ""}`.trim() || "—",
      departamento: r.empleados?.departamentos?.nombre ?? "—",
      enviadoPor: r.enviado_por, enviadoEn: r.enviado_en, expiraEn: r.expira_en,
      firmadoEn: r.firmado_en, ipFirma: r.ip_firma,
      sha256Original: r.sha256_original, sha256Acta: r.sha256_acta,
      reenviadoCount: r.reenviado_count,
    }));
    return { ok: true, data: items };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    return { ok: false, error: msg };
  }
}

export async function listFirmas(): Promise<{ ok: true; data: FirmaResumen[] } | { ok: false; error: string }> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("firmas_documentos")
      .select(`
        id, titulo, tipo, modalidad, validez, estado,
        empleado_id, enviado_por, enviado_en, expira_en, firmado_en,
        ip_firma, sha256_original, sha256_acta, reenviado_count,
        empleados!firmas_documentos_empleado_id_fkey ( id, nombre, apellidos, departamentos ( nombre ) )
      `)
      .eq("empresa_id", empresaId)
      .order("enviado_en", { ascending: false });

    if (error) throw error;

    type Row = {
      id: string;
      titulo: string;
      tipo: string;
      modalidad: Modalidad;
      validez: string;
      estado: string;
      empleado_id: string;
      enviado_por: string;
      enviado_en: string;
      expira_en: string;
      firmado_en: string | null;
      ip_firma: string | null;
      sha256_original: string;
      sha256_acta: string | null;
      reenviado_count: number;
      empleados: {
        id: string;
        nombre: string | null;
        apellidos: string | null;
        departamentos: { nombre: string | null } | null;
      } | null;
    };

    const items: FirmaResumen[] = (data as unknown as Row[]).map((r) => {
      const empNombre = `${r.empleados?.nombre ?? ""} ${r.empleados?.apellidos ?? ""}`.trim();
      return {
        id: r.id,
        titulo: r.titulo,
        tipo: r.tipo,
        modalidad: r.modalidad,
        validez: r.validez,
        estado: r.estado,
        empleadoId: r.empleado_id,
        empleadoNombre: empNombre || "—",
        departamento: r.empleados?.departamentos?.nombre ?? "—",
        enviadoPor: r.enviado_por,
        enviadoEn: r.enviado_en,
        expiraEn: r.expira_en,
        firmadoEn: r.firmado_en,
        ipFirma: r.ip_firma,
        sha256Original: r.sha256_original,
        sha256Acta: r.sha256_acta,
        reenviadoCount: r.reenviado_count,
      };
    });

    return { ok: true, data: items };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error listando firmas";
    console.error("[firmas] listFirmas:", msg);
    return { ok: false, error: msg };
  }
}

export type CrearFirmaResult =
  | { ok: true; documentoId: string; emailEnviado: boolean }
  | { ok: false; error: string };

export async function crearFirma(formData: FormData): Promise<CrearFirmaResult> {
  try {
    const { userId, userName, empresaId } = await requireAdmin();
    const admin = createAdminClient();
    const meta = await getRequestMeta();

    const file = formData.get("file");
    const empleadoId = String(formData.get("empleadoId") ?? "").trim();
    const titulo = String(formData.get("titulo") ?? "").trim();
    const tipo = String(formData.get("tipo") ?? "contrato").trim();
    const modalidadRaw = String(formData.get("modalidad") ?? "click_to_sign").trim();
    const validez = String(formData.get("validez") ?? "eidas_simple").trim();
    const plazoDias = Math.max(1, Math.min(60, Number(formData.get("plazoDias") ?? 7) || 7));
    const observaciones = String(formData.get("observaciones") ?? "").trim() || null;

    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: "Falta el PDF a firmar" };
    }
    if (file.size > MAX_PDF_BYTES) return { ok: false, error: "El PDF supera 10 MB" };
    if (file.type && file.type !== "application/pdf") {
      return { ok: false, error: "Solo se aceptan archivos PDF" };
    }
    if (!empleadoId) return { ok: false, error: "Falta empleado destinatario" };
    if (!titulo) return { ok: false, error: "Falta el título del documento" };
    if (!(MODALIDADES as readonly string[]).includes(modalidadRaw)) {
      return { ok: false, error: "Modalidad no soportada" };
    }
    const modalidad = modalidadRaw as Modalidad;

    const { data: emp, error: empErr } = await admin
      .from("empleados")
      .select("id, nombre, apellidos, email_empresa, email_personal, empresa_id, estado")
      .eq("id", empleadoId)
      .maybeSingle();
    if (empErr || !emp) return { ok: false, error: "Empleado no encontrado" };
    if (emp.empresa_id !== empresaId) return { ok: false, error: "El empleado no pertenece a tu empresa" };
    if (emp.estado !== "Activo") return { ok: false, error: "El empleado no está activo" };

    const destino = (emp.email_empresa as string | null) || (emp.email_personal as string | null);
    if (!destino) return { ok: false, error: "El empleado no tiene email; añádelo antes de enviar" };

    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre, logo_url")
      .eq("id", empresaId)
      .maybeSingle();
    const empresaNombre = (empresa?.nombre as string) ?? "Tu empresa";
    const empresaLogoUrl = (empresa?.logo_url as string | null) ?? null;

    const ab = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(ab);
    const sha256Original = sha256(pdfBuffer);

    const ahora = new Date();
    const expira = new Date(ahora.getTime() + plazoDias * 86_400_000);

    const { data: docIns, error: docErr } = await admin
      .from("firmas_documentos")
      .insert({
        empresa_id: empresaId,
        empleado_id: empleadoId,
        titulo,
        tipo,
        modalidad,
        validez,
        estado: "pendiente",
        pdf_original_path: "pending",
        sha256_original: sha256Original,
        enviado_por: userId,
        enviado_en: ahora.toISOString(),
        expira_en: expira.toISOString(),
        observaciones,
      })
      .select("id")
      .single();
    if (docErr || !docIns) {
      return { ok: false, error: docErr?.message ?? "No se pudo registrar el documento" };
    }
    const documentoId = docIns.id as string;
    const path = `${empresaId}/${documentoId}/original.pdf`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, pdfBuffer, { upsert: false, contentType: "application/pdf" });
    if (upErr) {
      await admin.from("firmas_documentos").delete().eq("id", documentoId);
      return { ok: false, error: `Subida a Storage falló: ${upErr.message}` };
    }

    const { error: updErr } = await admin
      .from("firmas_documentos")
      .update({ pdf_original_path: path })
      .eq("id", documentoId);
    if (updErr) {
      await admin.storage.from(BUCKET).remove([path]);
      await admin.from("firmas_documentos").delete().eq("id", documentoId);
      return { ok: false, error: updErr.message };
    }

    await registrarEvento({
      documentoId,
      tipo: "creado",
      actorUserId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { titulo, tipo, modalidad, validez, sha256Original },
    });

    const token = generarToken();
    const tokenHash = hashToken(token);
    const { error: tokenErr } = await admin.from("firmas_tokens").insert({
      documento_id: documentoId,
      token_hash: tokenHash,
      expira_en: expira.toISOString(),
    });
    if (tokenErr) {
      await admin.storage.from(BUCKET).remove([path]);
      await admin.from("firmas_documentos").delete().eq("id", documentoId);
      return { ok: false, error: `No se pudo crear el token: ${tokenErr.message}` };
    }

    const empleadoNombre = `${emp.nombre} ${emp.apellidos ?? ""}`.trim();
    const sendResult = await enviarInvitacionFirma({
      to: destino,
      empresaId,
      empresaNombre,
      empresaLogoUrl,
      empleadoNombre,
      tituloDocumento: titulo,
      enviadoPor: userName,
      token,
      expiraEn: expira,
    });

    await registrarEvento({
      documentoId,
      tipo: "enviado",
      actorUserId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: {
        destino,
        emailTransport: sendResult.ok ? sendResult.transport : null,
        emailOk: sendResult.ok,
        emailError: !sendResult.ok && "error" in sendResult ? sendResult.error : null,
      },
    });

    revalidatePath("/rrhh/firmas");
    return { ok: true, documentoId, emailEnviado: sendResult.ok };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[firmas] crearFirma:", msg);
    return { ok: false, error: msg };
  }
}

export async function reenviarFirma(
  documentoId: string,
): Promise<{ ok: true; emailEnviado: boolean } | { ok: false; error: string }> {
  try {
    const { userId, userName, empresaId } = await requireAdmin();
    const admin = createAdminClient();
    const meta = await getRequestMeta();

    const { data: doc, error } = await admin
      .from("firmas_documentos")
      .select("id, empresa_id, empleado_id, titulo, estado, expira_en, reenviado_count")
      .eq("id", documentoId)
      .maybeSingle();
    if (error || !doc) return { ok: false, error: "Documento no encontrado" };
    if (doc.empresa_id !== empresaId) return { ok: false, error: "Sin acceso a este documento" };
    if (doc.estado !== "pendiente") {
      return { ok: false, error: "Solo se pueden reenviar documentos pendientes" };
    }

    const { data: emp } = await admin
      .from("empleados")
      .select("nombre, apellidos, email_empresa, email_personal")
      .eq("id", doc.empleado_id)
      .maybeSingle();
    const destino = (emp?.email_empresa as string | null) || (emp?.email_personal as string | null);
    if (!destino) return { ok: false, error: "El empleado no tiene email" };

    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre, logo_url")
      .eq("id", empresaId)
      .maybeSingle();
    const empresaNombre = (empresa?.nombre as string) ?? "Tu empresa";
    const empresaLogoUrl = (empresa?.logo_url as string | null) ?? null;

    await admin.from("firmas_tokens").delete().eq("documento_id", documentoId);

    const token = generarToken();
    const tokenHash = hashToken(token);
    const { error: tokErr } = await admin.from("firmas_tokens").insert({
      documento_id: documentoId,
      token_hash: tokenHash,
      expira_en: doc.expira_en as string,
    });
    if (tokErr) return { ok: false, error: tokErr.message };

    const empleadoNombre = `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim();
    const sendResult = await enviarInvitacionFirma({
      to: destino,
      empresaId,
      empresaNombre,
      empresaLogoUrl,
      empleadoNombre,
      tituloDocumento: doc.titulo as string,
      enviadoPor: userName,
      token,
      expiraEn: new Date(doc.expira_en as string),
    });

    await admin
      .from("firmas_documentos")
      .update({ reenviado_count: (doc.reenviado_count as number) + 1 })
      .eq("id", documentoId);

    await registrarEvento({
      documentoId,
      tipo: "reenviado",
      actorUserId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { destino, emailOk: sendResult.ok },
    });

    revalidatePath("/rrhh/firmas");
    return { ok: true, emailEnviado: sendResult.ok };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[firmas] reenviarFirma:", msg);
    return { ok: false, error: msg };
  }
}

export async function ampliarPlazoFirma(
  documentoId: string,
  diasPlazo: number,
): Promise<{ ok: true; emailEnviado: boolean } | { ok: false; error: string }> {
  try {
    const dias = Math.floor(diasPlazo);
    if (!Number.isFinite(dias) || dias < 1 || dias > 365) {
      return { ok: false, error: "Plazo inválido. Debe ser un número entre 1 y 365 días." };
    }

    const { userId, userName, empresaId } = await requireAdmin();
    const admin = createAdminClient();
    const meta = await getRequestMeta();

    const { data: doc, error } = await admin
      .from("firmas_documentos")
      .select("id, empresa_id, empleado_id, titulo, estado, reenviado_count")
      .eq("id", documentoId)
      .maybeSingle();
    if (error || !doc) return { ok: false, error: "Documento no encontrado" };
    if (doc.empresa_id !== empresaId) return { ok: false, error: "Sin acceso a este documento" };
    if (doc.estado !== "expirado") {
      return { ok: false, error: "Solo se puede ampliar plazo a firmas expiradas" };
    }

    const { data: emp } = await admin
      .from("empleados")
      .select("nombre, apellidos, email_empresa, email_personal")
      .eq("id", doc.empleado_id)
      .maybeSingle();
    const destino = (emp?.email_empresa as string | null) || (emp?.email_personal as string | null);
    if (!destino) return { ok: false, error: "El empleado no tiene email" };

    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre, logo_url")
      .eq("id", empresaId)
      .maybeSingle();
    const empresaNombre = (empresa?.nombre as string) ?? "Tu empresa";
    const empresaLogoUrl = (empresa?.logo_url as string | null) ?? null;

    const nuevaExpiraEn = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

    // Limpiar tokens anteriores y generar uno nuevo
    await admin.from("firmas_tokens").delete().eq("documento_id", documentoId);
    const token = generarToken();
    const tokenHash = hashToken(token);
    const { error: tokErr } = await admin.from("firmas_tokens").insert({
      documento_id: documentoId,
      token_hash: tokenHash,
      expira_en: nuevaExpiraEn.toISOString(),
    });
    if (tokErr) return { ok: false, error: tokErr.message };

    // Reabrir firma: vuelve a pendiente con nuevo expira_en
    await admin
      .from("firmas_documentos")
      .update({
        estado: "pendiente",
        expira_en: nuevaExpiraEn.toISOString(),
        reenviado_count: (doc.reenviado_count as number) + 1,
      })
      .eq("id", documentoId);

    const empleadoNombre = `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim();
    const sendResult = await enviarInvitacionFirma({
      to: destino,
      empresaId,
      empresaNombre,
      empresaLogoUrl,
      empleadoNombre,
      tituloDocumento: doc.titulo as string,
      enviadoPor: userName,
      token,
      expiraEn: nuevaExpiraEn,
    });

    await registrarEvento({
      documentoId,
      tipo: "reenviado",
      actorUserId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { destino, emailOk: sendResult.ok, motivo: "ampliar_plazo", dias },
    });

    revalidatePath("/rrhh/firmas");
    return { ok: true, emailEnviado: sendResult.ok };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[firmas] ampliarPlazoFirma:", msg);
    return { ok: false, error: msg };
  }
}

export async function cancelarFirma(
  documentoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { userId, empresaId } = await requireAdmin();
    const admin = createAdminClient();
    const meta = await getRequestMeta();

    const { data: doc } = await admin
      .from("firmas_documentos")
      .select("id, empresa_id, estado")
      .eq("id", documentoId)
      .maybeSingle();
    if (!doc) return { ok: false, error: "Documento no encontrado" };
    if (doc.empresa_id !== empresaId) return { ok: false, error: "Sin acceso a este documento" };
    if (doc.estado !== "pendiente") {
      return { ok: false, error: "Solo se cancelan documentos pendientes" };
    }

    await admin
      .from("firmas_documentos")
      .update({ estado: "expirado" })
      .eq("id", documentoId);
    await admin.from("firmas_tokens").delete().eq("documento_id", documentoId);

    await registrarEvento({
      documentoId,
      tipo: "expirado",
      actorUserId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { motivo: "cancelado_manual" },
    });

    revalidatePath("/rrhh/firmas");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[firmas] cancelarFirma:", msg);
    return { ok: false, error: msg };
  }
}

export async function getAuditTrail(documentoId: string) {
  try {
    const { empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };

    const { supabase } = await getAppContext();
    const { data: doc, error: docErr } = await supabase
      .from("firmas_documentos")
      .select("id")
      .eq("id", documentoId)
      .maybeSingle();
    if (docErr || !doc) return { ok: false as const, error: "Sin acceso al documento" };

    const eventos = await listarEventos(documentoId);
    const verificacion = verificarCadena(documentoId, eventos);
    return { ok: true as const, eventos, verificacion };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false as const, error: msg };
  }
}

export async function getDescargaFirmadoUrl(
  documentoId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const { empresaId } = await requireAdmin();
    const admin = createAdminClient();

    const { data: doc } = await admin
      .from("firmas_documentos")
      .select("empresa_id, estado, pdf_firmado_path")
      .eq("id", documentoId)
      .maybeSingle();
    if (!doc) return { ok: false, error: "Documento no encontrado" };
    if (doc.empresa_id !== empresaId) return { ok: false, error: "Sin acceso a este documento" };
    if (doc.estado !== "firmado" || !doc.pdf_firmado_path) {
      return { ok: false, error: "El documento aún no está firmado" };
    }

    const signed = await admin.storage
      .from(BUCKET)
      .createSignedUrl(doc.pdf_firmado_path as string, SIGNED_URL_TTL_DESCARGA);
    if (signed.error || !signed.data?.signedUrl) {
      return { ok: false, error: signed.error?.message ?? "No se pudo generar URL" };
    }
    return { ok: true, url: signed.data.signedUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

export async function getVisorOriginalUrl(
  documentoId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const { empresaId } = await requireAdmin();
    const admin = createAdminClient();

    const { data: doc } = await admin
      .from("firmas_documentos")
      .select("empresa_id, pdf_original_path")
      .eq("id", documentoId)
      .maybeSingle();
    if (!doc) return { ok: false, error: "Documento no encontrado" };
    if (doc.empresa_id !== empresaId) return { ok: false, error: "Sin acceso a este documento" };

    const signed = await admin.storage
      .from(BUCKET)
      .createSignedUrl(doc.pdf_original_path as string, SIGNED_URL_TTL_VISOR);
    if (signed.error || !signed.data?.signedUrl) {
      return { ok: false, error: signed.error?.message ?? "No se pudo generar URL" };
    }
    return { ok: true, url: signed.data.signedUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}
