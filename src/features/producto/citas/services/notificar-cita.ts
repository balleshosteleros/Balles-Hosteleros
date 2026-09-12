import "server-only";

/**
 * Correo de confirmación de una cita del embudo (PRP-088).
 *
 * Lo manda el SOFTWARE, con la marca de la empresa. Antes el único aviso que
 * recibía quien reservaba era el que Google envía al invitarle al evento: si
 * Google fallaba —o si el calendario no tiene cuenta designada— la persona se
 * quedaba sin nada aunque su cita estuviera guardada. Google es el espejo,
 * nunca la fuente.
 *
 * Va DESPUÉS de crear el evento en Google, para poder meter el enlace de la
 * videollamada en el correo. Si el evento no llegó a crearse, el correo sale
 * igual: sin enlace, diciendo que se enviará después.
 *
 * Nunca lanza: un fallo de correo no puede tumbar una cita ya reservada.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { citaConfirmacionEmail } from "@/lib/email/citas/confirmacion";
import { construirIcs } from "@/lib/email/citas/ics";
import { zonaHorariaDeConfig } from "@/features/empresa/lib/empresa-server";
import { formatFechaEnZona, formatHoraEnZona } from "@/features/empresa/lib/zona-horaria";

/** "Europe/Madrid" → "Madrid". Lo que se le enseña a quien reserva. */
function ciudadDeZona(tz: string): string {
  const trozo = tz.split("/").pop() ?? tz;
  return trozo.replace(/_/g, " ");
}

export async function notificarCitaConfirmada(
  citaId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient();

    const { data: filaCita } = await admin
      .from("citas")
      .select(
        `id, empresa_id, inicio, fin, google_meet_url,
         citas_calendarios(nombre, duracion_min),
         clientes_sala(nombre, apellidos, email),
         empleados(nombre, apellidos)`,
      )
      .eq("id", citaId)
      .maybeSingle();

    if (!filaCita) return { ok: false, error: "Cita no encontrada." };
    const cita = filaCita as Record<string, unknown>;

    const cliente = cita.clientes_sala as
      | { nombre?: string | null; apellidos?: string | null; email?: string | null }
      | null;
    const destino = cliente?.email?.trim();
    // Sin correo no hay a quién escribir, y no es un error: una cita puede
    // haberse apuntado desde dentro sin dirección.
    if (!destino) return { ok: true };

    const empresaId = cita.empresa_id as string;
    const { data: empresa } = await admin
      .from("empresas")
      .select(
        "nombre, logo_url, isotipo_url, logo_alt_url, color, color_secundario, datos_generales, config_operativa",
      )
      .eq("id", empresaId)
      .maybeSingle();

    const zona = zonaHorariaDeConfig(
      (empresa as { config_operativa?: unknown } | null)?.config_operativa,
    );

    const generales = (empresa as { datos_generales?: Record<string, unknown> } | null)
      ?.datos_generales;
    const telefono =
      typeof generales?.telefonoPrincipal === "string" ? generales.telefonoPrincipal : null;

    const cal = cita.citas_calendarios as
      | { nombre?: string | null; duracion_min?: number | null }
      | null;
    const empleado = cita.empleados as
      | { nombre?: string | null; apellidos?: string | null }
      | null;

    const inicioISO = cita.inicio as string;
    const finISO = cita.fin as string;
    const nombreCalendario = cal?.nombre?.trim() || "Cita";
    const nombreEmpresa = ((empresa as { nombre?: string | null } | null)?.nombre ?? "").trim();

    const { subject, html, text } = citaConfirmacionEmail({
      empresa: {
        nombre: nombreEmpresa,
        logo_url: (empresa as { logo_url?: string | null } | null)?.logo_url ?? null,
        isotipo_url: (empresa as { isotipo_url?: string | null } | null)?.isotipo_url ?? null,
        logo_alt_url: (empresa as { logo_alt_url?: string | null } | null)?.logo_alt_url ?? null,
        color: (empresa as { color?: string | null } | null)?.color ?? null,
        color_secundario:
          (empresa as { color_secundario?: string | null } | null)?.color_secundario ?? null,
        telefono,
      },
      calendario: nombreCalendario,
      clienteNombre: [cliente?.nombre, cliente?.apellidos].filter(Boolean).join(" ").trim(),
      fechaLarga: formatFechaEnZona(inicioISO, zona, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      hora: formatHoraEnZona(inicioISO, zona),
      duracionMin:
        cal?.duracion_min ??
        Math.round((new Date(finISO).getTime() - new Date(inicioISO).getTime()) / 60_000),
      ciudadZona: ciudadDeZona(zona),
      conQuien: [empleado?.nombre, empleado?.apellidos].filter(Boolean).join(" ").trim() || null,
      meetUrl: (cita.google_meet_url as string | null) ?? null,
    });

    const ics = construirIcs({
      uid: `cita-${citaId}@balleshosteleros.com`,
      inicioISO,
      finISO,
      titulo: nombreEmpresa ? `${nombreCalendario} · ${nombreEmpresa}` : nombreCalendario,
      descripcion: (cita.google_meet_url as string | null) ?? null,
      url: (cita.google_meet_url as string | null) ?? null,
    });

    const res = await sendEmail({
      to: destino,
      subject,
      html,
      text,
      empresaId,
      // El correo pinta su propia cabecera de marca, como los de Sala.
      brandHeader: false,
      attachments: [
        { filename: "cita.ics", content: ics, contentType: "text/calendar; charset=utf-8" },
      ],
    });

    if (!res.ok) {
      const motivo = "error" in res ? res.error : "transporte de correo sin configurar";
      console.error("[citas][notificar] no enviado:", motivo);
      return { ok: false, error: motivo };
    }
    return { ok: true };
  } catch (err) {
    console.error("[citas][notificar] fatal:", err);
    return { ok: false, error: "No se pudo enviar la confirmación." };
  }
}
