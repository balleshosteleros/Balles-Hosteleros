"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function uploadAvatar(userId: string, formData: FormData): Promise<string> {
  if (!userId) throw new Error("Usuario no identificado.");

  // Verificar que el userId coincide con la sesión real (impide sobrescribir avatares ajenos).
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("No autorizado.");
  if (user.id !== userId) throw new Error("No autorizado para este usuario.");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No se recibió ninguna imagen.");
  if (file.size > MAX_BYTES) throw new Error("La imagen supera 5 MB.");
  if (!ALLOWED.includes(file.type)) throw new Error("Formato no permitido (JPG, PNG o WEBP).");

  const supabase = createAdminClient();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(`Error al subir foto: ${uploadError.message}`);

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: dbError } = await supabase
    .from("usuarios")
    .update({
      avatar_url: publicUrl,
      avatar_obligatorio: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (dbError) throw new Error(`Error al guardar URL: ${dbError.message}`);

  return publicUrl;
}
