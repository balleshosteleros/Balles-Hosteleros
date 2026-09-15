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
 *
 * El aviso a quien reserva NO lo manda Google (`sendUpdates=none`): lo manda el
 * software, con la marca de la empresa y con el enlace de la videollamada
 * dentro (`notificarCitaConfirmada`). Antes el único correo que recibía era la
 * invitación de Google, que no lleva nuestra marca y que no llega si Google
 * tiene un mal día.
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
    .select("config_operativa")
    .eq("id", cita.empresa_id as string)
    .maybeSingle();
  const zona = zonaHorariaDeConfig((emp as { config_operativa?: unknown } | null)?.config_operativa);

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
      // `sendUpdates=none`: el correo a quien reserva lo manda el software.
      `${CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none`,
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

    const evento = (await res.json()) as {
      id?: string;
      hangoutLink?: string;
      conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
    };
    if (evento.id) {
      // El enlace de la videollamada se guarda de nuestro lado: es lo que lleva
      // el correo de confirmación, y sin él quien reserva no tiene dónde entrar.
      const meet =
        evento.hangoutLink ||
        evento.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
        null;
      await supabase
        .from("citas")
        .update({
          google_event_id: evento.id,
          google_cuenta_email: cal.google_cuenta_email,
          google_meet_url: meet,
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
    // `sendUpdates=none`, igual que al darla de alta: la anulación se la manda
    // el software, con su marca y con el `.ics` de tipo CANCEL que le quita la
    // cita del calendario. Con `all`, Google mandaba ADEMÁS la suya y la misma
    // persona recibía dos avisos de lo mismo.
    await fetch(`${CALENDAR_API}/calendars/primary/events/${eventoId}?sendUpdates=none`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    await supabase.from("citas").update({ google_event_id: null }).eq("id", citaId);
  } catch (err) {
    console.error("[citas][google] borrado:", err);
  }
}

/**
 * Qué dice Google de la cita: si el evento sigue en pie y qué ha contestado
 * quien fue invitado.
 *
 * Es el único modo de enterarse de que el cliente ha rechazado la cita **desde
 * su calendario**. El correo de invitación lo firma un buzón que nadie lee
 * (`notificaciones@…`), así que su respuesta no llega a ninguna bandeja: lo que
 * sí queda es su `responseStatus` en el evento del calendario de la empresa.
 *
 * Devuelve `null` si no se puede saber (sin cuenta, sin permiso, Google caído).
 * `null` NO es "lo ha rechazado": ante la duda no se toca la cita.
 */
export async function estadoDeLaCitaEnGoogle(
  citaId: string,
): Promise<{ borrado: boolean; rechazada: boolean } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("citas")
    .select(
      `google_event_id,
       clientes_sala(email),
       citas_calendarios(google_cuenta_email, google_user_id)`,
    )
    .eq("id", citaId)
    .maybeSingle();

  const fila = data as Record<string, unknown> | null;
  const cal = fila?.citas_calendarios as
    | { google_cuenta_email?: string | null; google_user_id?: string | null }
    | null;
  const eventoId = fila?.google_event_id as string | null;
  if (!eventoId || !cal?.google_cuenta_email || !cal.google_user_id) return null;

  const accessToken = await permisoDeCuenta(cal.google_user_id, cal.google_cuenta_email);
  if (!accessToken) return null;

  try {
    const res = await fetch(`${CALENDAR_API}/calendars/primary/events/${eventoId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    // 404/410 = el evento ya no está: alguien lo borró del calendario.
    if (res.status === 404 || res.status === 410) return { borrado: true, rechazada: false };
    if (!res.ok) return null;

    const evento = (await res.json()) as {
      status?: string;
      attendees?: { email?: string; responseStatus?: string }[];
    };
    const emailCliente = (
      (fila?.clientes_sala as { email?: string | null } | null)?.email ?? ""
    ).toLowerCase();
    const suyo = (evento.attendees ?? []).find(
      (a) => (a.email ?? "").toLowerCase() === emailCliente,
    );
    return {
      borrado: evento.status === "cancelled",
      rechazada: suyo?.responseStatus === "declined",
    };
  } catch (err) {
    console.error("[citas][google] lectura:", err);
    return null;
  }
}
