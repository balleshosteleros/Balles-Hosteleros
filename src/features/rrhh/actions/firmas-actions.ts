"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAppContext } from "@/lib/supabase/get-context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256, generarToken, hashToken } from "@/features/rrhh/services/firmas/crypto";
import { registrarEvento, listarEventos, verificarCadena } from "@/features/rrhh/services/firmas/audit";
import { enviarInvitacionFirma } from "@/features/rrhh/services/firmas/email";
import {
  detectarHuecoFirma,
  huecoFirmaPorDefecto,
  contarPaginas,
} from "@/features/rrhh/services/firmas/detectar-hueco-firma";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { MAX_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES } from "@/shared/lib/documentos";

const BUCKET = "firmas";
const SIGNED_URL_TTL_DESCARGA = 60 * 60 * 24 * 7; // 7 días para copia firmada
const SIGNED_URL_TTL_VISOR = 60 * 5;              // 5 min para visor de firma
const MAX_PDF_BYTES = MAX_DOCUMENTO_BYTES;         // 50 MB (tope unificado de documentos)
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
  /** Reconocimiento médico: qué contestó el trabajador. NULL en el resto. */
  decisionReconocimiento: "si" | "no" | null;
  /**
   * Primera apertura del documento por el destinatario (acuse de LECTURA), leída
   * del acta eIDAS. NULL si nunca lo abrió. Es la constancia que sostiene una
   * comunicación de baja cuando el trabajador decide no firmarla.
   */
  leidoEn: string | null;
};

/**
 * Resuelve la PRIMERA apertura de cada documento a partir del acta (evento
 * `abierto`). Se hace en una sola consulta para no disparar una por fila.
 */
async function resolverLecturas(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  documentoIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (documentoIds.length === 0) return out;
  const { data } = await supabase
    .from("firmas_eventos")
    .select("documento_id, ocurrido_en")
    .in("documento_id", documentoIds)
    .eq("tipo", "abierto")
    .order("ocurrido_en", { ascending: true });
  for (const row of (data ?? []) as { documento_id: string; ocurrido_en: string }[]) {
    // Orden ascendente: el primero que entra es la primera lectura.
    if (!out.has(row.documento_id)) out.set(row.documento_id, row.ocurrido_en);
  }
  return out;
}

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

  // Manda el permiso RECURSOS HUMANOS (editar) de Ajustes → Roles, no el flag
  // de director.
  const { permisos } = await getRolContext();
  if (!puedeEditarModulo(permisos, "RECURSOS HUMANOS")) {
    throw new Error("Sin permisos: necesitas Recursos Humanos para gestionar firmas");
  }

  const { empresaId } = await getAppContext();
  if (!empresaId) throw new Error("Empresa no resuelta para el usuario actual");

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.email as string | undefined) ||
    "Administrador";

  return { userId: user.id, userName: fullName, empresaId };
}

// `firmas_documentos.enviado_por` guarda el UUID del usuario que envió el documento.
// Para poder mostrar "Enviado por Nombre Apellidos" en las listas resolvemos los UUID
// contra `usuarios` en una sola consulta. Si un UUID no tiene ficha (usuario borrado),
// se devuelve tal cual y la vista ya lo pinta como "—".
async function resolverNombresEnviadoPor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = [...new Set(userIds.filter(Boolean))];
  if (unicos.length === 0) return mapa;

  const { data, error } = await supabase
    .from("usuarios")
    .select("user_id, nombre, apellidos, full_name, email")
    .in("user_id", unicos);
  if (error) return mapa;

  type FilaUsuario = {
    user_id: string;
    nombre: string | null;
    apellidos: string | null;
    full_name: string | null;
    email: string | null;
  };
  for (const u of (data ?? []) as FilaUsuario[]) {
    // `nombre` + `apellidos` es la fuente fiable: `full_name` puede venir vacío en
    // fichas anteriores a que el alta lo rellenara. El email es el último recurso.
    const nombre =
      `${u.nombre ?? ""} ${u.apellidos ?? ""}`.trim() ||
      (u.full_name ?? "").trim() ||
      (u.email ?? "").trim();
    if (nombre) mapa.set(u.user_id, nombre);
  }
  return mapa;
}

// Aviso in-app al empleado de que tiene un documento para firmar. Acompaña al
// email de invitación: el botón "Firmar" abre el mismo enlace de firma. El
// `refTabla`/`refId` permiten que, al firmar, la notificación quede marcada como
// leída automáticamente (ver firmarDocumento → marcarNotificacionesVistasPorRef).
// El `dedupeKey` por documento evita duplicar el aviso si se reenvía el enlace.
async function notificarFirmaPendiente(args: {
  empresaId: string;
  empleadoId: string;
  documentoId: string;
  tituloDocumento: string;
  token: string;
}): Promise<void> {
  try {
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com").replace(/\/$/, "");
    const url = `${base}/firmar/${encodeURIComponent(args.token)}`;
    await emitirNotificacion({
      empresaId: args.empresaId,
      tipo: "firma_pendiente",
      titulo: "Tienes un documento para firmar",
      mensaje: `«${args.tituloDocumento}» está pendiente de tu firma.`,
      segmento: { tipo: "empleados", empleadoIds: [args.empleadoId] },
      accionLabel: "Firmar",
      accionUrl: url || "/mi-panel/documentos",
      refTabla: "firmas_documentos",
      refId: args.documentoId,
      dedupeKey: `firma-${args.documentoId}`,
      system: true,
    });
  } catch (err) {
    // El aviso es complementario: si falla, el documento ya se envió por email.
    console.error("[firmas] notificarFirmaPendiente:", err);
  }
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
        ip_firma, sha256_original, sha256_acta, reenviado_count, decision_reconocimiento,
        empleados!firmas_documentos_empleado_id_fkey ( id, nombre, apellidos, departamentos!empleados_departamento_id_fkey ( nombre ) )
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
      decision_reconocimiento: "si" | "no" | null;
      empleados: { id: string; nombre: string | null; apellidos: string | null;
        departamentos: { nombre: string | null } | null; } | null;
    };
    const filas = data as unknown as Row[];
    const [nombresEnviadoPor, lecturas] = await Promise.all([
      resolverNombresEnviadoPor(supabase, filas.map((r) => r.enviado_por)),
      resolverLecturas(supabase, filas.map((r) => r.id)),
    ]);
    const items: FirmaResumen[] = filas.map((r) => ({
      id: r.id, titulo: r.titulo, tipo: r.tipo, modalidad: r.modalidad,
      validez: r.validez, estado: r.estado, empleadoId: r.empleado_id,
      empleadoNombre: `${r.empleados?.nombre ?? ""} ${r.empleados?.apellidos ?? ""}`.trim() || "—",
      departamento: r.empleados?.departamentos?.nombre ?? "—",
      enviadoPor: nombresEnviadoPor.get(r.enviado_por) ?? r.enviado_por,
      enviadoEn: r.enviado_en, expiraEn: r.expira_en,
      firmadoEn: r.firmado_en, ipFirma: r.ip_firma,
      sha256Original: r.sha256_original, sha256Acta: r.sha256_acta,
      reenviadoCount: r.reenviado_count,
      decisionReconocimiento: r.decision_reconocimiento,
      leidoEn: lecturas.get(r.id) ?? null,
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
        ip_firma, sha256_original, sha256_acta, reenviado_count, decision_reconocimiento,
        empleados!firmas_documentos_empleado_id_fkey ( id, nombre, apellidos, departamentos!empleados_departamento_id_fkey ( nombre ) )
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
      decision_reconocimiento: "si" | "no" | null;
      empleados: {
        id: string;
        nombre: string | null;
        apellidos: string | null;
        departamentos: { nombre: string | null } | null;
      } | null;
    };

    const filas = data as unknown as Row[];
    const [nombresEnviadoPor, lecturas] = await Promise.all([
      resolverNombresEnviadoPor(supabase, filas.map((r) => r.enviado_por)),
      resolverLecturas(supabase, filas.map((r) => r.id)),
    ]);

    const items: FirmaResumen[] = filas.map((r) => {
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
        enviadoPor: nombresEnviadoPor.get(r.enviado_por) ?? r.enviado_por,
        enviadoEn: r.enviado_en,
        expiraEn: r.expira_en,
        firmadoEn: r.firmado_en,
        ipFirma: r.ip_firma,
        sha256Original: r.sha256_original,
        sha256Acta: r.sha256_acta,
        reenviadoCount: r.reenviado_count,
        decisionReconocimiento: r.decision_reconocimiento,
        leidoEn: lecturas.get(r.id) ?? null,
      };
    });

    return { ok: true, data: items };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : (err as { message?: string })?.message || JSON.stringify(err);
    console.error("[firmas] listFirmas:", msg, err);
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
    if (file.size > MAX_PDF_BYTES) return { ok: false, error: `El PDF supera ${MAX_DOCUMENTO_MB} MB` };
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

    // Dónde va la firma. Antes esto quedaba a null y el visor la estampaba en el
    // centro de la página 1, tapando el documento y obligando al empleado a
    // colocarla a mano. Ahora se localizan TODOS los huecos reales del documento
    // (texto → IA → pie de la última página) y el empleado dibuja un solo trazo
    // que se estampa en cada uno de ellos.
    const huecosDetectados = await detectarHuecoFirma(pdfBuffer);
    const posicionFirmaDefault =
      huecosDetectados.length > 0
        ? huecosDetectados
        : [await huecoFirmaPorDefecto(pdfBuffer, await contarPaginas(pdfBuffer))];

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
        posicion_firma_default: posicionFirmaDefault,
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

    await notificarFirmaPendiente({
      empresaId,
      empleadoId,
      documentoId,
      tituloDocumento: titulo,
      token,
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
    // Junto al token se invalidan los OTP: si no, un código ya validado del envío
    // anterior seguiría autorizando la firma y quien reciba el enlace nuevo
    // firmaría sin que se le pida ningún código. Renovar enlace = reiniciar 2FA.
    await admin.from("firmas_otps").delete().eq("documento_id", documentoId);

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

    // El token cambió: retira el aviso anterior (apunta a un enlace ya inválido)
    // y emite uno nuevo con el enlace vigente. Sin esto, el `dedupeKey` impediría
    // re-crear el aviso y el empleado tendría en la bandeja un enlace caducado.
    await admin
      .from("notificaciones")
      .delete()
      .eq("entidad_tipo", "firmas_documentos")
      .eq("entidad_id", documentoId)
      .is("vista_at", null);
    await notificarFirmaPendiente({
      empresaId,
      empleadoId: doc.empleado_id as string,
      documentoId,
      tituloDocumento: doc.titulo as string,
      token,
    });

    revalidatePath("/rrhh/firmas");
    return { ok: true, emailEnviado: sendResult.ok };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[firmas] reenviarFirma:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Cierra un documento pendiente: lo marca expirado e invalida su token y sus
 * OTP. Es el núcleo de `cancelarFirma`, sin la barrera de permisos, para que
 * flujos internos que YA validaron al actor (p. ej. borrar una entrega) puedan
 * cerrar sus actas sin depender del permiso de Firmas del usuario.
 *
 * Devuelve el resultado: quien lo llame DEBE comprobarlo antes de borrar nada,
 * o dejaría vivo un enlace capaz de firmar algo que ya no existe.
 */
export async function cancelarFirmaInterno(
  documentoId: string,
  empresaId: string,
  actorUserId?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const meta = await getRequestMeta();

    const { data: doc } = await admin
      .from("firmas_documentos")
      .select("id, empresa_id, estado")
      .eq("id", documentoId)
      .maybeSingle();
    if (!doc) return { ok: false, error: "Documento no encontrado" };
    if (doc.empresa_id !== empresaId) return { ok: false, error: "Sin acceso a este documento" };
    // Ya cerrado (expirado por el cron, cancelado antes): no hay nada que hacer
    // y NO es un error para quien solo quiere asegurarse de que no queda vivo.
    if (doc.estado !== "pendiente") return { ok: true };

    await admin
      .from("firmas_documentos")
      .update({ estado: "expirado" })
      .eq("id", documentoId);
    await admin.from("firmas_tokens").delete().eq("documento_id", documentoId);
    await admin.from("firmas_otps").delete().eq("documento_id", documentoId);

    await registrarEvento({
      documentoId,
      tipo: "expirado",
      actorUserId: actorUserId ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { motivo: "cancelado_interno" },
    });

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[firmas] cancelarFirmaInterno:", msg);
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
    // Junto al token se invalidan los OTP: si no, un código ya validado del envío
    // anterior seguiría autorizando la firma y quien reciba el enlace nuevo
    // firmaría sin que se le pida ningún código. Renovar enlace = reiniciar 2FA.
    await admin.from("firmas_otps").delete().eq("documento_id", documentoId);

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
    // El acta solo se sirve si el documento es de la empresa activa: la RLS no
    // aísla por sí sola la empresa en curso (ver memoria de aislamiento).
    const { data: doc, error: docErr } = await supabase
      .from("firmas_documentos")
      .select("id")
      .eq("id", documentoId)
      .eq("empresa_id", empresaId)
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
      .select("empresa_id, estado, pdf_firmado_path, titulo")
      .eq("id", documentoId)
      .maybeSingle();
    if (!doc) return { ok: false, error: "Documento no encontrado" };
    if (doc.empresa_id !== empresaId) return { ok: false, error: "Sin acceso a este documento" };
    if (doc.estado !== "firmado" || !doc.pdf_firmado_path) {
      return { ok: false, error: "El documento aún no está firmado" };
    }

    // `download` hace que Storage sirva el PDF con Content-Disposition: attachment,
    // así el navegador lo guarda directamente en el ordenador en vez de abrirlo en
    // una pestaña y obligar a descargarlo otra vez desde el visor.
    const nombreArchivo = `${String(doc.titulo ?? "documento")
      .replace(/[\\/:*?"<>|]/g, "-")
      .trim() || "documento"}.pdf`;

    const signed = await admin.storage
      .from(BUCKET)
      .createSignedUrl(doc.pdf_firmado_path as string, SIGNED_URL_TTL_DESCARGA, {
        download: nombreArchivo,
      });
    if (signed.error || !signed.data?.signedUrl) {
      return { ok: false, error: signed.error?.message ?? "No se pudo generar URL" };
    }
    return { ok: true, url: signed.data.signedUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: msg };
  }
}

/**
 * URL firmada del PDF ya firmado, SIN `download`, para incrustarlo en un visor
 * dentro de la propia página. `getDescargaFirmadoUrl` fuerza la descarga con
 * Content-Disposition: attachment, y eso deja el <iframe> en blanco.
 */
export async function getVisorFirmadoUrl(
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
      .createSignedUrl(doc.pdf_firmado_path as string, SIGNED_URL_TTL_VISOR);
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
