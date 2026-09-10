import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/features/accesos/lib/crypto";
import { canjearCodigoPorAccesoLargo } from "@/features/marketing/meta-ads/services/meta-oauth";
import {
  META_EMPRESA_COOKIE,
  META_STATE_COOKIE,
} from "@/features/marketing/meta-ads/lib/meta-api";

export const runtime = "nodejs";

/**
 * PRP-087 · Vuelta de "Conectar con Facebook".
 *
 * Aquí se canjea el código por un acceso de larga duración y se guarda CIFRADO
 * en la fila de la empresa que inició la conexión. La empresa se lee de la
 * cookie que dejó la acción de inicio, no de la empresa activa de ahora: entre
 * que se pulsa el botón y se vuelve de Facebook, el usuario puede haber
 * cambiado de empresa en otra pestaña, y el acceso de BACANAL acabaría guardado
 * en HABANA.
 *
 * Al terminar NO queda conectado del todo a propósito: falta elegir cuenta
 * publicitaria, página y tope de gasto. Eso se hace en el diálogo de Ajustes.
 */

const LIMPIAR = { path: "/", maxAge: 0 };
const DESTINO = "/ajustes?tab=integraciones";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const errorFacebook = url.searchParams.get("error");
  const state = url.searchParams.get("state");

  const c = await cookies();
  const stateEsperado = c.get(META_STATE_COOKIE)?.value;
  const empresaId = c.get(META_EMPRESA_COOKIE)?.value;

  const volver = (resultado: string) => {
    const res = NextResponse.redirect(`${origin}${DESTINO}&meta=${resultado}`);
    res.cookies.set(META_STATE_COOKIE, "", LIMPIAR);
    res.cookies.set(META_EMPRESA_COOKIE, "", LIMPIAR);
    return res;
  };

  // El usuario le dio a "Cancelar" en la pantalla de Facebook.
  if (errorFacebook) return volver("cancelado");
  if (!code) return volver("sin_codigo");

  // CSRF: el `state` que devuelve Facebook tiene que ser el que emitimos.
  if (!state || !stateEsperado || state !== stateEsperado) {
    return volver("estado_invalido");
  }
  if (!empresaId) return volver("sin_empresa");

  // La conexión es del usuario que está dentro del software ahora mismo.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return volver("sin_sesion");

  let accessToken: string;
  let expiraAt: string | null;
  try {
    const canje = await canjearCodigoPorAccesoLargo(code);
    accessToken = canje.accessToken;
    expiraAt = canje.expiraAt;
  } catch (err) {
    console.error("[meta/callback] canje fallido:", err);
    return volver("canje_fallido");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("empresa_meta_config").upsert(
    {
      empresa_id: empresaId,
      access_token_cifrado: encrypt(accessToken),
      token_expira_at: expiraAt,
      // Conectado pero todavía sin elegir cuenta ni tope: no puede estar activo.
      activo: false,
      conectado_por: user.id,
      conectado_at: new Date().toISOString(),
    },
    { onConflict: "empresa_id" },
  );

  if (error) {
    console.error("[meta/callback] no se pudo guardar la conexión:", error.message);
    return volver("no_guardado");
  }

  return volver("conectado");
}
