/**
 * Subida de la foto de perfil del usuario.
 *
 * Route handler (POST /api/avatar) en lugar de Server Action a propósito: los
 * Server Actions dejan de resolver cuando el JS del cliente queda desfasado del
 * servidor (típico tras auto-actualizar la PWA), y Next devuelve el críptico
 * "An unexpected response was received from the server". Un route handler normal
 * no depende del action-id, así que sobrevive a esos desfases.
 *
 * Seguridad: comprueba la sesión real por cookie y solo permite escribir el
 * avatar del propio usuario. La subida al bucket se hace con service-role.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  try {
    // Sesión real por cookie: solo puedes cambiar TU propia foto.
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No se recibió ninguna imagen." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "La imagen supera 5 MB." }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido (JPG, PNG o WEBP)." },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      return NextResponse.json(
        { error: `Error al subir foto: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error: dbError } = await supabase
      .from("usuarios")
      .update({
        avatar_url: publicUrl,
        avatar_obligatorio: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    if (dbError) {
      return NextResponse.json(
        { error: `Error al guardar la foto: ${dbError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: publicUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado al subir la foto.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
