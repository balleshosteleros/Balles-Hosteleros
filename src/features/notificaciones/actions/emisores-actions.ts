"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { emitirNotificacion } from "@/features/notificaciones/actions/notificaciones-actions";
import { resolverAudienciaComunicado } from "@/features/gerencia/services/comunicado-destinatarios";
import { normalizarAdjuntos } from "@/features/gerencia/data/comunicados-adjuntos";

// Emisores por evento (PRP-065 Fase 3). Cada uno se dispara desde la acción de
// origen tras una publicación y emite en el espacio de logins (segmento
// "usuarios"). Todos son tolerantes a fallo: nunca rompen el flujo que los
// invoca. El comunicado NO va detrás de ningún interruptor: avisa siempre.

function recortar(texto: string | null | undefined, max = 140): string {
  const t = (texto ?? "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Comunicado publicado → notificación a su audiencia. Idempotente por comunicado. */
export async function emitirNotifComunicado(comunicadoId: string): Promise<void> {
  try {
    const audiencia = await resolverAudienciaComunicado(comunicadoId);
    if (!audiencia.empresaId || audiencia.userIds.length === 0) return;

    // Un comunicado avisa SIEMPRE: no va detrás de ningún interruptor. Es el
    // canal por el que la empresa comunica lo importante, y silenciarlo deja al
    // trabajador sin enterarse de algo que le afecta.
    //
    // El aviso lleva el texto ENTERO y sus documentos: al entrar en la app salta
    // en un aviso emergente donde se lee completo y se abre el adjunto, sin
    // tener que ir a buscarlo.
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("comunicados")
      .select("adjuntos")
      .eq("id", comunicadoId)
      .maybeSingle();

    // El aviso sale con la marca de la empresa que firma el comunicado, igual
    // que el correo. Sin isotipo se cae al logotipo, y sin ninguno, al icono.
    const { data: marca } = await supabase
      .from("empresas")
      .select("isotipo_url, logo_url")
      .eq("id", audiencia.empresaId)
      .maybeSingle();
    const isotipoUrl =
      (marca?.isotipo_url as string | null) ||
      (marca?.logo_url as string | null) ||
      null;

    await emitirNotificacion({
      empresaId: audiencia.empresaId,
      system: true,
      tipo: "comunicado",
      titulo: audiencia.titulo || "Nuevo comunicado",
      mensaje: recortar(audiencia.cuerpo),
      segmento: { tipo: "usuarios", usuarioIds: audiencia.userIds },
      refTabla: "comunicados",
      refId: comunicadoId,
      // La pantalla del trabajador, que es quien recibe el aviso. "/comunicados"
      // a secas no existe: al pulsar el aviso salía un 404.
      accionUrl: "/mi-panel/comunicados",
      dedupeKey: `comunicado:${comunicadoId}`,
      payload: {
        cuerpo: audiencia.cuerpo,
        adjuntos: normalizarAdjuntos((data as { adjuntos?: unknown } | null)?.adjuntos),
        isotipoUrl,
      },
      // El comunicado ya dispara su propio push (comunicado_nuevo); evitamos duplicarlo.
      push: false,
    });
  } catch (e) {
    console.error("[emisores] emitirNotifComunicado:", e);
  }
}
