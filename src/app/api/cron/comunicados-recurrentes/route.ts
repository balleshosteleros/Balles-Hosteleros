/**
 * Cron: COMUNICADOS RECURRENTES.
 *
 * Los comunicados anuales (Navidad, Día del Trabajador, cambio de horario…) y
 * los mensuales (pagos, reunión de encargados, fichajes) se dejan escritos una
 * sola vez y deben salir SOLOS en su fecha, todos los años, sin que nadie se
 * acuerde de publicarlos.
 *
 * Cada día este cron busca los comunicados con `recurrencia` distinta de
 * `sin_repeticion` cuya fecha de `envio` ya ha llegado y:
 *   1. los marca como `publicado`,
 *   2. dispara push al móvil + notificación in-app (igual que al publicarlos a
 *      mano desde Gerencia),
 *   3. los manda por correo a la plantilla destinataria, con la cabecera de
 *      comunicado (isotipo sobre disco y degradado con el color de la empresa),
 *   4. y adelanta `envio` a la siguiente fecha (un año o un mes después), de
 *      modo que el año que viene vuelve a saltar sin tocar nada.
 *
 * Idempotente: al reprogramar `envio` a la siguiente ocurrencia, un segundo
 * pase el mismo día ya no lo encuentra. Si el cron no corre un día (caída), al
 * día siguiente recoge los atrasados porque la condición es `envio <= ahora`.
 *
 * Autorización: header `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import {
  fetchEmpresaMarca,
  comunicadoHeaderInline,
  comunicadoHeaderHtml,
  comunicadoEmailHtml,
} from "@/lib/email/comunicado-header";

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
  toda_empresa: boolean;
  roles_destinatarios: string[] | null;
  departamentos_destinatarios: string[] | null;
  empleados_destinatarios: string[] | null;
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

/** Texto plano de respaldo para los clientes que no pintan HTML. */
function aTextoPlano(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  const { data, error } = await supabase
    .from("comunicados")
    .select(
      "id, empresa_id, titulo, asunto, cuerpo, recurrencia, envio, toda_empresa, roles_destinatarios, departamentos_destinatarios, empleados_destinatarios",
    )
    .neq("recurrencia", "sin_repeticion")
    .not("envio", "is", null)
    .lte("envio", ahora);

  if (error) {
    console.error("[cron comunicados] consulta:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pendientes = (data ?? []) as Comunicado[];
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

      // 3) Correo a la plantilla destinataria: empleados ACTIVOS de la empresa.
      //    Se lee directo (admin client) porque `chat_empleados` depende del
      //    usuario en sesión y aquí no hay ninguno, y además no trae el correo.
      const { data: destinatarios } = await supabase
        .from("empleados")
        .select("email_personal, email_empresa")
        .eq("empresa_id", c.empresa_id)
        .eq("estado", "Activo");
      const emails = Array.from(
        new Set(
          (destinatarios ?? [])
            .map((r) => {
              const row = r as { email_personal: string | null; email_empresa: string | null };
              return (row.email_empresa || row.email_personal || "").trim().toLowerCase();
            })
            .filter((e) => e.includes("@") && !e.endsWith("@sin-email.migracion")),
        ),
      );

      if (emails.length > 0) {
        const marca = await fetchEmpresaMarca(c.empresa_id);
        const asunto = c.asunto?.trim() || c.titulo;
        const cuerpo = c.cuerpo ?? "";
        let html: string;
        let attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
        if (marca) {
          const inline = await comunicadoHeaderInline(marca, c.titulo);
          const cabecera = inline ? inline.html : comunicadoHeaderHtml(marca, c.titulo);
          html = comunicadoEmailHtml(cabecera, cuerpo, marca.nombre);
          if (inline) attachments = [inline.attachment];
        } else {
          html = comunicadoEmailHtml("", cuerpo);
        }

        for (const to of emails) {
          const res = await sendEmail({
            to,
            subject: asunto,
            html,
            text: aTextoPlano(cuerpo),
            fromName: marca?.nombre || undefined,
            empresaId: c.empresa_id,
            // El comunicado ya trae su propia cabecera: que no se añada la genérica.
            brandHeader: false,
            attachments,
          });
          if (res.ok) correos++;
        }
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
