import "server-only";

import { sendPushToUser } from "./push-server";
import { resolverAudienciaComunicado } from "@/features/gerencia/services/comunicado-destinatarios";

/**
 * Push al móvil de un comunicado recién publicado.
 *
 * A quién va lo decide `resolverAudienciaComunicado`, la fuente única que
 * comparten la campana, el push y el correo. Antes esto tenía su propia
 * resolución, que consultaba `usuarios` con la sesión de quien publicaba: como
 * esa tabla solo deja ver el propio perfil, un comunicado "a toda la empresa"
 * avisaba únicamente a quien le daba a publicar.
 */
export async function notificarComunicadoNuevo(comunicadoId: string): Promise<void> {
  try {
    const { userIds, empresaId, titulo, cuerpo } =
      await resolverAudienciaComunicado(comunicadoId);
    if (!empresaId || userIds.length === 0) return;

    const body = cuerpo
      ? cuerpo.length > 110
        ? `${cuerpo.slice(0, 110)}…`
        : cuerpo
      : "Toca para leer el comunicado completo";

    await Promise.all(
      userIds.map((userId) =>
        sendPushToUser({
          userId,
          empresaId,
          eventType: "comunicado_nuevo",
          payload: {
            title: titulo || "Nuevo comunicado",
            body,
            url: "/m/comunicados",
            tag: `comunicado-${comunicadoId}`,
            data: { url: "/m/comunicados" },
          },
        }),
      ),
    );
  } catch (e) {
    console.error("[push] notificarComunicadoNuevo:", e);
  }
}
