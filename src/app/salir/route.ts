import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  SESION_INICIO_COOKIE,
  SESION_INICIO_DUENO_COOKIE,
} from "@/features/auth/lib/session-expiry";

/**
 * SALIDA DE EMERGENCIA — `sistema.balleshosteleros.com/salir`
 *
 * Cierra la sesión con una simple visita desde el navegador (GET), sin depender de
 * que la app cargue, del botón, ni de JavaScript.
 *
 * Por qué existe (Iván, 05-ago): la PWA instalada en iOS **no se recarga al
 * reabrirla** — resucita un "snapshot" congelado de la última vez. Si esa copia
 * guardada tiene una versión antigua del código, el botón de cerrar sesión sigue
 * roto por mucho que se arregle en el servidor, y el usuario se queda atrapado sin
 * forma de salir.
 *
 * Esta ruta es la puerta de atrás: se escribe en el navegador y siempre funciona.
 * Borra las cookies `sb-*` (que son `HttpOnly`: solo el servidor puede tocarlas) y
 * devuelve una página que además limpia el almacén local del navegador —donde la
 * PWA guarda una segunda copia de la sesión— antes de mandar al login.
 *
 * `dynamic = "force-dynamic"` es imprescindible: sin esto la respuesta podría
 * cachearse y dejar de cerrar sesión.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cerrando sesión…</title>
<style>
  body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;
       font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0a0a0a;color:#fff}
  .c{text-align:center;padding:24px}
  .s{width:34px;height:34px;margin:0 auto 16px;border:3px solid rgba(255,255,255,.25);
     border-top-color:#fff;border-radius:50%;animation:g .8s linear infinite}
  @keyframes g{to{transform:rotate(360deg)}}
  p{margin:0;font-size:15px;opacity:.8}
  a{color:#60a5fa;font-size:14px;display:inline-block;margin-top:18px}
</style>
</head>
<body>
  <div class="c">
    <div class="s"></div>
    <p>Cerrando sesión…</p>
    <a href="/?logout=1">Continuar</a>
  </div>
<script>
  // El servidor ya expiró las cookies HttpOnly. Aquí se remata lo que vive en el
  // propio teléfono: la PWA guarda una copia de la sesión en el almacén local, y
  // sin borrarla la librería la restaura en el siguiente arranque.
  try {
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var k = localStorage.key(i);
      if (k && (k.indexOf('sb-') === 0 || k.indexOf('bh_') === 0)) localStorage.removeItem(k);
    }
    for (var j = sessionStorage.length - 1; j >= 0; j--) {
      var k2 = sessionStorage.key(j);
      if (k2 && (k2.indexOf('sb-') === 0 || k2.indexOf('bh_') === 0)) sessionStorage.removeItem(k2);
    }
  } catch (e) {}

  // Cookies accesibles desde JS (las HttpOnly ya las mató el servidor).
  try {
    var host = location.hostname, partes = host.split('.');
    var doms = ['', '; domain=' + host];
    if (partes.length > 2) doms.push('; domain=.' + partes.slice(-2).join('.'));
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (n.indexOf('sb-') === 0) doms.forEach(function (d) {
        document.cookie = n + '=; path=/; max-age=0; samesite=lax' + d;
      });
    });
  } catch (e) {}

  // Service worker y cachés: si quedara una copia congelada de la app, fuera.
  try {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(function (rs) {
        rs.forEach(function (r) { r.unregister(); });
      });
    }
    if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
  } catch (e) {}

  // Google: cortar la reconexión automática. Sin esto, al volver al login la
  // tarjeta One Tap reconoce la cuenta y vuelve a entrar en el acto — parecía
  // que la sesión "no se cerraba" cuando en realidad se reabría sola.
  try {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  } catch (e) {}

  setTimeout(function () { location.replace('/?logout=1'); }, 400);
</script>
</body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Nunca cachear una salida de emergencia.
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });

  // Cookies de sesión de Supabase: `HttpOnly`, así que SOLO el servidor puede
  // expirarlas. Incluye los trozos `.0`, `.1`… cuando el token es largo.
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-")) {
      response.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    }
  }

  // Cookies de Google Workspace y el reloj de caducidad de 8 h.
  for (const nombre of [
    "g_access_token",
    "g_refresh_token",
    "g_email",
    "g_picture",
    "g_name",
    "g_accounts",
    "g_accounts_meta",
    SESION_INICIO_COOKIE,
    SESION_INICIO_DUENO_COOKIE,
  ]) {
    response.cookies.set(nombre, "", { path: "/", maxAge: 0 });
  }

  // Revocación en Supabase: de cortesía. Si falla o tarda, la sesión ya está
  // muerta por cookies y no puede impedir la salida.
  try {
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
      },
    );
    await Promise.race([
      supabase.auth.signOut().catch(() => null),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  } catch {
    // Ídem: nada puede impedir salir.
  }

  return response;
}
