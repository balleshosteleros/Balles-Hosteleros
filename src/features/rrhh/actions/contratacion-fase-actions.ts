"use server";

/**
 * Orquestador de la ENTRADA en la fase «Contratación» (PRP-070).
 *
 * Al mover un candidato a Contratación, este action:
 *   1. Materializa el EMPLEADO real (reutiliza `contratarCandidato`, sin enviar
 *      todavía el email de acceso: el acceso se difiere a la fase Prueba).
 *      Eso ya dispara el ALTA A LA GESTORÍA (correo + token de subida de
 *      contrato + notificación a RRHH).
 *   2. Genera el CONTRATO INTERNO (PDF) y lo envía a firmar al trabajador con el
 *      módulo de Firmas (Email 3).
 *   3. Notifica a RRHH (contratación iniciada / contrato interno enviado).
 *
 * El candidato queda en `{ fase: "contratacion", estado: "contratacion" }`.
 *
 * El contrato OFICIAL ya está cubierto por el flujo de gestoría existente
 * (`procesarSubidaContrato`): cuando la gestoría sube el PDF, se manda a firmar
 * automáticamente al trabajador (PRP-068).
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { requireAdminUser } from "@/features/rrhh/services/empleados-core";
import { contratarCandidato } from "@/features/rrhh/actions/contratacion-actions";
import { crearFirmaInterno } from "@/features/rrhh/services/firmas/crear-firma";
import { generarContratoInternoPDF } from "@/features/rrhh/services/firmas/contrato-interno-pdf";
import { notificarRrhhGestoria } from "@/features/rrhh/services/gestoria/gestoria-contrato";
import { getReclutamientoConfigPorEmpresa } from "@/features/rrhh/actions/gestoria-config-server";
import { revalidatePath } from "next/cache";

export interface IniciarContratacionInput {
  candidatoId: string;
  puestoId: string;
  primerDia: string; // 'YYYY-MM-DD'
  localId: string;
  /** Solo para puestos administrativos. */
  emailEmpresa?: string | null;
  /**
   * Qué correos enviar. El usuario los confirma uno a uno en el diálogo de
   * contratación (preview por email). Si se omiten, se envían ambos (compat).
   */
  enviarGestoria?: boolean;
  enviarContratoInterno?: boolean;
}

export interface IniciarContratacionResult {
  ok: boolean;
  error?: string;
  empleadoId?: string;
  gestoriaEnviada?: boolean;
  contratoInternoEnviado?: boolean;
}

function fechaEs(d: Date): string {
  return d.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function iniciarContratacion(
  input: IniciarContratacionInput,
): Promise<IniciarContratacionResult> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  if (!empresaId) return { ok: false, error: "No autenticado" };

  try {
    await requireAdminUser({ empresaIds: [empresaId] });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sin permisos" };
  }

  // Qué correos enviar (confirmados uno a uno en el diálogo). Si no llegan, se
  // envían ambos (compat con llamadas antiguas).
  const enviarGestoria = input.enviarGestoria !== false;
  const enviarContratoInterno = input.enviarContratoInterno !== false;

  // 1. Materializar el empleado (alta gestoría según confirmación). Sin email de acceso.
  const contratado = await contratarCandidato({
    candidatoId: input.candidatoId,
    puestoId: input.puestoId,
    nivel: 1,
    primerDia: input.primerDia,
    localId: input.localId,
    emailEmpresa: input.emailEmpresa ?? null,
    enviarAcceso: false,
    enviarGestoria,
    // Entrar en Contratación ES el acto de contratar: el candidato aún está en su
    // fase anterior (Selección, etc.), así que se permite desde cualquier fase.
    permitirDesdeCualquierFase: true,
    destino: { fase: "contratacion", estado: "contratacion" },
  });
  if (!contratado.ok || !contratado.empleadoId) {
    return { ok: false, error: contratado.error ?? "No se pudo iniciar la contratación" };
  }
  const empleadoId = contratado.empleadoId;

  // 2. Generar y enviar a firmar el CONTRATO INTERNO (solo si se confirmó).
  let contratoInternoEnviado = false;
  if (enviarContratoInterno) try {
    const admin = createAdminClient();
    const { data: emp } = await admin
      .from("empleados")
      .select("nombre, apellidos, dni_nie, puesto")
      .eq("id", empleadoId)
      .maybeSingle();
    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre, nif")
      .eq("id", empresaId)
      .maybeSingle();
    const cfg = await getReclutamientoConfigPorEmpresa(admin, empresaId);

    const empleadoNombre = `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim() || "Trabajador";

    const pdf = await generarContratoInternoPDF({
      empleadoNombre,
      empleadoDni: (emp?.dni_nie as string | null) ?? null,
      empresaNombre: (empresa?.nombre as string) ?? "La empresa",
      empresaCif: (empresa?.nif as string | null) ?? null,
      ciudad: null,
      puesto: (emp?.puesto as string | null) ?? null,
      fecha: fechaEs(new Date()),
      cuerpo: (cfg.contrato_interno_plantilla as string | null) ?? null,
    });

    // PRP-070: asunto + intro del correo de firma desde la plantilla editable
    // «Contrato interno (a firmar)» (UI Plantillas de email). El diseño y el
    // botón de firma se mantienen. Fallback al correo estándar si no existe.
    const { resolverPlantillaOnboarding, PLANTILLAS_ONBOARDING } = await import(
      "@/features/rrhh/services/email-plantillas/resolver"
    );
    const tplInterno = await resolverPlantillaOnboarding(
      admin, empresaId, PLANTILLAS_ONBOARDING.contratoInterno,
      { candidato_nombre: emp?.nombre ?? "", empresa_nombre: (empresa?.nombre as string) ?? "" },
    );
    const firma = await crearFirmaInterno({
      empresaId,
      empleadoId,
      pdf,
      titulo: "Contrato interno",
      tipo: "contrato_interno",
      modalidad: "manuscrita_digital",
      validez: "eidas_simple",
      plazoDias: 14,
      observaciones: "Contrato interno previo a la incorporación (PRP-070).",
      enviadoPorUserId: user.id,
      enviadoPorNombre: "RRHH",
      // El contrato interno es un documento PERSONAL del trabajador: se envía a su
      // email personal (el de su candidatura), no al corporativo heredado.
      preferirEmailPersonal: true,
      emailAsunto: tplInterno?.asunto ?? null,
      emailIntro: tplInterno?.cuerpo ?? null,
      // Firma colocada automáticamente sobre la zona "Firmado" del contrato
      // privado (lo genera el sistema, sabemos dónde va). El candidato no arrastra.
      posicionFirmaDefault: { pagina: 1, xPct: 0.10, yPct: 0.82, anchoPct: 0.32 },
    });
    contratoInternoEnviado = firma.ok;

    // Notificación a RRHH: contratación iniciada + contrato interno enviado.
    await notificarRrhhGestoria({
      empresaId,
      tipo: "contrato_interno_enviado",
      titulo: `Contratación iniciada: ${empleadoNombre}`,
      mensaje: `Se ha enviado el alta a la gestoría y el contrato interno a ${empleadoNombre} para su firma.`,
      empleadoId,
      dedupeKey: `contratacion_iniciada:${empleadoId}`,
    });
  } catch (err) {
    console.error("[contratacion-fase] contrato interno:", err);
  }

  revalidatePath("/rrhh/reclutamiento");
  revalidatePath("/rrhh/empleados");
  return {
    ok: true,
    empleadoId,
    gestoriaEnviada: contratado.gestoriaEnviada,
    contratoInternoEnviado,
  };
}

/**
 * Un correo que se enviaría al iniciar la contratación, para confirmarlo en el
 * diálogo (preview por email). `disponible=false` cuando falta el destinatario
 * (p. ej. sin correo de gestoría en Ajustes → Empresa): se muestra pero no se
 * puede marcar para enviar.
 */
export interface EmailContratacionPreview {
  clave: "gestoria_alta" | "contrato_interno";
  titulo: string;
  destinatarioLabel: string;
  para: string;
  asunto: string;
  cuerpo: string;
  disponible: boolean;
  motivoNoDisponible?: string;
}

/**
 * Lista los correos que se enviarían al INICIAR la contratación de un candidato:
 *   1. Alta a la GESTORÍA (destinatario: correoGestoria de Ajustes → Empresa).
 *   2. CONTRATO INTERNO a firmar (destinatario: el candidato/empleado).
 * Cada uno con su destinatario REAL resuelto, para que el usuario confirme uno a
 * uno antes de enviar. No tiene efectos (no crea nada, no envía nada).
 */
export async function previewContratacionEmails(
  candidatoId: string,
): Promise<{ ok: boolean; error?: string; emails?: EmailContratacionPreview[] }> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  if (!empresaId) return { ok: false, error: "No autenticado" };

  try {
    const admin = createAdminClient();
    const { data: cand } = await admin
      .from("candidatos")
      .select("nombre, apellidos, email")
      .eq("id", candidatoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!cand) return { ok: false, error: "Candidato no encontrado" };

    const empresaNombre = await admin
      .from("empresas").select("nombre").eq("id", empresaId).maybeSingle()
      .then((r) => (r.data?.nombre as string) ?? "la empresa");
    const nombreCompleto = `${cand.nombre ?? ""} ${cand.apellidos ?? ""}`.trim();
    const emailCandidato = (cand.email as string | null) ?? null;

    const { resolverPlantillaOnboarding, resolverDestinatario, PLANTILLAS_ONBOARDING } = await import(
      "@/features/rrhh/services/email-plantillas/resolver"
    );
    const { etiquetaDestino } = await import("@/features/rrhh/lib/plantillas-onboarding");
    const vars = { candidato_nombre: cand.nombre ?? "", candidato_nombre_completo: nombreCompleto, empresa_nombre: empresaNombre };

    // 1. Alta a la gestoría.
    const tplGest = await resolverPlantillaOnboarding(admin, empresaId, PLANTILLAS_ONBOARDING.gestoriaAlta, vars);
    const dstGest = tplGest
      ? await resolverDestinatario(admin, empresaId, tplGest.destino, tplGest.destinoEmail, emailCandidato)
      : await resolverDestinatario(admin, empresaId, "departamento", "correoGestoria", emailCandidato);
    const gestoriaLabel = tplGest ? etiquetaDestino(tplGest.destino, tplGest.destinoEmail) : "Gestoría";

    // 2. Contrato interno a firmar (al candidato).
    const tplInt = await resolverPlantillaOnboarding(admin, empresaId, PLANTILLAS_ONBOARDING.contratoInterno, vars);

    const emails: EmailContratacionPreview[] = [
      {
        clave: "gestoria_alta",
        titulo: "Alta a la gestoría",
        destinatarioLabel: gestoriaLabel,
        para: dstGest.to || "",
        asunto: tplGest?.asunto ?? `Alta de contrato · ${nombreCompleto} · ${empresaNombre}`,
        cuerpo: tplGest?.cuerpo ?? "Solicitud de alta de contrato para el trabajador (con la ficha de datos y el enlace para subir el contrato firmado).",
        disponible: !!dstGest.to,
        motivoNoDisponible: dstGest.to ? undefined : "Falta el «Correo gestoría» en Ajustes → Empresa → Correos electrónicos.",
      },
      {
        clave: "contrato_interno",
        titulo: "Contrato interno a firmar",
        destinatarioLabel: "Candidato",
        para: emailCandidato || "",
        asunto: tplInt?.asunto ?? "Tu contrato interno para firmar",
        cuerpo: tplInt?.cuerpo ?? "Se enviará al candidato el contrato interno para su firma digital.",
        disponible: !!emailCandidato,
        motivoNoDisponible: emailCandidato ? undefined : "El candidato no tiene email en su ficha.",
      },
    ];

    return { ok: true, emails };
  } catch (err) {
    console.error("[contratacion-fase] previewContratacionEmails:", err);
    return { ok: false, error: "No se pudo preparar la vista previa de correos" };
  }
}
