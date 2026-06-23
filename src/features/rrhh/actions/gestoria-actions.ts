"use server";

/**
 * Ajuste de correos de gestoría (Reclutamiento) + envío del alta a la gestoría.
 * El correo de la gestoría vive en `reclutamiento_config` (por empresa), no
 * ligado a ningún departamento ni persona (PRP-066).
 */

import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { sendEmail } from "@/lib/email/send";

async function getCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, empresaId: null as string | null };
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);
  return { supabase, user, empresaId };
}

export interface ReclutamientoConfig {
  gestoria_email: string;
  gestoria_email_cc: string;
}

export async function getReclutamientoConfig(): Promise<{ ok: boolean; data: ReclutamientoConfig }> {
  const vacio = { gestoria_email: "", gestoria_email_cc: "" };
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, data: vacio };
    const { data } = await supabase
      .from("reclutamiento_config")
      .select("gestoria_email, gestoria_email_cc")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    return {
      ok: true,
      data: {
        gestoria_email: data?.gestoria_email ?? "",
        gestoria_email_cc: data?.gestoria_email_cc ?? "",
      },
    };
  } catch (err) {
    console.error("[rrhh] getReclutamientoConfig:", err);
    return { ok: false, data: vacio };
  }
}

export async function saveReclutamientoConfig(input: ReclutamientoConfig) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };
    const { error } = await supabase
      .from("reclutamiento_config")
      .upsert({
        empresa_id: empresaId,
        gestoria_email: input.gestoria_email.trim() || null,
        gestoria_email_cc: input.gestoria_email_cc.trim() || null,
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

const eur = (n: number) => (Number(n) || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });

export async function enviarAltaGestoria(empleadoId: string) {
  try {
    const { supabase, empresaId } = await getCtx();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const cfg = await getReclutamientoConfig();
    const destino = cfg.data.gestoria_email.trim();
    if (!destino) {
      return { ok: false, error: "Configura el correo de la gestoría en Ajustes → RRHH → Reclutamiento." };
    }
    const to = [destino, cfg.data.gestoria_email_cc.trim()].filter(Boolean).join(", ");

    const { data: emp } = await supabase
      .from("empleados")
      .select("nombre, apellidos, dni_nie, email_personal, email_empresa, telefono, puesto, fecha_alta")
      .eq("id", empleadoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!emp) return { ok: false, error: "Empleado no encontrado" };

    const { data: cond } = await supabase
      .from("empleado_condiciones")
      .select("nivel, salario_neto, jornada_contrato, horas_semanales, primer_dia, tipo_contrato, puesto_id")
      .eq("empleado_id", empleadoId)
      .maybeSingle();

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
    const fila = (k: string, v: string | null | undefined) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0;font-weight:600">${v || "—"}</td></tr>`;

    const subject = `Alta de contrato · ${nombre} · ${empresaNombre}`;
    const html = `
      <p>Solicitud de alta de contrato para el siguiente trabajador:</p>
      <table style="border-collapse:collapse;font-size:14px">
        ${fila("Nombre", nombre)}
        ${fila("DNI/NIE", emp.dni_nie)}
        ${fila("Teléfono", emp.telefono)}
        ${fila("Email", emp.email_empresa || emp.email_personal)}
        ${fila("Puesto", `${emp.puesto ?? "—"}${cond?.nivel ? ` · Nivel ${cond.nivel}` : ""}`)}
        ${fila("Primer día", cond?.primer_dia ?? emp.fecha_alta)}
        ${fila("Tipo de contrato", cond?.tipo_contrato)}
        ${fila("Jornada", cond?.jornada_contrato)}
        ${fila("Horas/semana", cond?.horas_semanales ? `${cond.horas_semanales}h` : "—")}
        ${fila("Salario neto", cond?.salario_neto != null ? eur(Number(cond.salario_neto)) : "—")}
        ${fila("Convenio", convenio)}
        ${fila("Grupo/categoría", grupo)}
        ${fila("Epígrafe/cotización", epigrafe)}
      </table>
      <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
    const text = `Alta de contrato\nNombre: ${nombre}\nDNI: ${emp.dni_nie ?? "—"}\nPuesto: ${emp.puesto ?? "—"}${cond?.nivel ? ` (Nivel ${cond.nivel})` : ""}\nPrimer día: ${cond?.primer_dia ?? emp.fecha_alta ?? "—"}\nTipo contrato: ${cond?.tipo_contrato ?? "—"}\nSalario neto: ${cond?.salario_neto != null ? eur(Number(cond.salario_neto)) : "—"}\nConvenio: ${convenio || "—"}`;

    const res = await sendEmail({ to, subject, html, text, empresaId });
    if (!res.ok) return { ok: false, error: "No se pudo enviar el email (revisa el SMTP)." };
    return { ok: true };
  } catch (err) {
    console.error("[rrhh] enviarAltaGestoria:", err);
    return { ok: false, error: "No se pudo enviar el alta a la gestoría" };
  }
}
