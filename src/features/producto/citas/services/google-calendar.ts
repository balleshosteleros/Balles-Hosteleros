/**
 * Espejo de una cita en Google Calendar (PRP-088).
 *
 * Quien reserva desde un embudo es anónimo, así que aquí NO hay sesión de la
 * que sacar el permiso de Google: el calendario guarda a nombre de qué cuenta
 * se crean sus eventos (`google_cuenta_email`) y de quién es esa conexión
 * (`google_user_id`), y de ahí se saca el permiso guardado.
 *
 * Si Google falla, la cita ya está guardada en el software: esto es un espejo,
 * nunca la fuente de verdad.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "@/lib/google/api";
import { zonaHorariaDeConfig } from "@/features/empresa/lib/empresa-server";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface CuentaGuardada {
  email: string;
  refreshToken: string;
}

/** Permiso guardado de una cuenta de Google concreta, sin pasar por la sesión. */
async function permisoDeCuenta(
  userId: string,
  email: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("google_cuentas_usuario")
    .select("cuentas")
    .eq("user_id", userId)
    .maybeSingle();

  const cuentas = ((data as { cuentas?: CuentaGuardada[] } | null)?.cuentas ?? []) as CuentaGuardada[];
  const cuenta = cuentas.find((c) => c.email?.toLowerCase() === email.toLowerCase());
  if (!cuenta?.refreshToken) return null;
  return refreshAccessToken(cuenta.refreshToken);
}

export async function sincronizarCitaConGoogle(citaId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: citaRow } = await supabase
    .from("citas")
    .select(
      `id, empresa_id, inicio, fin, notas, origen, google_event_id,
       citas_calendarios(nombre, google_cuenta_email, google_user_id),
       clientes_sala(nombre, apellidos, email, telefono)`,
    )
    .eq("id", citaId)
    .maybeSingle();

  if (!citaRow) return;
  const cita = citaRow as Record<string, unknown>;
  const cal = cita.citas_calendarios as
    | { nombre?: string; google_cuenta_email?: string | null; google_user_id?: string | null }
    | null;

  // Sin cuenta designada no hay espejo, y no es un error: el calendario puede
  // funcionar solo dentro del software.
  if (!cal?.google_cuenta_email || !cal.google_user_id) return;
  if (cita.google_event_id) return; // ya estaba

  const accessToken = await permisoDeCuenta(cal.google_user_id, cal.google_cuenta_email);
  if (!accessToken) {
    console.error("[citas][google] sin permiso válido para", cal.google_cuenta_email);
    return;
  }

  const { data: emp } = await supabase
    .from("empresas")
    .select("datos_generales")
    .eq("id", cita.empresa_id as string)
    .maybeSingle();
  const zona = zonaHorariaDeConfig((emp as { datos_generales?: unknown } | null)?.datos_generales);

  const cli = cita.clientes_sala as
    | { nombre?: string; apellidos?: string; email?: string; telefono?: string }
    | null;
  const nombreCliente = [cli?.nombre, cli?.apellidos].filter(Boolean).join(" ").trim() || "Sin nombre";

  const descripcion = [
    cli?.telefono ? `Teléfono: ${cli.telefono}` : null,
    cli?.email ? `Correo: ${cli.email}` : null,
    cita.origen ? `Viene de: ${cita.origen}` : null,
    cita.notas ? `\n${cita.notas}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const cuerpo = {
    summary: `${cal.nombre ?? "Cita"} — ${nombreCliente}`,
    description: descripcion || undefined,
    start: { dateTime: new Date(cita.inicio as string).toISOString(), timeZone: zona },
    end: { dateTime: new Date(cita.fin as string).toISOString(), timeZone: zona },
    attendees: cli?.email ? [{ email: cli.email, displayName: nombreCliente }] : undefined,
    // Videollamada automática: la cita del embudo se hace por vídeo.
    conferenceData: { createRequest: { requestId: citaId } },
  };

  try {
    const res = await fetch(
      `${CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cuerpo),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      console.error("[citas][google] alta fallida:", res.status, (await res.text()).slice(0, 200));
      return;
    }

    const evento = (await res.json()) as { id?: string };
    if (evento.id) {
      await supabase
        .from("citas")
        .update({
          google_event_id: evento.id,
          google_cuenta_email: cal.google_cuenta_email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", citaId);
    }
  } catch (err) {
    console.error("[citas][google] error:", err);
  }
}

/** Quita el evento de Google cuando la cita se cancela. */
export async function cancelarCitaEnGoogle(citaId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("citas")
    .select("google_event_id, citas_calendarios(google_cuenta_email, google_user_id)")
    .eq("id", citaId)
    .maybeSingle();

  const fila = data as Record<string, unknown> | null;
  const cal = fila?.citas_calendarios as
    | { google_cuenta_email?: string | null; google_user_id?: string | null }
    | null;
  const eventoId = fila?.google_event_id as string | null;
  if (!eventoId || !cal?.google_cuenta_email || !cal.google_user_id) return;

  const accessToken = await permisoDeCuenta(cal.google_user_id, cal.google_cuenta_email);
  if (!accessToken) return;

  try {
    await fetch(`${CALENDAR_API}/calendars/primary/events/${eventoId}?sendUpdates=all`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    await supabase.from("citas").update({ google_event_id: null }).eq("id", citaId);
  } catch (err) {
    console.error("[citas][google] borrado:", err);
  }
}
