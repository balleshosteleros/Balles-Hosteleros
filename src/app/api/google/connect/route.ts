import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SCOPES = [
  "openid",
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
  // Importador de Drive (PRP-081): SOLO LECTURA. El software nunca borra ni
  // mueve nada en Drive — el vaciado lo hace Iván a mano cuando haya
  // verificado que está todo copiado en Archivos.
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

// Vida corta: si el usuario tarda más de 10 minutos en volver de Google, se
// invalidan solas y el callback rechaza la vuelta.
const TEMP_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

/**
 * Inicia la VINCULACIÓN de una cuenta de Google para correo y calendario.
 *
 * Va DIRECTO a Google, sin pasar por Supabase Auth. Vincular un buzón no es
 * iniciar sesión: la cuenta de Google no tiene por qué ser un usuario del
 * software. Antes esto usaba `supabase.auth.signInWithOAuth`, y Supabase
 * intentaba dar de alta como usuario el correo que se quería vincular; con
 * cualquier correo no invitado, el trigger `handle_new_user` abortaba el alta
 * y la vinculación terminaba en «no tienes acceso». Con las cuentas que sí
 * eran usuarios (p. ej. la de Bacanal) funcionaba, y de ahí que fallara solo
 * con unas sí y otras no.
 *
 * La sesión del software ni se toca: sigues siendo tú, y la cuenta vinculada
 * se guarda en el roster de `google_cuentas_usuario`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const switchAccount = url.searchParams.get("switch") === "1";
  const nextPath = url.searchParams.get("next") || "/";

  // Vincular es una acción del usuario que ya está dentro. Sin sesión no hay
  // a quién asociar la cuenta, así que al login.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/?auth=1`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("[google/connect] falta GOOGLE_CLIENT_ID");
    return NextResponse.json(
      {
        error: "sin_credenciales",
        message:
          "Falta GOOGLE_CLIENT_ID en el entorno. Sin esa credencial no se puede vincular ninguna cuenta de Google.",
      },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set(
    "redirect_uri",
    `${origin}/api/google/vincular-callback`,
  );
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  // `consent` siempre: es lo que garantiza que Google devuelva refresh_token.
  // Sin él, la cuenta caducaría en una hora y pediría reconectar sola.
  authUrl.searchParams.set(
    "prompt",
    switchAccount ? "select_account consent" : "consent",
  );
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("g_vincular_next", nextPath, TEMP_OPTS);
  response.cookies.set("g_vincular_state", state, TEMP_OPTS);
  return response;
}
