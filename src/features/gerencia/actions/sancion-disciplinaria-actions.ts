"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAppContext } from "@/lib/supabase/get-context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIdentidadEmpresa } from "@/features/empresa/services/identidad-empresa";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { sha256, generarToken, hashToken } from "@/features/rrhh/services/firmas/crypto";
import { registrarEvento } from "@/features/rrhh/services/firmas/audit";
import { enviarInvitacionFirma } from "@/features/rrhh/services/firmas/email";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import {
  generarSancionPdf,
  GRAVEDAD_LABEL,
  type GravedadSancion,
} from "@/features/gerencia/services/sancion-disciplinaria-pdf";

const BUCKET = "firmas";
const TIPO_DOC = "sancion_disciplinaria";

async function getRequestMeta() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent") || null };
}

async function requireAdmin(): Promise<{ userId: string; empresaId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { permisos } = await getRolContext();
  if (!puedeEditarModulo(permisos, "RECURSOS HUMANOS")) {
    throw new Error("Sin permisos: necesitas Recursos Humanos para emitir sanciones disciplinarias");
  }

  const { empresaId } = await getAppContext();
  if (!empresaId) throw new Error("Empresa no resuelta para el usuario actual");

  // No se devuelve el nombre a propósito: la sanción la impone la EMPRESA y en
  // ningún papel figura quién de la plantilla pulsó el botón. Para el registro
  // interno basta con `userId`, que es lo que se guarda en `enviado_por`.
  return { userId: user.id, empresaId };
}

/** Una línea con lo esencial de la sanción, para el listado y la ficha de firmas. */
function resumenSancion(input: SancionInput): string {
  const partes = [GRAVEDAD_LABEL[input.gravedad]];
  if (input.fechaHechos) partes.push(`hechos del ${fmtFechaEs(input.fechaHechos)}`);
  return partes.join(" · ");
}

function fmtFechaEs(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export interface SancionInput {
  empleadoId: string;
  gravedad: GravedadSancion;
  /** Obligatoria: el art. 58.2 ET exige hacer constar la fecha de los hechos. */
  fechaHechos: string;
  hechos: string;
  fechaEmision: string;
  /** Días de plazo para firmar el acuse de recibo. */
  plazoDias?: number;
}

export type CrearSancionResult =
  | { ok: true; documentoId: string; emailEnviado: boolean }
  | { ok: false; error: string };

/**
 * Emite una SANCIÓN DISCIPLINARIA: genera el PDF oficial, lo registra en el
 * pipeline de firmas (`firmas_documentos`, modalidad manuscrita) y avisa al
 * trabajador por email + notificación in-app para que lo firme como «leído».
 * Al firmar, el motor de firma archiva el PDF firmado en la carpeta de
 * documentos del empleado (categoría `sanciones`).
 */
export async function crearSancionDisciplinaria(
  input: SancionInput,
): Promise<CrearSancionResult> {
  try {
    const { userId, empresaId } = await requireAdmin();
    const admin = createAdminClient();
    const meta = await getRequestMeta();

    const empleadoId = (input.empleadoId ?? "").trim();
    if (!empleadoId) return { ok: false, error: "Falta el trabajador destinatario" };
    if (!input.hechos?.trim()) return { ok: false, error: "Describe los hechos que motivan la sanción" };
    // Sin fecha de los hechos la comunicación no cumple el art. 58.2 ET.
    if (!input.fechaHechos) return { ok: false, error: "Falta la fecha de los hechos" };
    if (!input.fechaEmision) return { ok: false, error: "Falta la fecha de emisión" };

    const plazoDias = Math.max(1, Math.min(60, Number(input.plazoDias ?? 15) || 15));

    // El selector de la pantalla trabaja con el id de USUARIO (el del acceso), y
    // la ficha del trabajador vive en `empleados` con su propio id. Son cosas
    // distintas y nunca coinciden, así que se acepta cualquiera de los dos: se
    // busca primero por la ficha y, si no aparece, por el usuario al que pertenece.
    const CAMPOS_EMPLEADO =
      "id, nombre, apellidos, dni_nie, puesto, email_empresa, email_personal, empresa_id, estado, departamentos!empleados_departamento_id_fkey ( nombre )";

    const { data: porFicha, error: empErr } = await admin
      .from("empleados")
      .select(CAMPOS_EMPLEADO)
      .eq("id", empleadoId)
      .maybeSingle();
    if (empErr) return { ok: false, error: "Trabajador no encontrado" };

    let emp = porFicha;
    if (!emp) {
      // Un mismo usuario puede tener ficha en varias empresas (espejos), así que
      // se acota a la empresa activa para quedarse con la que toca.
      const { data: porUsuario } = await admin
        .from("empleados")
        .select(CAMPOS_EMPLEADO)
        .eq("user_id", empleadoId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      emp = porUsuario;
    }
    if (!emp) return { ok: false, error: "Trabajador no encontrado" };
    if (emp.empresa_id !== empresaId) return { ok: false, error: "El trabajador no pertenece a tu empresa" };
    if (emp.estado !== "Activo") return { ok: false, error: "El trabajador no está activo" };

    const destino = (emp.email_empresa as string | null) || (emp.email_personal as string | null);
    if (!destino) return { ok: false, error: "El trabajador no tiene email; añádelo antes de enviar" };

    // Quién sanciona sale de Ajustes → Empresa: razón social, NIF y domicilio.
    const empresa = await getIdentidadEmpresa(admin, empresaId);
    const empresaNombre = empresa.nombre;
    const empresaLogoUrl = empresa.marcaUrl;

    // A partir de aquí SIEMPRE el id de la ficha: `empleadoId` es lo que llegó de
    // la pantalla y puede ser el id del usuario, que no vale para guardar.
    const fichaId = emp.id as string;
    const empleadoNombre = `${emp.nombre ?? ""} ${emp.apellidos ?? ""}`.trim();
    const departamento =
      (emp as unknown as { departamentos?: { nombre?: string | null } | null }).departamentos?.nombre ?? null;

    // 1) Generar el PDF oficial de la sanción.
    const { bytes: pdfBytes, posicionFirma } = await generarSancionPdf({
      empresaNombre,
      empresaRazonSocial: empresa.razonSocial,
      empresaCif: empresa.cif,
      empresaDomicilio: empresa.domicilio,
      empleadoNombre: empleadoNombre || "Trabajador/a",
      empleadoDni: (emp.dni_nie as string | null) ?? null,
      puesto: (emp.puesto as string | null) ?? null,
      departamento,
      gravedad: input.gravedad,
      fechaHechos: input.fechaHechos,
      hechos: input.hechos.trim(),
      fechaEmision: input.fechaEmision,
    });
    const pdfBuffer = Buffer.from(pdfBytes);
    const sha256Original = sha256(pdfBuffer);

    // La banda de firma la mide el propio generador: el motor estampa el trazo
    // justo en el recuadro, sea cual sea la página en la que acabe el documento.
    const posicionFirmaDefault = [posicionFirma];

    const titulo = `Sanción disciplinaria — ${empleadoNombre || "Trabajador/a"}`;
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + plazoDias * 86_400_000);

    // 2) Registrar el documento firmable.
    const { data: docIns, error: docErr } = await admin
      .from("firmas_documentos")
      .insert({
        empresa_id: empresaId,
        empleado_id: fichaId,
        titulo,
        tipo: TIPO_DOC,
        modalidad: "manuscrita_digital",
        validez: "eidas_simple",
        estado: "pendiente",
        pdf_original_path: "pending",
        sha256_original: sha256Original,
        enviado_por: userId,
        enviado_en: ahora.toISOString(),
        expira_en: expira.toISOString(),
        posicion_firma_default: posicionFirmaDefault,
        // Resumen en una línea: es lo que el listado usa para enseñar la
        // calificación de la falta sin abrir el PDF, y lo que se lee tal cual en
        // la ficha del documento dentro de RRHH → Firmas.
        observaciones: resumenSancion(input),
      })
      .select("id")
      .single();
    if (docErr || !docIns) {
      return { ok: false, error: docErr?.message ?? "No se pudo registrar la sanción" };
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
    await admin.from("firmas_documentos").update({ pdf_original_path: path }).eq("id", documentoId);

    await registrarEvento({
      documentoId,
      tipo: "creado",
      actorUserId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { titulo, tipo: TIPO_DOC, gravedad: input.gravedad, sha256Original },
    });

    // 3) Token de firma de un solo uso.
    const token = generarToken();
    const { error: tokenErr } = await admin.from("firmas_tokens").insert({
      documento_id: documentoId,
      token_hash: hashToken(token),
      expira_en: expira.toISOString(),
    });
    if (tokenErr) {
      await admin.storage.from(BUCKET).remove([path]);
      await admin.from("firmas_documentos").delete().eq("id", documentoId);
      return { ok: false, error: `No se pudo crear el token: ${tokenErr.message}` };
    }

    // 4) Email de invitación (con tono de acuse de recibo) + notificación in-app.
    const sendResult = await enviarInvitacionFirma({
      to: destino,
      empresaId,
      empresaNombre,
      empresaLogoUrl,
      empleadoNombre: empleadoNombre || "Trabajador/a",
      tituloDocumento: titulo,
      // La sanción la impone la empresa: en el correo tampoco se señala a nadie.
      enviadoPor: empresaNombre,
      token,
      expiraEn: expira,
      asuntoOverride: `Comunicación de sanción disciplinaria — ${empresaNombre}`,
      introOverride:
        `Hola ${empleadoNombre || ""},\n\n` +
        `La dirección de ${empresa.razonSocial} te comunica una sanción disciplinaria. ` +
        `Debes firmar el documento como acuse de recibo (leído/informado). ` +
        `La firma NO implica conformidad: conservas tu derecho a impugnarla.`,
    });

    await registrarEvento({
      documentoId,
      tipo: "enviado",
      actorUserId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { destino, emailOk: sendResult.ok },
    });

    try {
      const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.balleshosteleros.com").replace(/\/$/, "");
      await emitirNotificacion({
        empresaId,
        // El MISMO tipo y la misma clave de deduplicación que cualquier otro
        // documento firmable: así el aviso se marca solo al firmar y reenviar la
        // sanción no le deja dos avisos distintos de lo mismo en la bandeja.
        tipo: "firma_pendiente",
        titulo: "Sanción disciplinaria — firma requerida",
        mensaje: "Has recibido una comunicación de sanción disciplinaria. Fírmala como acuse de recibo (leído).",
        segmento: { tipo: "empleados", empleadoIds: [fichaId] },
        accionLabel: "Firmar",
        accionUrl: `${base}/firmar/${encodeURIComponent(token)}`,
        refTabla: "firmas_documentos",
        refId: documentoId,
        dedupeKey: `firma-${documentoId}`,
        system: true,
      });
    } catch (e) {
      console.error("[sancion] notificar:", e);
    }

    revalidatePath("/gerencia/comunicados");
    return { ok: true, documentoId, emailEnviado: sendResult.ok };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sancion] crearSancionDisciplinaria:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * La empresa tal y como va a salir IMPRESA en la sanción, para que la
 * previsualización enseñe lo mismo que el PDF y no el rótulo del local.
 * Sale de Ajustes → Empresa.
 */
export async function getEmpresaDeLaSancion(): Promise<
  | { ok: true; data: { nombre: string; razonSocial: string; cif: string | null; domicilio: string | null } }
  | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const e = await getIdentidadEmpresa(supabase, empresaId);
    return {
      ok: true,
      data: { nombre: e.nombre, razonSocial: e.razonSocial, cif: e.cif, domicilio: e.domicilio },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export interface SancionResumen {
  id: string;
  empleadoId: string;
  empleadoNombre: string;
  departamento: string;
  /** Calificación de la falta, si se puede leer del resumen guardado. */
  gravedad: GravedadSancion | null;
  /** Resumen de una línea: calificación · fecha de los hechos. */
  resumen: string;
  estado: string;
  enviadoEn: string;
  expiraEn: string;
  firmadoEn: string | null;
}

/** Recupera la calificación de la falta del resumen guardado en `observaciones`. */
function gravedadDelResumen(resumen: string | null): GravedadSancion | null {
  const primera = (resumen ?? "").split("·")[0]?.trim().toLowerCase();
  if (!primera) return null;
  const par = (Object.entries(GRAVEDAD_LABEL) as [GravedadSancion, string][]).find(
    ([, label]) => label.toLowerCase() === primera,
  );
  return par?.[0] ?? null;
}

/** Lista las sanciones disciplinarias emitidas por la empresa. */
export async function listSancionesDisciplinarias(): Promise<
  { ok: true; data: SancionResumen[] } | { ok: false; error: string }
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data, error } = await supabase
      .from("firmas_documentos")
      .select(`
        id, estado, empleado_id, enviado_en, expira_en, firmado_en, observaciones,
        empleados!firmas_documentos_empleado_id_fkey ( nombre, apellidos, departamentos!empleados_departamento_id_fkey ( nombre ) )
      `)
      .eq("empresa_id", empresaId)
      .eq("tipo", TIPO_DOC)
      .order("enviado_en", { ascending: false });
    if (error) throw error;

    type Row = {
      id: string;
      estado: string;
      empleado_id: string;
      enviado_en: string;
      expira_en: string;
      firmado_en: string | null;
      observaciones: string | null;
      empleados: { nombre: string | null; apellidos: string | null; departamentos: { nombre: string | null } | null } | null;
    };
    const items: SancionResumen[] = (data as unknown as Row[]).map((r) => ({
      id: r.id,
      empleadoId: r.empleado_id,
      empleadoNombre: `${r.empleados?.nombre ?? ""} ${r.empleados?.apellidos ?? ""}`.trim() || "—",
      departamento: r.empleados?.departamentos?.nombre ?? "—",
      gravedad: gravedadDelResumen(r.observaciones),
      resumen: r.observaciones ?? "",
      estado: r.estado,
      enviadoEn: r.enviado_en,
      expiraEn: r.expira_en,
      firmadoEn: r.firmado_en,
    }));
    return { ok: true, data: items };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error listando sanciones";
    console.error("[sancion] listSancionesDisciplinarias:", msg);
    return { ok: false, error: msg };
  }
}
