import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sirve un CV almacenado en el bucket privado `cvs-candidatos`.
 * Solo accesible por usuarios autenticados de la empresa propietaria del candidato.
 * El path es `<empresa_id>/<id>.pdf`.
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

    // El path debe empezar por el empresa_id del usuario
    const empresaIdEnPath = path.split("/")[0];
    if (empresaIdEnPath !== empresaId) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    // Generar signed URL temporal (5 minutos)
    const { data: signed, error } = await supabase.storage
      .from("cvs-candidatos")
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
