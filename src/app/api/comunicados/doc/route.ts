import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_COMUNICADOS } from "@/features/gerencia/data/comunicados-adjuntos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sirve un documento adjunto de un comunicado (bucket privado).
 *
 * Se firma EN EL MOMENTO del clic, no al pintar la lista: las URLs firmadas
 * caducan, y un comunicado se lee días después de recibirlo (o desde el enlace
 * del correo, semanas más tarde). Firmando al abrirlo, el enlace nunca está
 * caducado.
 *
 * El path empieza SIEMPRE por el id de la empresa dueña del documento. Quién
 * puede leerlo lo decide la RLS del bucket (las empresas del usuario), no la
 * empresa que tenga activa: quien trabaja en dos y abre el enlace del correo
 * de una mientras tiene puesta la otra debe poder abrirlo igual.
 */
export async function GET(req: Request) {
  try {
    const path = new URL(req.url).searchParams.get("path");
    if (!path) return NextResponse.json({ error: "path requerido" }, { status: 400 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: signed, error } = await supabase.storage
      .from(BUCKET_COMUNICADOS)
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
