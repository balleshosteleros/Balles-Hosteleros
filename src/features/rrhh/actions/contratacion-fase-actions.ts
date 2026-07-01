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

  // 1. Materializar el empleado (alta gestoría incluida). Sin email de acceso.
  const contratado = await contratarCandidato({
    candidatoId: input.candidatoId,
    puestoId: input.puestoId,
    nivel: 1,
    primerDia: input.primerDia,
    localId: input.localId,
    emailEmpresa: input.emailEmpresa ?? null,
    enviarAcceso: false,
    destino: { fase: "contratacion", estado: "contratacion" },
  });
  if (!contratado.ok || !contratado.empleadoId) {
    return { ok: false, error: contratado.error ?? "No se pudo iniciar la contratación" };
  }
  const empleadoId = contratado.empleadoId;

  // 2. Generar y enviar a firmar el CONTRATO INTERNO.
  let contratoInternoEnviado = false;
  try {
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
