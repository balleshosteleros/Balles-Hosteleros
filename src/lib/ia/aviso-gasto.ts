import "server-only";

/**
 * Avisos por correo del gasto de IA: uno al 80% del tope y otro al alcanzarlo.
 *
 * Lo delicado aquí es NO repetir el aviso. Cada llamada a la IA comprueba el
 * presupuesto, así que un aviso ingenuo mandaría un correo por documento
 * procesado. El control es la propia tabla `ia_uso_log`: el aviso se apunta
 * como una fila más (con `feature` propio y coste cero), y antes de enviar se
 * mira si esa fila ya existe este mes. Así el "ya avisado" sobrevive a un
 * reinicio del servidor, cosa que una variable en memoria no haría.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { limiteIaEmail } from "@/lib/email/templates/limite-ia";

/** Buzón de avisos del sistema (el mismo que el aviso de límite de correos). */
const DESTINO_ALERTAS =
  process.env.EMAIL_ALERTAS?.trim() || "balleshosteleros@gmail.com";

/** Marcas que se guardan en `ia_uso_log.feature` para no repetir el aviso. */
const MARCA = {
  aviso: "sistema.aviso_gasto_ia_80",
  detenido: "sistema.aviso_gasto_ia_tope",
} as const;

function inicioDeMes(): string {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)).toISOString();
}

/**
 * Manda el aviso si toca y aún no se ha mandado este mes.
 *
 * Nunca lanza: un fallo avisando no puede tumbar la operación que el usuario
 * estaba haciendo.
 */
export async function avisarGastoIa(
  tipo: "aviso" | "detenido",
  gastado: number,
  tope: number,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const marca = MARCA[tipo];

    // ¿Ya se avisó este mes?
    const { data: previo } = await supabase
      .from("ia_uso_log")
      .select("id")
      .eq("feature", marca)
      .gte("created_at", inicioDeMes())
      .limit(1);
    if (previo && previo.length > 0) return;

    // Se marca ANTES de enviar. Si el envío falla, el aviso se pierde pero no
    // se reintenta en bucle en cada llamada siguiente; el corte del gasto —que
    // es lo que protege el dinero— no depende de este correo.
    await supabase.from("ia_uso_log").insert({
      feature: marca,
      modelo: null,
      tokens_input: 0,
      tokens_output: 0,
    });

    const { subject, html, text } = limiteIaEmail({ tipo, gastado, tope });
    await sendEmail({ to: DESTINO_ALERTAS, subject, html, text });
  } catch (err) {
    console.error("[ia/aviso-gasto]", err);
  }
}
