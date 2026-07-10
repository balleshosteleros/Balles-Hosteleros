"use server";

/**
 * Solicitud/RE-ENVÍO manual a la gestoría del correo para subir los modelos de
 * un periodo. El envío normal es AUTOMÁTICO (cron `gestoria-modelos`, al día
 * siguiente del último día de presentación). Esta acción sirve para RE-ENVIAR
 * ese correo desde la tarjeta o el editor de un modelo cuando haga falta.
 *
 * Reutiliza el mismo flujo que el cron: crea un token de subida del periodo,
 * genera el enlace tokenizado y envía el correo a la gestoría (correo de
 * Ajustes → Empresa → «Correos electrónicos» → correoGestoria, fuente única).
 * Al confirmarse la subida, los modelos pasan a PRESENTADO (verde).
 */

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import {
  crearTokenModelosGestoria,
  urlSubidaModelos,
  botonSubidaModelosHtml,
} from "../services/gestoria-modelos-tokens";
import { grupoDeModelo, periodoALabel } from "../types/modelos";
import type { ModeloPeriodo, ModeloTipo } from "../types/modelos";

export async function reenviarSolicitudGestoria(
  modeloId: string,
): Promise<{ ok: boolean; error?: string; destino?: string | null }> {
  try {
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const admin = createAdminClient();

    const { data: modelo, error: errModelo } = await admin
      .from("modelos_aeat")
      .select("id, empresa_id, tipo, periodo, ejercicio, estado")
      .eq("id", modeloId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (errModelo) throw errModelo;
    if (!modelo) return { ok: false, error: "Modelo no encontrado" };

    const tipo = modelo.tipo as ModeloTipo;
    const periodo = modelo.periodo as ModeloPeriodo;
    const ejercicio = modelo.ejercicio as number;
    const grupo = grupoDeModelo(tipo);

    const { data: empresa } = await admin
      .from("empresas")
      .select("nombre")
      .eq("id", empresaId)
      .maybeSingle();
    const empresaNombre = (empresa?.nombre as string) ?? "la empresa";

    // Plantillas y destinatario (mismo resolver que el cron).
    const {
      resolverPlantillaOnboarding,
      resolverDestinatario,
      cuerpoOnboardingAHtml,
      PLANTILLAS_ONBOARDING,
    } = await import("@/features/rrhh/services/email-plantillas/resolver");

    // Nuevo token de subida para el periodo (re-envío ⇒ enlace nuevo válido).
    const tk = await crearTokenModelosGestoria(admin, {
      empresaId,
      ejercicio,
      grupo,
      periodo,
    });
    if (!tk.ok) return { ok: false, error: "No se pudo generar el enlace de subida." };

    const enlace = urlSubidaModelos(tk.token);
    const boton = botonSubidaModelosHtml(tk.token);
    const periodoLabel = periodoALabel(periodo, ejercicio);

    const clave =
      grupo === "TRIMESTRALES"
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
    if (!to) {
      return {
        ok: false,
        error:
          "No hay correo de gestoría configurado. Añádelo en Ajustes → Empresa → «Correos electrónicos».",
      };
    }

    let subject: string;
    let html: string;
    let text: string;
    if (tpl) {
      subject = tpl.asunto;
      html = `${cuerpoOnboardingAHtml(tpl.cuerpo)}${boton}`;
      text = `${tpl.cuerpo}\n\nSúbelos aquí: ${enlace}`;
    } else {
      const tituloGrupo = grupo === "TRIMESTRALES" ? "trimestrales" : "anuales";
      subject = `Modelos ${tituloGrupo} ${periodoLabel} · ${empresaNombre}`;
      html = `
        <p>Os solicitamos que subáis los modelos ${tituloGrupo} presentados del
        periodo <b>${periodoLabel}</b> de ${empresaNombre}.</p>
        <p>Al pulsar el botón podréis adjuntar cada modelo; se integrarán
        automáticamente en el software.</p>
        ${boton}
        <p style="color:#888;font-size:12px">Enviado desde el sistema de ${empresaNombre}.</p>`;
      text = `Subid los modelos ${tituloGrupo} de ${periodoLabel} aquí: ${enlace}`;
    }

    const res = await sendEmail({ to, subject, html, text, empresaId });
    if (!res.ok) {
      return { ok: false, error: "No se pudo enviar el correo a la gestoría (revisa el SMTP)." };
    }

    revalidatePath("/gestoria/modelos");
    revalidatePath(`/gestoria/modelos/${modeloId}`);
    return { ok: true, destino: to };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[modelos] reenviarSolicitudGestoria:", msg);
    return { ok: false, error: msg };
  }
}
