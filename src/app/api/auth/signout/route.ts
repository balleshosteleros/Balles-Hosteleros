import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  SESION_INICIO_COOKIE,
  SESION_INICIO_DUENO_COOKIE,
} from "@/features/auth/lib/session-expiry";

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

  // No se espera indefinidamente a Supabase: si tarda, se sigue igual y las
  // cookies se borran a mano abajo. Lo que NO puede pasar es que el usuario se
  // quede con la sesión viva porque una llamada externa fue lenta.
  await Promise.race([
    supabase.auth.signOut().catch(() => null),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  // Las cookies de sesión de Supabase (`sb-<ref>-auth-token`, y sus trozos
  // `.0`, `.1`… cuando el token es largo) se borran EXPLÍCITAMENTE.
  //
  // Antes se confiaba en que `signOut()` las limpiara. Pero si esa llamada falla
  // o tarda, la cookie sobrevivía: el usuario "cerraba sesión", volvía a entrar
  // y seguía dentro — que es justo lo que reportó Iván (05-ago).
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-")) {
      response.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    }
  }

  response.cookies.delete("g_access_token");
  response.cookies.delete("g_refresh_token");
  response.cookies.delete("g_email");
  response.cookies.delete("g_picture");
  response.cookies.delete("g_name");
  // Solo la caché: el roster real vive en `google_cuentas_usuario` y NO se
  // borra aquí a propósito. Así al volver a entrar las cuentas de Google
  // siguen conectadas y no hay que reconectarlas cada día.
  response.cookies.delete("g_accounts");
  response.cookies.delete("g_accounts_meta");
  // Reloj de caducidad de 8h: se borra para que el próximo login arranque limpio.
  response.cookies.delete(SESION_INICIO_COOKIE);
  response.cookies.delete(SESION_INICIO_DUENO_COOKIE);

  return response;
}
