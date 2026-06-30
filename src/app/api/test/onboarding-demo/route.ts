import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import {
  resolverPlantillaOnboarding,
  cuerpoOnboardingAHtml,
  PLANTILLAS_ONBOARDING,
} from "@/features/rrhh/services/email-plantillas/resolver";
import { crearTokenContratoGestoria, botonSubidaContratoHtml } from "@/features/rrhh/services/gestoria/gestoria-contrato";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PRUEBA MANUAL del flujo de onboarding (PRP-070). Envía TODO a un correo de
 * destino para revisar plantillas + probar el botón de subir contrato + la firma
 * + la notificación a RRHH. Crea un empleado de PRUEBA temporal (marcado para
 * borrar). Protegido por CRON_SECRET. No usar en producción salvo prueba puntual.
 *
 *   GET /api/test/onboarding-demo?to=balleshosteleros@gmail.com
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get("to") || "balleshosteleros@gmail.com";
  const empresaId = url.searchParams.get("empresa") || "00000000-0000-0000-0000-000000000001";
  const notifUserId = url.searchParams.get("notifUser") || "59c496f2-9bc8-4a0b-9004-c3b2770d8982";

  const admin = createAdminClient();
  const pasos: string[] = [];

  const empresaNombre = await admin.from("empresas").select("nombre").eq("id", empresaId).maybeSingle()
    .then((r) => (r.data?.nombre as string) ?? "La empresa");

  // Variables de ejemplo comunes para renderizar las plantillas.
  const baseVars: Record<string, string> = {
    candidato_nombre: "Candidato",
    candidato_nombre_completo: "Candidato de Prueba",
    empresa_nombre: empresaNombre,
    gestoria_datos: "Nombre: Candidato de Prueba · DNI: 00000000T · Puesto: Camarero/a · Primer día: 01/07/2026",
    prueba_dias_transcurridos: "10",
    prueba_dias_restantes: "20",
    prueba_duracion_dias: "30",
    prueba_fecha_inicio: "21/06/2026",
    prueba_fecha_fin: "21/07/2026",
  };

  // ── 1) Enviar las 5 plantillas de muestra ──────────────────────────────
  const cincoPlantillas: { key: keyof typeof PLANTILLAS_ONBOARDING; nombre: string }[] = [
    { key: "gestoriaAlta", nombre: PLANTILLAS_ONBOARDING.gestoriaAlta },
    { key: "gestoriaRecordatorio", nombre: PLANTILLAS_ONBOARDING.gestoriaRecordatorio },
    { key: "contratoInterno", nombre: PLANTILLAS_ONBOARDING.contratoInterno },
    { key: "contratoOficial", nombre: PLANTILLAS_ONBOARDING.contratoOficial },
    { key: "pruebaAviso", nombre: PLANTILLAS_ONBOARDING.pruebaAviso },
  ];
  for (const p of cincoPlantillas) {
    const tpl = await resolverPlantillaOnboarding(admin, empresaId, p.nombre, baseVars);
    if (!tpl) { pasos.push(`⚠️ Plantilla no encontrada: ${p.nombre}`); continue; }
    const html = `<p style="color:#888;font-size:12px">[MUESTRA] Plantilla: ${p.nombre}</p>${cuerpoOnboardingAHtml(tpl.cuerpo)}`;
    const res = await sendEmail({ to, subject: `[MUESTRA] ${tpl.asunto}`, html, text: tpl.cuerpo, empresaId });
    pasos.push(`${res.ok ? "✅" : "❌"} Muestra enviada: ${p.nombre}`);
  }

  // ── 2) Empleado de PRUEBA temporal con TU correo ───────────────────────
  // Reutiliza si ya existe (idempotente por email_personal + marca de prueba).
  let empleadoId: string;
  const { data: existe } = await admin
    .from("empleados")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("email_personal", to)
    .eq("nombre", "PRUEBA")
    .maybeSingle();
  if (existe?.id) {
    empleadoId = existe.id as string;
    pasos.push("ℹ️ Empleado de prueba reutilizado");
  } else {
    const { data: nuevo, error: empErr } = await admin
      .from("empleados")
      .insert({
        empresa_id: empresaId,
        nombre: "PRUEBA",
        apellidos: "Onboarding (borrar)",
        email_personal: to,
        dni_nie: "00000000T",
        puesto: "Camarero/a",
        estado: "Activo",
        fecha_alta: "2026-07-01",
      })
      .select("id")
      .single();
    if (empErr || !nuevo) {
      return NextResponse.json({ ok: false, error: `No se pudo crear el empleado de prueba: ${empErr?.message}`, pasos });
    }
    empleadoId = nuevo.id as string;
    pasos.push(`✅ Empleado de prueba creado (id ${empleadoId})`);
  }

  // ── 3) Alta a la gestoría REAL → a TU correo, con botón funcional ──────
  const tk = await crearTokenContratoGestoria(admin, { empresaId, empleadoId });
  const botonHtml = tk.ok ? botonSubidaContratoHtml(tk.token) : "<p>(no se pudo generar el botón)</p>";
  const altaTpl = await resolverPlantillaOnboarding(admin, empresaId, PLANTILLAS_ONBOARDING.gestoriaAlta, baseVars);
  const altaCuerpo = altaTpl
    ? cuerpoOnboardingAHtml(altaTpl.cuerpo.replace("{{gestoria_datos}}", baseVars.gestoria_datos))
    : "<p>Solicitud de alta de contrato (prueba).</p>";
  const altaRes = await sendEmail({
    to,
    subject: `[PRUEBA · GESTORÍA] ${altaTpl?.asunto ?? "Alta de contrato"}`,
    html: `${altaCuerpo}${botonHtml}<p style="color:#888;font-size:12px">Pulsa el botón para subir un PDF: te llegará la firma a este mismo correo (como candidato).</p>`,
    text: `Alta de contrato de prueba. Sube el contrato en: ${tk.ok ? `(enlace en el botón)` : "(error token)"}`,
    empresaId,
  });
  pasos.push(`${altaRes.ok ? "✅" : "❌"} Alta a gestoría enviada (botón ${tk.ok ? "funcional" : "SIN token"})`);

  // ── 4) Notificación a TI (como RRHH) ──────────────────────────────────
  try {
    await emitirNotificacion({
      empresaId,
      system: true,
      tipo: "gestoria_alta_enviada",
      titulo: "[PRUEBA] Alta enviada a la gestoría: Candidato de Prueba",
      mensaje: "Esta es una notificación de prueba del flujo de onboarding (como si fueras RRHH).",
      segmento: { tipo: "usuarios", usuarioIds: [notifUserId] },
      refTabla: "empleados",
      refId: empleadoId,
      accionUrl: "/rrhh/reclutamiento",
      dedupeKey: `test_onboarding:${empleadoId}:${tk.ok ? tk.tokenId : "x"}`,
    });
    pasos.push("✅ Notificación de prueba emitida (a tu usuario)");
  } catch (e) {
    pasos.push(`❌ Notificación falló: ${e instanceof Error ? e.message : "error"}`);
  }

  return NextResponse.json({
    ok: true,
    destino: to,
    empleadoPruebaId: empleadoId,
    instrucciones:
      "Revisa tu correo: 5 muestras + 1 alta de gestoría con botón. Pulsa «Adjuntar contrato firmado», sube cualquier PDF, y te llegará la invitación de firma a este mismo correo. Para borrar el empleado de prueba: DELETE de empleados donde nombre='PRUEBA'.",
    pasos,
  });
}
