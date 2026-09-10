/**
 * Cron: COMUNICADOS RECURRENTES.
 *
 * Los comunicados anuales (Navidad, Día del Trabajador, cambio de horario…) y
 * los mensuales (pagos, reunión de encargados, fichajes) se dejan escritos una
 * sola vez y deben salir SOLOS en su fecha, todos los años, sin que nadie se
 * acuerde de publicarlos.
 *
 * Cada HORA este cron busca los comunicados con `recurrencia` distinta de
 * `sin_repeticion` cuya fecha de `envio` ya ha llegado y:
 *   1. los marca como `publicado`,
 *   2. dispara push al móvil + notificación in-app (igual que al publicarlos a
 *      mano desde Gerencia),
 *   3. los manda por correo a la plantilla destinataria, con la cabecera de
 *      comunicado (isotipo sobre disco y degradado con el color de la empresa),
 *   4. y adelanta `envio` a la siguiente fecha (un año o un mes después), de
 *      modo que el año que viene vuelve a saltar sin tocar nada.
 *
 * Corre cada hora a propósito: la hora de salida la decide el campo `envio` de
 * cada comunicado (se edita en su ficha), no el `schedule`. Con un cron diario,
 * uno programado a las 10:00 no salía hasta el día siguiente.
 *
 * Idempotente: al reprogramar `envio` a la siguiente ocurrencia, un segundo
 * pase el mismo día ya no lo encuentra. Si el cron no corre un día (caída), al
 * día siguiente recoge los atrasados porque la condición es `envio <= ahora`.
 *
 * Autorización: header `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { enviarComunicadoPorEmail } from "@/features/gerencia/services/comunicado-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Comunicado = {
  id: string;
  empresa_id: string;
  titulo: string;
  asunto: string | null;
  cuerpo: string | null;
  recurrencia: string;
  envio: string;
  enviar_email: boolean;
};

/** Siguiente ocurrencia según la recurrencia. Conserva la hora del envío. */
function siguienteEnvio(iso: string, recurrencia: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  switch (recurrencia) {
    case "anual":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d.toISOString();
    case "mensual":
      d.setUTCMonth(d.getUTCMonth() + 1);
      return d.toISOString();
    case "semanal":
      d.setUTCDate(d.getUTCDate() + 7);
      return d.toISOString();
    case "diaria":
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString();
    default:
      return null;
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "Configuración inválida" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const ahora = new Date().toISOString();
  const CAMPOS =
    "id, empresa_id, titulo, asunto, cuerpo, recurrencia, envio, enviar_email";

  // 1) Los que se repiten: se publican cada vez que les toca y se reprograman.
  const { data, error } = await supabase
    .from("comunicados")
    .select(CAMPOS)
    .neq("recurrencia", "sin_repeticion")
    .not("envio", "is", null)
    .lte("envio", ahora);

  if (error) {
    console.error("[cron comunicados] consulta:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2) Los programados de una sola vez. Van aparte porque el filtro es otro: se
  //    reconocen por el estado `programado`, no por la recurrencia. Sin esto, un
  //    comunicado con fecha y sin repetición se quedaba esperando para siempre:
  //    nadie lo publicaba nunca. Salen UNA vez, porque al publicarse dejan de
  //    estar en estado `programado`.
  const { data: unaVez, error: errUnaVez } = await supabase
    .from("comunicados")
    .select(CAMPOS)
    .eq("recurrencia", "sin_repeticion")
    .eq("estado", "programado")
    .not("envio", "is", null)
    .lte("envio", ahora);

  if (errUnaVez) {
    console.error("[cron comunicados] consulta programados:", errUnaVez.message);
    return NextResponse.json({ error: errUnaVez.message }, { status: 500 });
  }

  const pendientes = [...(data ?? []), ...(unaVez ?? [])] as Comunicado[];
  let publicados = 0;
  let correos = 0;
  const errores: string[] = [];

  for (const c of pendientes) {
    try {
      // 1) Publicar y reprogramar a la siguiente ocurrencia.
      const proximo = siguienteEnvio(c.envio, c.recurrencia);
      const { error: errUpd } = await supabase
        .from("comunicados")
        .update({ estado: "publicado", envio: proximo ?? c.envio })
        .eq("id", c.id);
      if (errUpd) throw new Error(errUpd.message);
      publicados++;

      // 2) Push al móvil + notificación in-app (mismo camino que al publicar a mano).
      try {
        const { notificarComunicadoNuevo } = await import(
          "@/features/mi-panel/mobile/lib/push-comunicado"
        );
        await notificarComunicadoNuevo(c.id);
      } catch (e) {
        console.error("[cron comunicados] push:", e);
      }
      try {
        const { emitirNotifComunicado } = await import(
          "@/features/notificaciones/actions/emisores-actions"
        );
        await emitirNotifComunicado(c.id);
      } catch (e) {
        console.error("[cron comunicados] notif:", e);
      }

      // 3) Correo a los destinatarios, con sus documentos adjuntos. Se hace por
      //    el MISMO camino que al publicarlo a mano (`comunicado-email`): antes
      //    este cron tenía su propia copia, que mandaba el comunicado a la
      //    plantilla entera aunque fuera para un solo departamento.
      if (c.enviar_email === true) {
        const res = await enviarComunicadoPorEmail(c.id);
        correos += res.enviados;
        if (!res.ok && res.error) errores.push(`${c.titulo} (correo): ${res.error}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errores.push(`${c.titulo}: ${msg}`);
      console.error("[cron comunicados]", c.id, msg);
    }
  }

  return NextResponse.json({
    ok: true,
    revisados: pendientes.length,
    publicados,
    correos,
    errores,
  });
}
