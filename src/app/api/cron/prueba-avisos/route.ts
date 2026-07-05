import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Aviso automático a RRHH durante el periodo de prueba (PRP-070).
 *
 * Para cada candidato en estado `prueba` cuya entrada en la fase fue hace ≥ N
 * días (`prueba_aviso_dias`), emite un aviso a RRHH (notificación in-app y/o
 * email, según `prueba_aviso_canal`) indicando días transcurridos y restantes
 * sobre `prueba_duracion_dias`. Idempotente: `dedupeKey` por candidato + fecha
 * de inicio del periodo evita reenvíos.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Config por empresa (solo las que tienen el aviso activo).
  const { data: cfgs } = await admin
    .from("reclutamiento_config")
    .select("empresa_id, prueba_duracion_dias, prueba_aviso_dias, prueba_aviso_canal, prueba_aviso_activo");

  const porEmpresa = new Map<
    string,
    { duracion: number; avisoDias: number; canal: string }
  >();
  for (const c of cfgs ?? []) {
    if (c.prueba_aviso_activo === false) continue;
    porEmpresa.set(c.empresa_id as string, {
      duracion: (c.prueba_duracion_dias as number) ?? 30,
      avisoDias: (c.prueba_aviso_dias as number) ?? 10,
      canal: (c.prueba_aviso_canal as string) ?? "ambos",
    });
  }
  if (porEmpresa.size === 0) {
    return NextResponse.json({ ok: true, ejecutadoEn: new Date().toISOString(), avisos: 0 });
  }

  // Candidatos actualmente en periodo de prueba.
  const { data: enPrueba } = await admin
    .from("candidatos")
    .select("id, empresa_id, nombre, apellidos, empleado_id, fase_actualizada_at")
    .eq("estado", "prueba");

  const ahora = Date.now();
  let avisos = 0;

  for (const cand of enPrueba ?? []) {
    const empresaId = cand.empresa_id as string;
    const cfg = porEmpresa.get(empresaId);
    if (!cfg) continue;

    const inicioIso = cand.fase_actualizada_at as string | null;
    if (!inicioIso) continue;
    const inicio = new Date(inicioIso).getTime();
    const diasTranscurridos = Math.floor((ahora - inicio) / 86_400_000);
    if (diasTranscurridos < cfg.avisoDias) continue;

    const diasRestantes = Math.max(0, cfg.duracion - diasTranscurridos);
    const nombre = `${cand.nombre ?? ""} ${cand.apellidos ?? ""}`.trim() || "El trabajador";
    const fechaInicio = new Date(inicio).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric" });
    const fechaFin = new Date(inicio + cfg.duracion * 86_400_000).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric" });
    // Una sola alerta por candidato y periodo (fecha de inicio en la clave).
    const dedupeKey = `prueba_aviso:${cand.id}:${inicioIso.slice(0, 10)}`;

    const mensaje =
      `${nombre} lleva ${diasTranscurridos} días en periodo de prueba. ` +
      `Le quedan ${diasRestantes} días para finalizar el periodo configurado (${cfg.duracion} días, ` +
      `inicio ${fechaInicio}, fin previsto ${fechaFin}). Revisa su evolución antes de confirmar su continuidad.`;

    const canal = cfg.canal;

    // Notificación in-app (canal "notificacion" o "ambos").
    if (canal === "notificacion" || canal === "ambos") {
      try {
        await emitirNotificacion({
          empresaId,
          system: true,
          tipo: "prueba_aviso",
          titulo: `Periodo de prueba: ${nombre} (${diasTranscurridos} días)`,
          mensaje,
          segmento: { tipo: "area", area: "ADMINISTRATIVA" },
          refTabla: cand.empleado_id ? "empleados" : "candidatos",
          refId: (cand.empleado_id as string | null) ?? (cand.id as string),
          accionUrl: "/rrhh/reclutamiento",
          dedupeKey,
        });
        avisos++;
      } catch (e) {
        console.error("[cron/prueba-avisos] notificacion:", e);
      }
    }

    // Email a RRHH (canal "email" o "ambos").
    if (canal === "email" || canal === "ambos") {
      const { data: empresa } = await admin
        .from("empresas")
        .select("nombre, email_contacto, datos_generales")
        .eq("id", empresaId)
        .maybeSingle();
      const dg = (empresa?.datos_generales as Record<string, unknown> | null) ?? {};
      const correoRrhh =
        (typeof dg.correoRrhh === "string" ? dg.correoRrhh : "") ||
        ((empresa?.email_contacto as string | null) ?? "") ||
        (typeof dg.correoGeneral === "string" ? dg.correoGeneral : "");
      const empresaNombre = (empresa?.nombre as string) ?? "la empresa";

      {
        // Plantilla editable del aviso de prueba (UI «Plantillas de email»).
        const { resolverPlantillaOnboarding, resolverDestinatario, cuerpoOnboardingAHtml, PLANTILLAS_ONBOARDING } =
          await import("@/features/rrhh/services/email-plantillas/resolver");
        const vars: Record<string, string> = {
          candidato_nombre_completo: nombre,
          empresa_nombre: empresaNombre,
          prueba_dias_transcurridos: String(diasTranscurridos),
          prueba_dias_restantes: String(diasRestantes),
          prueba_duracion_dias: String(cfg.duracion),
          prueba_fecha_inicio: fechaInicio,
          prueba_fecha_fin: fechaFin,
        };
        const tpl = await resolverPlantillaOnboarding(
          admin,
          empresaId,
          PLANTILLAS_ONBOARDING.pruebaAviso,
          vars,
        );

        // Destinatario configurable (por defecto: RRHH). Sin plantilla, a RRHH.
        const dst = tpl
          ? await resolverDestinatario(admin, empresaId, tpl.destino, tpl.destinoEmail, null)
          : { to: correoRrhh, cc: null };
        const to = dst.to || correoRrhh;
        if (!to) continue;

        let subject: string;
        let html: string;
        let text: string;
        if (tpl) {
          subject = tpl.asunto;
          html = cuerpoOnboardingAHtml(tpl.cuerpo);
          text = tpl.cuerpo;
        } else {
          subject = `Periodo de prueba de ${nombre}: revisa su evolución · ${empresaNombre}`;
          html = `
          <p>${mensaje}</p>
          <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
          text = mensaje;
        }
        const res = await sendEmail({ to, subject, html, text, empresaId });
        if (res.ok && canal === "email") avisos++;
      }
    }
  }

  return NextResponse.json({ ok: true, ejecutadoEn: new Date().toISOString(), avisos });
}
