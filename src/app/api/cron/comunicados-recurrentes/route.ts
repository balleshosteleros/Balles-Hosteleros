/**
 * Cron: COMUNICADOS RECURRENTES.
 *
 * Los comunicados anuales (Navidad, Día del Trabajador, cambio de horario…) y
 * los mensuales (pagos, reunión de encargados, fichajes) se dejan escritos una
 * sola vez y deben salir SOLOS en su fecha, todos los años, sin que nadie se
 * acuerde de publicarlos.
 *
 * Cada HORA este cron busca los comunicados con `recurrencia` distinta de
 * `sin_repeticion` cuya fecha de `envio` ya ha llegado y, por cada uno:
 *   1. DEJA UNA LÍNEA NUEVA con la salida de hoy —una copia publicada, con el
 *      día que ha salido y su propio alcance—, para que cada vez que sale se
 *      persiga por separado y no se mezclen los vistos de todos los años
 *      (Iván, 12-09-2026),
 *   2. dispara push al móvil + notificación in-app de ESA salida (igual que al
 *      publicarla a mano desde Gerencia),
 *   3. la manda por correo a la plantilla destinataria, con la cabecera de
 *      comunicado (isotipo sobre disco y degradado con el color de la empresa),
 *   4. y deja la PLANTILLA esperando su siguiente fecha (un año o un mes
 *      después), de modo que el año que viene vuelve a saltar sin tocar nada.
 *
 * Una plantilla con `repeticion_parada_at` no sale: se paró a mano y no vuelve
 * a salir nunca más, pero sigue escrita para poder arrancarla otro día.
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
import { crearSalidaDePlantilla } from "@/features/gerencia/services/comunicado-salidas";

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
  /** Tipo del comunicado. `sancion` no se publica y ya está: se emite. */
  tipo: string | null;
  toda_empresa: boolean | null;
  roles_destinatarios: string[] | null;
  empleados_destinatarios: string[] | null;
  departamentos_destinatarios: string[] | null;
  adjuntos: unknown;
  enlace: string | null;
  enlace_texto: string | null;
  observaciones: string | null;
  creador_id: string | null;
  /** Solo en las sanciones: la falta, el día de los hechos y el plazo de firma. */
  sancion: unknown;
};

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
    "id, empresa_id, titulo, asunto, cuerpo, recurrencia, envio, enviar_email, tipo, " +
    "toda_empresa, roles_destinatarios, empleados_destinatarios, departamentos_destinatarios, " +
    "adjuntos, enlace, enlace_texto, observaciones, creador_id, sancion";

  // 1) Los que se repiten: se publican cada vez que les toca y se reprograman.
  const { data, error } = await supabase
    .from("comunicados")
    .select(CAMPOS)
    .neq("recurrencia", "sin_repeticion")
    // Una repetición parada a mano NO vuelve a salir. La plantilla se queda
    // escrita para poder arrancarla otro día, pero el cron la ignora.
    .is("repeticion_parada_at", null)
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

  // Los que se repiten van marcados: de esos nace una línea nueva por salida.
  // Los programados de una sola vez son ellos mismos la salida.
  const pendientes: { c: Comunicado; seRepite: boolean }[] = [
    ...((data ?? []) as unknown as Comunicado[]).map((c) => ({ c, seRepite: true })),
    ...((unaVez ?? []) as unknown as Comunicado[]).map((c) => ({ c, seRepite: false })),
  ];
  let publicados = 0;
  let correos = 0;
  const errores: string[] = [];

  for (const { c, seRepite } of pendientes) {
    try {
      // Una sanción no se repite NUNCA: va a una persona por unos hechos de un
      // día concreto. Si alguna quedó marcada así, se avisa y no se toca.
      if (seRepite && c.tipo === "sancion") {
        errores.push(`${c.titulo}: una sanción no puede repetirse; revisa su ficha`);
        continue;
      }

      /**
       * QUÉ SALE HOY.
       *
       * En los que se repiten, la línea que se escribió es la PLANTILLA y se
       * queda esperando su próxima fecha: lo que sale hoy es una copia
       * publicada, con el día de hoy y su propio alcance. En los de una sola
       * vez, la salida es la propia línea.
       */
      let idSalida = c.id;
      if (seRepite) {
        const salida = await crearSalidaDePlantilla(supabase, c.id, ahora);
        if (!salida.ok) throw new Error(salida.error);
        idSalida = salida.idSalida;
      } else {
        const { error: errUpd } = await supabase
          .from("comunicados")
          .update({ estado: "publicado" })
          .eq("id", c.id);
        if (errUpd) throw new Error(errUpd.message);
      }
      publicados++;

      // 1-bis) UNA SANCIÓN NO SE PUBLICA Y YA ESTÁ. El día que le toca salir es
      //    cuando se monta su documento, se registra para firma y le llega al
      //    trabajador por correo y aviso. El comunicado que se acaba de
      //    publicar es el que le queda a él en su panel, así que no se crea
      //    otro, y los avisos normales se saltan: el de firma es el bueno.
      if (c.tipo === "sancion") {
        const { emitirSancion } = await import(
          "@/features/gerencia/actions/sancion-disciplinaria-actions"
        );
        const { leerSancionProgramada } = await import(
          "@/features/gerencia/data/sancion-programada"
        );
        const datos = leerSancionProgramada(c.sancion);
        const destinatario = (c.empleados_destinatarios ?? [])[0];
        if (!datos || !destinatario) {
          errores.push(`${c.titulo}: sanción programada sin datos; no se ha podido emitir`);
          continue;
        }
        const res = await emitirSancion({
          empresaId: c.empresa_id,
          emitidaPor: c.creador_id,
          comunicadoId: c.id,
          empleadoId: destinatario,
          gravedad: datos.gravedad,
          fechaHechos: datos.fechaHechos,
          hechos: c.cuerpo ?? "",
          plazoDias: datos.plazoDias,
        });
        if (!res.ok) errores.push(`${c.titulo}: ${res.error}`);
        continue;
      }

      // 2) Push al móvil + notificación in-app (mismo camino que al publicar a mano).
      try {
        const { notificarComunicadoNuevo } = await import(
          "@/features/mi-panel/mobile/lib/push-comunicado"
        );
        await notificarComunicadoNuevo(idSalida);
      } catch (e) {
        console.error("[cron comunicados] push:", e);
      }
      try {
        const { emitirNotifComunicado } = await import(
          "@/features/notificaciones/actions/emisores-actions"
        );
        await emitirNotifComunicado(idSalida);
      } catch (e) {
        console.error("[cron comunicados] notif:", e);
      }

      // 3) Correo a los destinatarios, con sus documentos adjuntos. Se hace por
      //    el MISMO camino que al publicarlo a mano (`comunicado-email`): antes
      //    este cron tenía su propia copia, que mandaba el comunicado a la
      //    plantilla entera aunque fuera para un solo departamento.
      if (c.enviar_email === true) {
        const res = await enviarComunicadoPorEmail(idSalida);
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
