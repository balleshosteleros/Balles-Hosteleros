import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getModelosConfigPorEmpresa } from "@/features/gestoria/modelos/services/modelos-config";
import {
  crearTokenModelosGestoria,
  urlSubidaModelos,
  botonSubidaModelosHtml,
  listarModelosDelToken,
} from "@/features/gestoria/modelos/services/gestoria-modelos-tokens";
import {
  fechaLimiteGrupo,
  periodoALabel,
  type GrupoModelo,
  type ModeloPeriodo,
} from "@/features/gestoria/modelos/types/modelos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Email automático a la gestoría para que suba los modelos de un periodo (PRP-072).
 *
 * Para cada empresa con el email activo (trimestral / anual), calcula si HOY es
 * la fecha límite de presentación + offset configurado para algún periodo con
 * modelos aún pendientes. Si sí y no se envió ya un token para ese periodo,
 * genera el enlace tokenizado y envía el correo (plantilla editable).
 */

const MS_DIA = 86_400_000;

/** ¿Coincide `fecha` (a medianoche) con hoy (a medianoche, hora servidor)? */
function esHoy(fecha: Date): boolean {
  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
}

interface Disparo {
  grupo: GrupoModelo;
  periodo: ModeloPeriodo;
  ejercicio: number;
}

/**
 * Periodos que "tocan" hoy para una empresa según el offset. Miramos ejercicios
 * recientes (actual y anterior) porque el plazo de Q4/ANUAL cae en enero/febrero
 * del año siguiente.
 */
function disparosDeHoy(
  grupo: GrupoModelo,
  offsetDias: number,
  añoActual: number,
): Disparo[] {
  const periodos: ModeloPeriodo[] =
    grupo === "TRIMESTRALES" ? ["Q1", "Q2", "Q3", "Q4"] : ["ANUAL"];
  const ejercicios = [añoActual, añoActual - 1];
  const out: Disparo[] = [];
  for (const ejercicio of ejercicios) {
    for (const periodo of periodos) {
      const limite = fechaLimiteGrupo(grupo, periodo, ejercicio);
      if (!limite) continue;
      const objetivo = new Date(limite.getTime() + offsetDias * MS_DIA);
      if (esHoy(objetivo)) out.push({ grupo, periodo, ejercicio });
    }
  }
  return out;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const añoActual = new Date().getFullYear();
  let enviados = 0;

  const { resolverPlantillaOnboarding, resolverDestinatario, cuerpoOnboardingAHtml, PLANTILLAS_ONBOARDING } =
    await import("@/features/rrhh/services/email-plantillas/resolver");

  // Empresas con al menos un email activo.
  const { data: cfgRows } = await admin
    .from("modelos_config")
    .select("empresa_id, email_trim_activo, email_trim_dias_offset, email_anual_activo, email_anual_dias_offset")
    .or("email_trim_activo.eq.true,email_anual_activo.eq.true");

  for (const row of cfgRows ?? []) {
    const empresaId = row.empresa_id as string;
    const cfg = await getModelosConfigPorEmpresa(admin, empresaId);

    const disparos: Disparo[] = [];
    if (cfg.email_trim_activo) {
      disparos.push(...disparosDeHoy("TRIMESTRALES", cfg.email_trim_dias_offset, añoActual));
    }
    if (cfg.email_anual_activo) {
      disparos.push(...disparosDeHoy("ANUALES", cfg.email_anual_dias_offset, añoActual));
    }
    if (disparos.length === 0) continue;

    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre")
      .eq("id", empresaId)
      .maybeSingle();
    const empresaNombre = (empresa?.nombre as string) ?? "la empresa";

    for (const d of disparos) {
      // ¿Ya enviamos un token para este periodo/grupo/ejercicio? (idempotencia)
      const { data: yaEnviado } = await admin
        .from("gestoria_modelos_tokens")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("ejercicio", d.ejercicio)
        .eq("grupo", d.grupo)
        .eq("periodo", d.periodo)
        .limit(1)
        .maybeSingle();
      if (yaEnviado) continue;

      // Crea el token (aún sin comprobar pendientes: lo comprobamos con el propio token).
      const tk = await crearTokenModelosGestoria(admin, {
        empresaId,
        ejercicio: d.ejercicio,
        grupo: d.grupo,
        periodo: d.periodo,
      });
      if (!tk.ok) continue;

      // ¿Quedan modelos pendientes en este periodo? Si ya está todo subido, no molestamos.
      const modelos = await listarModelosDelToken(admin, {
        id: tk.tokenId,
        empresa_id: empresaId,
        ejercicio: d.ejercicio,
        grupo: d.grupo,
        periodo: d.periodo,
      });
      const pendientes = modelos.filter((m) => !m.tienePdf).length;
      if (pendientes === 0) {
        // Marca el token como completado para no reintentar cada día.
        await admin
          .from("gestoria_modelos_tokens")
          .update({ completado_en: new Date().toISOString() })
          .eq("id", tk.tokenId);
        continue;
      }

      const enlace = urlSubidaModelos(tk.token);
      const boton = botonSubidaModelosHtml(tk.token);
      const periodoLabel = periodoALabel(d.periodo, d.ejercicio);

      const clave =
        d.grupo === "TRIMESTRALES"
          ? PLANTILLAS_ONBOARDING.gestoriaModelosTrimestral
          : PLANTILLAS_ONBOARDING.gestoriaModelosAnual;

      const vars: Record<string, string> = {
        empresa_nombre: empresaNombre,
        periodo_label: periodoLabel,
        enlace_modelos: enlace,
      };
      const tpl = await resolverPlantillaOnboarding(admin, empresaId, clave, vars);

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
        // El cuerpo ya contiene {{enlace_modelos}} sustituido; añadimos el botón funcional.
        html = `${cuerpoOnboardingAHtml(tpl.cuerpo)}${boton}`;
        text = `${tpl.cuerpo}\n\nSúbelos aquí: ${enlace}`;
      } else {
        const tituloGrupo = d.grupo === "TRIMESTRALES" ? "trimestrales" : "anuales";
        subject = `Modelos ${tituloGrupo} ${periodoLabel} · ${empresaNombre}`;
        html = `
          <p>Ha vencido el plazo de presentación de los modelos ${tituloGrupo}
          del periodo <b>${periodoLabel}</b> de ${empresaNombre}.</p>
          <p>Por favor, subid los modelos presentados desde el siguiente enlace,
          que los integrará automáticamente en el software.</p>
          ${boton}
          <p style="color:#888;font-size:12px">Enviado automáticamente desde el sistema de ${empresaNombre}.</p>`;
        text = `Subid los modelos ${tituloGrupo} de ${periodoLabel} aquí: ${enlace}`;
      }

      const res = await sendEmail({ to, subject, html, text, empresaId });
      if (res.ok) enviados++;
    }
  }

  return NextResponse.json({ ok: true, ejecutadoEn: new Date().toISOString(), emailsEnviados: enviados });
}
