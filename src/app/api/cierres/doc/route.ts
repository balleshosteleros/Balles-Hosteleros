import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sirve un documento adjunto de un cierre (bucket privado `cierres-documentos`).
 *
 * Por qué existe: las URLs firmadas caducan (1 h). Si se firmaban al cargar la
 * lista, abrir el adjunto un rato después devolvía `InvalidJWT: "exp" claim
 * timestamp check failed`. Aquí se firma EN EL MOMENTO del clic, así que nunca
 * está caducada.
 *
 * El path es `<empresa_id>/<cierre_id>/<archivo>`; solo lo sirve a usuarios
 * autenticados de la empresa propietaria.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path");
    if (!path) return NextResponse.json({ error: "path requerido" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const empresaId = await getEmpresaActivaForUser(supabase, user.id);
    if (!empresaId) return NextResponse.json({ error: "Sin empresa" }, { status: 403 });

    // El path debe empezar por el empresa_id del usuario.
    if (path.split("/")[0] !== empresaId) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { data: signed, error } = await supabase.storage
      .from("cierres-documentos")
      .createSignedUrl(path, 300);

    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? "No disponible" }, { status: 404 });
    }
    return NextResponse.redirect(signed.signedUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
