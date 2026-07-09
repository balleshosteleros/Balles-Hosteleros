"use server";

/**
 * Ajuste de correos de gestoría (Reclutamiento) + envío del alta a la gestoría.
 * El correo de la gestoría vive en `reclutamiento_config` (por empresa), no
 * ligado a ningún departamento ni persona (PRP-066).
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/escape-html";
import {
  crearTokenContratoGestoria,
  botonSubidaContratoHtml,
  urlSubidaContrato,
  notificarRrhhGestoria,
} from "@/features/rrhh/services/gestoria/gestoria-contrato";
import {
  normalizarCamposFormulario,
  type CamposFormularioConfig,
} from "@/features/rrhh/data/campos-candidatura";
import {
  GESTORIA_CAMPOS,
  normalizarGestoriaCampos,
  type GestoriaCampoKey,
  type GestoriaCamposConfig,
} from "@/features/rrhh/data/campos-gestoria";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

export interface ReclutamientoConfig {
  // El correo de la gestoría vive en Ajustes → Empresa → «Correos electrónicos»
  // (datos_generales.correoGestoria), fuente única. Aquí solo quedan los ajustes
  // de comportamiento del alta a la gestoría.
  gestoria_envio_auto: boolean;
  gestoria_campos: GestoriaCamposConfig;
  // Recordatorio automático a la gestoría si no sube el contrato.
  gestoria_recordatorio_activo: boolean;
  gestoria_recordatorio_dias: number;
  // Notificaciones al departamento de RRHH (un tick por evento del flujo).
  notif_alta_gestoria: boolean;
  notif_recordatorio_gestoria: boolean;
  notif_contrato_subido: boolean;
  notif_contrato_firmado: boolean;
}

const RECLUTAMIENTO_CONFIG_DEFAULT: ReclutamientoConfig = {
  gestoria_envio_auto: true,
  gestoria_campos: normalizarGestoriaCampos(null),
  gestoria_recordatorio_activo: true,
  gestoria_recordatorio_dias: 3,
  notif_alta_gestoria: true,
  notif_recordatorio_gestoria: true,
  notif_contrato_subido: true,
  notif_contrato_firmado: true,
};

export async function getReclutamientoConfig(): Promise<{ ok: boolean; data: ReclutamientoConfig }> {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: RECLUTAMIENTO_CONFIG_DEFAULT };
    const { data } = await supabase
      .from("reclutamiento_config")
      .select(
        "gestoria_envio_auto, gestoria_campos, " +
          "gestoria_recordatorio_activo, gestoria_recordatorio_dias, " +
          "notif_alta_gestoria, notif_recordatorio_gestoria, notif_contrato_subido, notif_contrato_firmado",
      )
      .eq("empresa_id", empresaId)
      .maybeSingle<{
        gestoria_envio_auto: boolean | null;
        gestoria_campos: unknown;
        gestoria_recordatorio_activo: boolean | null;
        gestoria_recordatorio_dias: number | null;
        notif_alta_gestoria: boolean | null;
        notif_recordatorio_gestoria: boolean | null;
        notif_contrato_subido: boolean | null;
        notif_contrato_firmado: boolean | null;
      }>();
    return {
      ok: true,
      data: {
        gestoria_envio_auto: data?.gestoria_envio_auto ?? true,
        gestoria_campos: normalizarGestoriaCampos(data?.gestoria_campos),
        gestoria_recordatorio_activo: data?.gestoria_recordatorio_activo ?? true,
        gestoria_recordatorio_dias: data?.gestoria_recordatorio_dias ?? 3,
        notif_alta_gestoria: data?.notif_alta_gestoria ?? true,
        notif_recordatorio_gestoria: data?.notif_recordatorio_gestoria ?? true,
        notif_contrato_subido: data?.notif_contrato_subido ?? true,
        notif_contrato_firmado: data?.notif_contrato_firmado ?? true,
      },
    };
  } catch (err) {
    console.error("[rrhh] getReclutamientoConfig:", err);
    return { ok: false, data: RECLUTAMIENTO_CONFIG_DEFAULT };
  }
}

export async function saveReclutamientoConfig(input: ReclutamientoConfig) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const dias = Math.max(1, Math.min(60, Math.round(Number(input.gestoria_recordatorio_dias) || 3)));
    const { error } = await supabase
      .from("reclutamiento_config")
      .upsert({
        empresa_id: empresaId,
        gestoria_envio_auto: input.gestoria_envio_auto,
        gestoria_campos: normalizarGestoriaCampos(input.gestoria_campos),
        gestoria_recordatorio_activo: input.gestoria_recordatorio_activo,
        gestoria_recordatorio_dias: dias,
        notif_alta_gestoria: input.notif_alta_gestoria,
        notif_recordatorio_gestoria: input.notif_recordatorio_gestoria,
        notif_contrato_subido: input.notif_contrato_subido,
        notif_contrato_firmado: input.notif_contrato_firmado,
        updated_at: new Date().toISOString(),
      }, { onConflict: "empresa_id" });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] saveReclutamientoConfig:", err);
    return { ok: false, error: "No se pudo guardar la configuración" };
  }
}

// ============================================================
// Configuración general de Reclutamiento (toggles + idioma/regional).
// Vive en la misma fila por empresa de `reclutamiento_config`.
// ============================================================

export interface ReclutamientoConfigGeneral {
  emails_auto_cambio_fase: boolean;
  emails_pedir_confirmacion: boolean;
  emails_copia_reclutador: boolean;
  emails_firma_corporativa: boolean;
  idioma_portal: string;
  formato_fecha: string;
  permitir_candidaturas_duplicadas: boolean;
  archivar_vacantes_cerradas_30d: boolean;
  mostrar_contador_candidatos: boolean;
  notificar_reclutador_nueva_candidatura: boolean;
}

const CONFIG_GENERAL_DEFAULT: ReclutamientoConfigGeneral = {
  emails_auto_cambio_fase: true,
  emails_pedir_confirmacion: true,
  emails_copia_reclutador: false,
  emails_firma_corporativa: true,
  idioma_portal: "es",
  formato_fecha: "dd/mm/yyyy",
  permitir_candidaturas_duplicadas: false,
  archivar_vacantes_cerradas_30d: true,
  mostrar_contador_candidatos: true,
  notificar_reclutador_nueva_candidatura: true,
};

const CONFIG_GENERAL_COLS = Object.keys(CONFIG_GENERAL_DEFAULT).join(", ");

export async function getReclutamientoConfigGeneral(): Promise<{ ok: boolean; data: ReclutamientoConfigGeneral }> {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: CONFIG_GENERAL_DEFAULT };
    const { data } = await supabase
      .from("reclutamiento_config")
      .select(CONFIG_GENERAL_COLS)
      .eq("empresa_id", empresaId)
      .maybeSingle<ReclutamientoConfigGeneral>();
    return { ok: true, data: { ...CONFIG_GENERAL_DEFAULT, ...(data ?? {}) } };
  } catch (err) {
    console.error("[rrhh] getReclutamientoConfigGeneral:", err);
    return { ok: false, data: CONFIG_GENERAL_DEFAULT };
  }
}

export async function saveReclutamientoConfigGeneral(input: ReclutamientoConfigGeneral) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("reclutamiento_config")
      .upsert({
        empresa_id: empresaId,
        ...input,
        updated_at: new Date().toISOString(),
      }, { onConflict: "empresa_id" });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] saveReclutamientoConfigGeneral:", err);
    return { ok: false, error: "No se pudo guardar la configuración" };
  }
}

// ============================================================
// Config de ONBOARDING (PRP-070): Formación, Contrato interno y Periodo de prueba.
// Vive en la misma fila por empresa de `reclutamiento_config`.
// ============================================================

export type PruebaAvisoCanal = "notificacion" | "email" | "ambos";

export interface ReclutamientoConfigOnboarding {
  formacion_url: string;
  contrato_interno_plantilla: string;
  reconocimiento_medico_plantilla: string;
  prueba_duracion_dias: number;
  prueba_aviso_dias: number;
  prueba_aviso_canal: PruebaAvisoCanal;
  prueba_aviso_activo: boolean;
}

const ONBOARDING_DEFAULT: ReclutamientoConfigOnboarding = {
  formacion_url: "",
  contrato_interno_plantilla: "",
  reconocimiento_medico_plantilla: "",
  prueba_duracion_dias: 30,
  prueba_aviso_dias: 10,
  prueba_aviso_canal: "ambos",
  prueba_aviso_activo: true,
};

function normalizarCanal(v: unknown): PruebaAvisoCanal {
  return v === "notificacion" || v === "email" ? v : "ambos";
}

export async function getReclutamientoConfigOnboarding(): Promise<{ ok: boolean; data: ReclutamientoConfigOnboarding }> {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: ONBOARDING_DEFAULT };
    const { data } = await supabase
      .from("reclutamiento_config")
      .select("formacion_url, contrato_interno_plantilla, reconocimiento_medico_plantilla, prueba_duracion_dias, prueba_aviso_dias, prueba_aviso_canal, prueba_aviso_activo")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    return {
      ok: true,
      data: {
        formacion_url: (data?.formacion_url as string | null) ?? "",
        contrato_interno_plantilla: (data?.contrato_interno_plantilla as string | null) ?? "",
        reconocimiento_medico_plantilla: (data?.reconocimiento_medico_plantilla as string | null) ?? "",
        prueba_duracion_dias: (data?.prueba_duracion_dias as number | null) ?? 30,
        prueba_aviso_dias: (data?.prueba_aviso_dias as number | null) ?? 10,
        prueba_aviso_canal: normalizarCanal(data?.prueba_aviso_canal),
        prueba_aviso_activo: (data?.prueba_aviso_activo as boolean | null) ?? true,
      },
    };
  } catch (err) {
    console.error("[rrhh] getReclutamientoConfigOnboarding:", err);
    return { ok: false, data: ONBOARDING_DEFAULT };
  }
}

export async function saveReclutamientoConfigOnboarding(input: ReclutamientoConfigOnboarding) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const dur = Math.max(1, Math.min(365, Math.round(Number(input.prueba_duracion_dias) || 30)));
    const aviso = Math.max(1, Math.min(dur, Math.round(Number(input.prueba_aviso_dias) || 10)));
    const { error } = await supabase
      .from("reclutamiento_config")
      .upsert({
        empresa_id: empresaId,
        formacion_url: input.formacion_url.trim() || null,
        contrato_interno_plantilla: input.contrato_interno_plantilla.trim() || null,
        reconocimiento_medico_plantilla: input.reconocimiento_medico_plantilla.trim() || null,
        prueba_duracion_dias: dur,
        prueba_aviso_dias: aviso,
        prueba_aviso_canal: normalizarCanal(input.prueba_aviso_canal),
        prueba_aviso_activo: input.prueba_aviso_activo,
        updated_at: new Date().toISOString(),
      }, { onConflict: "empresa_id" });
    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    console.error("[rrhh] saveReclutamientoConfigOnboarding:", err);
    return { ok: false as const, error: "No se pudo guardar la configuración" };
  }
}

// ============================================================
// Campos del formulario de candidatura (activo / obligatorio por campo).
// Vive en `reclutamiento_config.campos_formulario` (jsonb), 1 fila por empresa.
// ============================================================

export async function getCamposFormularioCandidatura(): Promise<{ ok: boolean; data: CamposFormularioConfig }> {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: normalizarCamposFormulario(null) };
    const { data } = await supabase
      .from("reclutamiento_config")
      .select("campos_formulario")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    return { ok: true, data: normalizarCamposFormulario(data?.campos_formulario) };
  } catch (err) {
    console.error("[rrhh] getCamposFormularioCandidatura:", err);
    return { ok: false, data: normalizarCamposFormulario(null) };
  }
}

export async function saveCamposFormularioCandidatura(input: CamposFormularioConfig) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    // Re-normaliza por seguridad (las 7 claves, booleanos válidos).
    const campos = normalizarCamposFormulario(input);
    const { error } = await supabase
      .from("reclutamiento_config")
      .upsert({
        empresa_id: empresaId,
        campos_formulario: campos,
        updated_at: new Date().toISOString(),
      }, { onConflict: "empresa_id" });
    if (error) throw error;
    return { ok: true as const };
  } catch (err) {
    console.error("[rrhh] saveCamposFormularioCandidatura:", err);
    return { ok: false as const, error: "No se pudo guardar la configuración" };
  }
}

const eur = (n: number) => (Number(n) || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

export async function enviarAltaGestoria(
  empleadoId: string,
  opts?: { forzar?: boolean; empresaIdOverride?: string },
) {
  try {
    let supabase: Awaited<ReturnType<typeof getCtx>>["supabase"];
    let empresaId: string | null;
    if (opts?.empresaIdOverride) {
      // Sin sesión (cron/prueba): usa service role + empresaId explícito.
      supabase = createAdminClient() as unknown as Awaited<ReturnType<typeof getCtx>>["supabase"];
      empresaId = opts.empresaIdOverride;
    } else {
      ({ supabase, empresaId } = await getCtx());
    }
    if (!empresaId) return { ok: false, error: "No autenticado" };

    // Config: con sesión usa getReclutamientoConfig; sin sesión (override) la lee
    // por empresa con service role.
    const cfg = opts?.empresaIdOverride
      ? await (async () => {
          const { data } = await (supabase as ReturnType<typeof createAdminClient>)
            .from("reclutamiento_config")
            .select("gestoria_envio_auto, gestoria_campos, notif_alta_gestoria")
            .eq("empresa_id", empresaId)
            .maybeSingle();
          return {
            data: {
              gestoria_envio_auto: (data?.gestoria_envio_auto as boolean | null) ?? true,
              gestoria_campos: normalizarGestoriaCampos(data?.gestoria_campos),
              notif_alta_gestoria: (data?.notif_alta_gestoria as boolean | null) ?? true,
            },
          };
        })()
      : await getReclutamientoConfig();

    // Toggle de envío automático: si está desactivado y no se fuerza, no se envía.
    if (!cfg.data.gestoria_envio_auto && !opts?.forzar) {
      return { ok: true, skipped: true as const };
    }

    const campos = cfg.data.gestoria_campos;

    const { data: emp } = await supabase
      .from("empleados")
      .select("nombre, apellidos, dni_nie, email_personal, email_empresa, telefono, puesto, fecha_alta")
      .eq("id", empleadoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!emp) return { ok: false, error: "Empleado no encontrado" };

    // `empleado_condiciones` es un histórico: se lee la fila VIGENTE (vigente_hasta
    // IS NULL). Fallback a la más reciente por si un registro antiguo no tuviera el
    // campo relleno.
    const { data: condRows } = await supabase
      .from("empleado_condiciones")
      .select("nivel, salario_neto, jornada_contrato, horas_semanales, primer_dia, tipo_contrato, puesto_id, vigente_hasta, vigente_desde")
      .eq("empleado_id", empleadoId)
      .order("vigente_desde", { ascending: false, nullsFirst: false })
      .limit(20);
    const cond = (condRows ?? []).find((r) => r.vigente_hasta == null) ?? condRows?.[0] ?? null;

    let convenio = "", grupo = "", epigrafe = "";
    if (cond?.puesto_id) {
      const { data: p } = await supabase
        .from("puestos")
        .select("convenio_colectivo, grupo_categoria_prof, epigrafe_cotizacion")
        .eq("id", cond.puesto_id)
        .maybeSingle();
      convenio = p?.convenio_colectivo ?? "";
      grupo = p?.grupo_categoria_prof ?? "";
      epigrafe = p?.epigrafe_cotizacion ?? "";
    }

    const empresaNombre = await supabase.from("empresas").select("nombre").eq("id", empresaId).maybeSingle()
      .then((r) => r.data?.nombre ?? "la empresa");

    const nombre = `${emp.nombre} ${emp.apellidos ?? ""}`.trim();

    // Valor de cada campo configurable. Solo se incluyen en el correo los que
    // estén activados en `campos` (config por empresa; por defecto todos).
    const valores: Record<GestoriaCampoKey, { label: string; value: string | null | undefined }> = {
      nombre: { label: "Nombre", value: nombre },
      dni_nie: { label: "DNI/NIE", value: emp.dni_nie },
      telefono: { label: "Teléfono", value: emp.telefono },
      // El email del trabajador para la gestoría es su email PERSONAL (dato de
      // contacto real de su candidatura), no el corporativo que pueda haber heredado.
      email: { label: "Email", value: emp.email_personal || emp.email_empresa },
      puesto: { label: "Puesto", value: `${emp.puesto ?? "—"}${cond?.nivel ? ` · Nivel ${cond.nivel}` : ""}` },
      primer_dia: { label: "Primer día", value: cond?.primer_dia ?? emp.fecha_alta },
      tipo_contrato: { label: "Tipo de contrato", value: cond?.tipo_contrato },
      jornada: { label: "Jornada", value: cond?.jornada_contrato },
      horas_semanales: { label: "Horas/semana", value: cond?.horas_semanales ? `${cond.horas_semanales}h` : "—" },
      salario_neto: { label: "Salario neto", value: cond?.salario_neto != null ? eur(Number(cond.salario_neto)) : "—" },
      convenio: { label: "Convenio", value: convenio },
      grupo: { label: "Grupo/categoría", value: grupo },
      epigrafe: { label: "Epígrafe/cotización", value: epigrafe },
    };

    // Cada dato como una fila de FICHA: etiqueta gris a la izquierda, valor en
    // negrita a la derecha, con separadores suaves (se aprecia como tarjeta).
    const fila = (k: string, v: string | null | undefined) =>
      `<tr>
        <td style="padding:10px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #eef2f7;white-space:nowrap;">${escapeHtml(k)}</td>
        <td style="padding:10px 16px;color:#0f172a;font-weight:600;font-size:14px;border-bottom:1px solid #eef2f7;text-align:right;">${escapeHtml(v) || "—"}</td>
      </tr>`;

    const filasHtml = GESTORIA_CAMPOS
      .filter(({ key }) => campos[key])
      .map(({ key }) => fila(valores[key].label, valores[key].value))
      .join("");
    const filasText = GESTORIA_CAMPOS
      .filter(({ key }) => campos[key])
      .map(({ key }) => `${valores[key].label}: ${valores[key].value || "—"}`)
      .join("\n");

    // Token único por empleado para que la gestoría suba el contrato firmado.
    // Se inserta con service role (la tabla solo permite SELECT a usuarios).
    const admin = createAdminClient();
    const tk = await crearTokenContratoGestoria(admin, { empresaId, empleadoId });
    const botonHtml = tk.ok ? botonSubidaContratoHtml(tk.token) : "";
    const enlaceText = tk.ok ? `\n\nSubir el contrato firmado: ${urlSubidaContrato(tk.token)}` : "";

    // Ficha de datos del trabajador (tarjeta), se inyecta donde el cuerpo ponga {{gestoria_datos}}.
    const tablaHtml = `
      <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:0;margin:18px 0;max-width:480px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <tr><td colspan="2" style="background:#f8fafc;padding:12px 16px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#475569;border-bottom:1px solid #e2e8f0;">Datos del trabajador</td></tr>
        ${filasHtml}
      </table>`;

    // Plantilla editable del alta a la gestoría (UI «Plantillas de email»).
    const { resolverPlantillaOnboarding, resolverDestinatario, cuerpoOnboardingAHtml, PLANTILLAS_ONBOARDING } =
      await import("@/features/rrhh/services/email-plantillas/resolver");
    const vars: Record<string, string> = {
      candidato_nombre: emp.nombre ?? "",
      candidato_nombre_completo: nombre,
      empresa_nombre: empresaNombre,
      gestoria_datos: "", // se reemplaza por la tabla tras renderizar el cuerpo
    };
    const tpl = await resolverPlantillaOnboarding(admin, empresaId, PLANTILLAS_ONBOARDING.gestoriaAlta, vars);

    // Destinatario configurable en la plantilla (por defecto: gestoría). Fuente
    // ÚNICA del correo = Ajustes → Empresa → «Correos electrónicos» (correoGestoria).
    // Si no hay plantilla (fallback), se resuelve el correo del departamento
    // «gestoría» igualmente desde esa fuente.
    const emailCandidato = emp.email_empresa || emp.email_personal || null;
    const dst = tpl
      ? await resolverDestinatario(admin, empresaId, tpl.destino, tpl.destinoEmail, emailCandidato)
      : await resolverDestinatario(admin, empresaId, "departamento", "correoGestoria", emailCandidato);
    if (!dst.to) {
      return { ok: false, error: "Configura el «Correo gestoría» en Ajustes → Empresa → Correos electrónicos." };
    }
    const to = [dst.to, dst.cc].filter(Boolean).join(", ");
    // Para el aviso a RRHH: a dónde se envió realmente.
    const destino = dst.to;

    let subject: string;
    let html: string;
    let text: string;
    if (tpl) {
      subject = tpl.asunto;
      // El cuerpo editable inserta la tabla en {{gestoria_datos}} (o al final si no está).
      const partes = tpl.cuerpo.split("{{gestoria_datos}}");
      const cuerpoHtml = partes.length > 1
        ? partes.map((p) => cuerpoOnboardingAHtml(p)).join(tablaHtml)
        : `${cuerpoOnboardingAHtml(tpl.cuerpo)}${tablaHtml}`;
      html = `${cuerpoHtml}${botonHtml}`;
      text = `${tpl.cuerpo.replace("{{gestoria_datos}}", `\n${filasText}`)}${enlaceText}`;
    } else {
      subject = `Alta de contrato · ${nombre} · ${empresaNombre}`;
      html = `
      <p>Solicitud de alta de contrato para el siguiente trabajador:</p>
      ${tablaHtml}
      ${botonHtml}
      <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
      text = `Alta de contrato\n${filasText}${enlaceText}`;
    }

    const res = await sendEmail({ to, subject, html, text, empresaId });
    if (!res.ok) return { ok: false, error: "No se pudo enviar el email (revisa el SMTP)." };

    // Registrar el email en la actividad del candidato (aparece en la pestaña
    // «Actividad» de su ficha, con su asunto y el HTML enviado).
    {
      const { registrarEmailEnHistorial } = await import(
        "@/features/rrhh/services/registrar-email-historial"
      );
      await registrarEmailEnHistorial(admin, {
        empresaId, empleadoId, asunto: subject, html: res.ok ? res.html : html,
      });
    }

    // Tick 1: aviso al departamento de RRHH (si está activado).
    if (cfg.data.notif_alta_gestoria) {
      await notificarRrhhGestoria({
        empresaId,
        tipo: "gestoria_alta_enviada",
        titulo: `Alta enviada a la gestoría: ${nombre}`,
        mensaje: `Se ha enviado el alta de contrato de ${nombre} a la gestoría (${destino}).`,
        empleadoId,
        dedupeKey: tk.ok ? `gestoria_alta:${tk.tokenId}` : `gestoria_alta:${empleadoId}`,
      });
    }

    return { ok: true };
  } catch (err) {
    console.error("[rrhh] enviarAltaGestoria:", err);
    return { ok: false, error: "No se pudo enviar el alta a la gestoría" };
  }
}

/**
 * Avisa a la GESTORÍA de un CAMBIO DE PUESTO (promoción interna) de un empleado ya
 * dado de alta. Reutiliza la ficha de «Datos del trabajador» del alta (con las
 * condiciones VIGENTES tras la promoción) y la plantilla editable
 * `gestoria_cambio_puesto`. A diferencia del alta, NO adjunta token de subida de
 * contrato (no se crea un contrato nuevo, se modifica el existente).
 *
 * Devuelve `{ ok, destino }` para que el llamador registre a dónde se envió.
 */
export async function enviarCambioPuestoGestoria(
  empleadoId: string,
  cambio: { puestoAnterior: string | null; puestoNuevo: string; primerDia: string },
): Promise<{ ok: boolean; error?: string; destino?: string | null }> {
  try {
    const admin = createAdminClient();

    // Empresa del empleado (service role: sin sesión garantizada en el flujo).
    const { data: emp } = await admin
      .from("empleados")
      .select("empresa_id, nombre, apellidos, dni_nie, email_personal, email_empresa, telefono, puesto, fecha_alta")
      .eq("id", empleadoId)
      .maybeSingle();
    if (!emp) return { ok: false, error: "Empleado no encontrado" };
    const empresaId = emp.empresa_id as string;

    const cfgCampos = await (async () => {
      const { data } = await admin
        .from("reclutamiento_config")
        .select("gestoria_campos")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      return normalizarGestoriaCampos(data?.gestoria_campos);
    })();

    // Condiciones VIGENTES tras la promoción (histórico: vigente_hasta IS NULL).
    const { data: condRows } = await admin
      .from("empleado_condiciones")
      .select("nivel, salario_neto, jornada_contrato, horas_semanales, primer_dia, tipo_contrato, puesto_id, vigente_hasta, vigente_desde")
      .eq("empleado_id", empleadoId)
      .order("vigente_desde", { ascending: false, nullsFirst: false })
      .limit(20);
    const cond = (condRows ?? []).find((r) => r.vigente_hasta == null) ?? condRows?.[0] ?? null;

    let convenio = "", grupo = "", epigrafe = "";
    if (cond?.puesto_id) {
      const { data: p } = await admin
        .from("puestos")
        .select("convenio_colectivo, grupo_categoria_prof, epigrafe_cotizacion")
        .eq("id", cond.puesto_id)
        .maybeSingle();
      convenio = p?.convenio_colectivo ?? "";
      grupo = p?.grupo_categoria_prof ?? "";
      epigrafe = p?.epigrafe_cotizacion ?? "";
    }

    const empresaNombre = await admin.from("empresas").select("nombre").eq("id", empresaId).maybeSingle()
      .then((r) => r.data?.nombre ?? "la empresa");
    const nombre = `${emp.nombre} ${emp.apellidos ?? ""}`.trim();

    const valores: Record<GestoriaCampoKey, { label: string; value: string | null | undefined }> = {
      nombre: { label: "Nombre", value: nombre },
      dni_nie: { label: "DNI/NIE", value: emp.dni_nie },
      telefono: { label: "Teléfono", value: emp.telefono },
      email: { label: "Email", value: emp.email_personal || emp.email_empresa },
      puesto: { label: "Puesto", value: `${cambio.puestoNuevo}${cond?.nivel ? ` · Nivel ${cond.nivel}` : ""}` },
      primer_dia: { label: "Primer día en el nuevo puesto", value: cambio.primerDia },
      tipo_contrato: { label: "Tipo de contrato", value: cond?.tipo_contrato },
      jornada: { label: "Jornada", value: cond?.jornada_contrato },
      horas_semanales: { label: "Horas/semana", value: cond?.horas_semanales ? `${cond.horas_semanales}h` : "—" },
      salario_neto: { label: "Salario neto", value: cond?.salario_neto != null ? eur(Number(cond.salario_neto)) : "—" },
      convenio: { label: "Convenio", value: convenio },
      grupo: { label: "Grupo/categoría", value: grupo },
      epigrafe: { label: "Epígrafe/cotización", value: epigrafe },
    };

    const fila = (k: string, v: string | null | undefined) =>
      `<tr>
        <td style="padding:10px 16px;color:#64748b;font-size:13px;border-bottom:1px solid #eef2f7;white-space:nowrap;">${escapeHtml(k)}</td>
        <td style="padding:10px 16px;color:#0f172a;font-weight:600;font-size:14px;border-bottom:1px solid #eef2f7;text-align:right;">${escapeHtml(v) || "—"}</td>
      </tr>`;
    // La fila «Puesto anterior» se antepone para que el cambio quede explícito.
    const filaAnterior = cambio.puestoAnterior
      ? fila("Puesto anterior", cambio.puestoAnterior)
      : "";
    const filasHtml = filaAnterior + GESTORIA_CAMPOS
      .filter(({ key }) => cfgCampos[key])
      .map(({ key }) => fila(valores[key].label, valores[key].value))
      .join("");
    const filasText = (cambio.puestoAnterior ? `Puesto anterior: ${cambio.puestoAnterior}\n` : "") +
      GESTORIA_CAMPOS
        .filter(({ key }) => cfgCampos[key])
        .map(({ key }) => `${valores[key].label}: ${valores[key].value || "—"}`)
        .join("\n");

    const tablaHtml = `
      <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:0;margin:18px 0;max-width:480px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <tr><td colspan="2" style="background:#f8fafc;padding:12px 16px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#475569;border-bottom:1px solid #e2e8f0;">Datos del trabajador</td></tr>
        ${filasHtml}
      </table>`;

    const { resolverPlantillaOnboarding, resolverDestinatario, cuerpoOnboardingAHtml, PLANTILLAS_ONBOARDING } =
      await import("@/features/rrhh/services/email-plantillas/resolver");
    const vars: Record<string, string> = {
      candidato_nombre: emp.nombre ?? "",
      candidato_nombre_completo: nombre,
      empresa_nombre: empresaNombre,
      gestoria_datos: "",
    };
    const tpl = await resolverPlantillaOnboarding(admin, empresaId, PLANTILLAS_ONBOARDING.gestoriaCambioPuesto, vars);

    const emailContacto = emp.email_empresa || emp.email_personal || null;
    const dst = tpl
      ? await resolverDestinatario(admin, empresaId, tpl.destino, tpl.destinoEmail, emailContacto)
      : await resolverDestinatario(admin, empresaId, "departamento", "correoGestoria", emailContacto);
    if (!dst.to) {
      return { ok: false, error: "Configura el «Correo gestoría» en Ajustes → Empresa → Correos electrónicos." };
    }
    const to = [dst.to, dst.cc].filter(Boolean).join(", ");

    let subject: string;
    let html: string;
    let text: string;
    if (tpl) {
      subject = tpl.asunto;
      const partes = tpl.cuerpo.split("{{gestoria_datos}}");
      const cuerpoHtml = partes.length > 1
        ? partes.map((p) => cuerpoOnboardingAHtml(p)).join(tablaHtml)
        : `${cuerpoOnboardingAHtml(tpl.cuerpo)}${tablaHtml}`;
      html = cuerpoHtml;
      text = tpl.cuerpo.replace("{{gestoria_datos}}", `\n${filasText}`);
    } else {
      subject = `Cambio de puesto · ${nombre} · ${empresaNombre}`;
      html = `
      <p>El siguiente trabajador cambia de puesto dentro de la empresa (promoción interna):</p>
      ${tablaHtml}
      <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
      text = `Cambio de puesto\n${filasText}`;
    }

    const res = await sendEmail({ to, subject, html, text, empresaId });
    if (!res.ok) return { ok: false, error: "No se pudo enviar el email (revisa el SMTP)." };

    // Registrar el email en la actividad del empleado.
    const { registrarEmailEnHistorial } = await import(
      "@/features/rrhh/services/registrar-email-historial"
    );
    await registrarEmailEnHistorial(admin, {
      empresaId, empleadoId, asunto: subject, html: res.ok ? res.html : html,
    });

    return { ok: true, destino: dst.to };
  } catch (err) {
    console.error("[rrhh] enviarCambioPuestoGestoria:", err);
    return { ok: false, error: "No se pudo avisar a la gestoría del cambio de puesto" };
  }
}
