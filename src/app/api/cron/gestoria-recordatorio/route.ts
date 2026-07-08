import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import {
  urlRecordatorioContrato,
  botonRecordatorioContratoHtml,
  notificarRrhhGestoria,
} from "@/features/rrhh/services/gestoria/gestoria-contrato";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Recordatorio automático a la gestoría (PRP-068).
 *
 * Para cada alta enviada hace ≥ N días (config `gestoria_recordatorio_dias`)
 * cuyo contrato AÚN no se ha subido y sin recordatorio previo, reenvía un correo
 * a la gestoría con el MISMO enlace (resuelto por hash, ya que el token en claro
 * no se persiste), avisando de que el contrato sigue pendiente y de que el
 * trabajador todavía no lo ha recibido. Avisa a RRHH (tick 2).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Empresas con recordatorio activo. El correo de la gestoría se resuelve más
  // abajo desde Ajustes → Empresa (correoGestoria), fuente única; ya no se filtra
  // por la antigua columna gestoria_email.
  const { data: cfgs } = await admin
    .from("reclutamiento_config")
    .select(
      "empresa_id, gestoria_recordatorio_activo, gestoria_recordatorio_dias, notif_recordatorio_gestoria",
    );

  const activas = new Map<string, { dias: number; notif: boolean }>();
  for (const c of cfgs ?? []) {
    if (c.gestoria_recordatorio_activo === false) continue;
    activas.set(c.empresa_id as string, {
      dias: (c.gestoria_recordatorio_dias as number) ?? 3,
      notif: c.notif_recordatorio_gestoria ?? true,
    });
  }

  const ahora = Date.now();
  let enviados = 0;

  const { data: pendientes } = await admin
    .from("gestoria_contrato_tokens")
    .select("id, empresa_id, empleado_id, token_hash, alta_enviada_en, expira_en")
    .is("contrato_subido_en", null)
    .is("recordatorio_en", null);

  for (const tk of pendientes ?? []) {
    const empresaId = tk.empresa_id as string;
    const cfg = activas.get(empresaId);
    if (!cfg) continue;
    if (new Date(tk.expira_en as string).getTime() < ahora) continue;

    const diasDesdeAlta = (ahora - new Date(tk.alta_enviada_en as string).getTime()) / 86_400_000;
    if (diasDesdeAlta < cfg.dias) continue;

    const { data: emp } = await admin
      .from("empleados")
      .select("nombre, apellidos, dni_nie")
      .eq("id", tk.empleado_id)
      .maybeSingle();
    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre")
      .eq("id", empresaId)
      .maybeSingle();
    const nombre = `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim() || "el trabajador";
    const empresaNombre = (empresa?.nombre as string) ?? "la empresa";

    const tokenHash = tk.token_hash as string;
    const enlace = urlRecordatorioContrato(tokenHash);

    // Botón de subida (funcional): se añade SIEMPRE al final del html, haya o no plantilla.
    const botonHtml = botonRecordatorioContratoHtml(tokenHash);

    // Plantilla editable del recordatorio (UI «Plantillas de email»).
    const { resolverPlantillaOnboarding, resolverDestinatario, cuerpoOnboardingAHtml, PLANTILLAS_ONBOARDING } =
      await import("@/features/rrhh/services/email-plantillas/resolver");
    const vars: Record<string, string> = {
      candidato_nombre_completo: nombre,
      empresa_nombre: empresaNombre,
    };
    const tpl = await resolverPlantillaOnboarding(
      admin,
      empresaId,
      PLANTILLAS_ONBOARDING.gestoriaRecordatorio,
      vars,
    );

    // Destinatario configurable (por defecto: gestoría). El correo se toma de
    // Ajustes → Empresa → «Correo gestoría». Sin plantilla, se resuelve el mismo
    // departamento gestoría desde esa fuente.
    const dst = tpl
      ? await resolverDestinatario(admin, empresaId, tpl.destino, tpl.destinoEmail, null)
      : await resolverDestinatario(admin, empresaId, "departamento", "correoGestoria", null);
    const to = [dst.to, dst.cc].filter(Boolean).join(", ");
    if (!to) continue;

    let subject: string;
    let html: string;
    let text: string;
    if (tpl) {
      subject = tpl.asunto;
      html = `${cuerpoOnboardingAHtml(tpl.cuerpo)}${botonHtml}`;
      text = `${tpl.cuerpo}\n\nSúbelo aquí: ${enlace}`;
    } else {
      subject = `⚠️ Pendiente: contrato de ${nombre} sin subir · ${empresaNombre}`;
      html = `
      <p>Os recordamos que el <b>contrato de ${nombre}</b>${emp?.dni_nie ? ` (DNI/NIE ${emp.dni_nie})` : ""}
      <b>sigue pendiente de subir</b>.</p>
      <p style="color:#b91c1c">
        Mientras no subáis el contrato firmado, <b>el trabajador no lo recibe y no puede firmarlo</b>,
        lo que bloquea el alta. Es importante completarlo cuanto antes.
      </p>
      ${botonHtml}
      <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
      text = `Recordatorio: el contrato de ${nombre} sigue pendiente de subir. Súbelo aquí: ${enlace}`;
    }

    const res = await sendEmail({ to, subject, html, text, empresaId });
    if (!res.ok) continue;

    await admin
      .from("gestoria_contrato_tokens")
      .update({ recordatorio_en: new Date().toISOString() })
      .eq("id", tk.id);
    enviados++;

    if (cfg.notif) {
      await notificarRrhhGestoria({
        empresaId,
        tipo: "gestoria_recordatorio",
        titulo: `Recordatorio enviado a la gestoría: ${nombre}`,
        mensaje: `El contrato de ${nombre} seguía sin subir tras ${cfg.dias} día(s). Se ha reenviado un recordatorio a la gestoría.`,
        empleadoId: tk.empleado_id as string,
        dedupeKey: `gestoria_recordatorio:${tk.id}`,
      });
    }
  }

  return NextResponse.json({ ok: true, ejecutadoEn: new Date().toISOString(), recordatoriosEnviados: enviados });
}
