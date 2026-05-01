import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SCOPES = [
  "email",
  "profile",
  // mail.google.com/ engloba lectura, envío, modificación de etiquetas y
  // borrado permanente. Reemplaza a gmail.readonly + gmail.send.
  "https://mail.google.com/",
  // Necesario para leer la firma corporativa configurada en Gmail.
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  // Necesario para resolver fotos de perfil de los contactos por email
  // (people:searchContacts y otherContacts:search).
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/contacts.other.readonly",
].join(" ");

/**
 * Inicia el flujo OAuth con Google a través de Supabase, pidiendo los
 * scopes de Gmail y Calendar. Es una ruta server-side: el navegador
 * llega aquí, le devolvemos un 302 a Google y nos olvidamos.
 *
 * Tras el consentimiento Google → Supabase → /callback (que ya guarda
 * provider_token y provider_refresh_token en cookies).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const switchAccount = url.searchParams.get("switch") === "1";

  const supabase = await createClient();
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

  return NextResponse.redirect(data.url);
}
