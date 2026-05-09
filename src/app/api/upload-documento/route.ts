import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json({ ok: false, error: "No se recibió ningún archivo" });
    }

    const admin = createAdminClient();

    // Crear bucket si no existe
    await admin.storage.createBucket("documentos", { public: true }).catch(() => {});

    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}_${safeName}`;

    const bytes = await file.arrayBuffer();
    const { error } = await admin.storage
      .from("documentos")
      .upload(path, bytes, { contentType: file.type, upsert: false });

    if (error) return NextResponse.json({ ok: false, error: error.message });

    const { data } = admin.storage.from("documentos").getPublicUrl(path);
    return NextResponse.json({ ok: true, url: data.publicUrl, nombre: file.name, ext });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ ok: false, error: msg });
  }
}
