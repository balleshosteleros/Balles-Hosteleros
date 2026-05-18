import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SCOPES = [
  "email",
  "profile",
  // Scopes granulares de Gmail (SENSIBLE, no RESTRICTED). Evitamos
  // `mail.google.com/` para no exigir auditoría CASA en verificación.
  // Coste: no se puede borrar permanente desde el portal (solo papelera).
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/contacts.other.readonly",
].join(" ");

// Cookies temporales para sostener la identidad del software durante el
// rebote a Google. Vida corta: si el usuario tarda más de 10 minutos en
// volver, se invalidan solas y el callback ya no las restaura.
const TEMP_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

/**
 * Inicia el flujo OAuth con Google a través de Supabase, pidiendo los
 * scopes de Gmail y Calendar.
 *
 * IMPORTANTE: la sesión de Supabase del usuario del software y la cuenta
 * de Google son cosas distintas. Antes de redirigir guardamos la sesión
 * actual en cookies temporales (`sb_pending_*`) para que el callback
 * pueda restaurarla tras intercambiar el code. Si no hacemos esto,
 * Supabase nos loguea como el correo Google que acabamos de añadir y se
 * pierde el usuario original.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const switchAccount = url.searchParams.get("switch") === "1";
  const nextPath = url.searchParams.get("next") || "/";

  const supabase = await createClient();

  // Foto de la sesión actual antes de tocar nada.
  const { data: sessionData } = await supabase.auth.getSession();
  const currentSession = sessionData.session;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // URL simple, sin query params encadenados — Supabase es estricto con esto
      redirectTo: `${origin}/callback`,
      scopes: SCOPES,
      queryParams: {
        access_type: "offline",
        // Si el usuario quiere cambiar de cuenta, fuerza el selector de cuentas
        prompt: switchAccount ? "select_account consent" : "consent",
      },
    },
  });

  if (error || !data?.url) {
    console.error("[google/connect] error:", error);
    return NextResponse.json(
      {
        error: "no_oauth_url",
        message:
          error?.message ??
          "Supabase no devolvió una URL de OAuth. Revisa la configuración de Google en Supabase Auth.",
      },
      { status: 500 },
    );
  }

  const response = NextResponse.redirect(data.url);

  if (currentSession?.access_token && currentSession?.refresh_token) {
    response.cookies.set(
      "sb_pending_access",
      currentSession.access_token,
      TEMP_OPTS,
    );
    response.cookies.set(
      "sb_pending_refresh",
      currentSession.refresh_token,
      TEMP_OPTS,
    );
    response.cookies.set("g_connect_next", nextPath, TEMP_OPTS);
  }

  return response;
}
