import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SESION_INICIO_COOKIE } from "@/features/auth/lib/session-expiry";

export async function POST() {
  const cookieStore = await cookies();

  // Respuesta simple, NO un redirect (05-ago): los dos clientes que la llaman
  // (móvil y escritorio) navegan ellos mismos después. Con el 302, `fetch` lo
  // seguía y se descargaba la home entera antes de dejar continuar — en un móvil
  // con mala cobertura eso dejaba el botón girando y al usuario atrapado dentro.
  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.signOut();

  response.cookies.delete("g_access_token");
  response.cookies.delete("g_refresh_token");
  response.cookies.delete("g_email");
  response.cookies.delete("g_picture");
  response.cookies.delete("g_name");
  response.cookies.delete("g_accounts");
  response.cookies.delete("g_accounts_meta");
  // Reloj de caducidad de 8h: se borra para que el próximo login arranque limpio.
  response.cookies.delete(SESION_INICIO_COOKIE);

  return response;
}
