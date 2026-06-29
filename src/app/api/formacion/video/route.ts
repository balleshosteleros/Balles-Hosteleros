import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let _r2: S3Client | null = null;
function getR2(): { client: S3Client; bucket: string; publicUrl: string } {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!bucket || !publicUrl || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan variables R2_* para configurar Cloudflare R2");
  }
  if (!_r2) {
    _r2 = new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
  }
  return { client: _r2, bucket, publicUrl };
}

// POST — sube un vídeo de formación a R2 (empresa_<id>/formacion/<uuid>.<ext>),
// lo registra en `recordings` con type='formacion' (para que cuente en la cuota
// por empresa) y devuelve la URL pública para guardarla en la lección.
export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: profile } = await supabase
      .from("usuarios")
      .select("empresa_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.empresa_id) {
      return NextResponse.json({ error: "Usuario sin empresa asignada" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Vídeo de formación";
    const duration = parseInt(formData.get("duration") as string) || 0;
    const mimeType = (formData.get("mimeType") as string) || "video/mp4";
    if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

    // Cuota POR EMPRESA (default 500 GB).
    const admin = createAdminClient();
    const { data: usage } = await admin
      .from("storage_usage_por_empresa")
      .select("bytes_used, bytes_limit")
      .eq("empresa_id", profile.empresa_id)
      .single();
    const bytesUsed = Number(usage?.bytes_used ?? 0);
    const bytesLimit = Number(usage?.bytes_limit ?? 500 * 1024 ** 3);
    if (bytesUsed + file.size > bytesLimit) {
      const usedGb = (bytesUsed / 1024 ** 3).toFixed(2);
      const limitGb = (bytesLimit / 1024 ** 3).toFixed(1);
      return NextResponse.json(
        {
          error: "Has alcanzado el límite de almacenamiento de tu plan",
          detail: `Uso actual ${usedGb} GB / ${limitGb} GB. Borra vídeos antiguos o amplía tu plan.`,
        },
        { status: 413 },
      );
    }

    const { client: r2Client, bucket: BUCKET_NAME, publicUrl: PUBLIC_URL } = getR2();
    const fileId = crypto.randomUUID();
    const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("quicktime") ? "mov" : "mp4";
    const r2Key = `empresa_${profile.empresa_id}/formacion/${fileId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: r2Key,
          Body: buffer,
          ContentType: mimeType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    } catch (r2Error) {
      const r2Msg = r2Error instanceof Error ? r2Error.message : String(r2Error);
      console.error("[R2 formacion] Error al subir:", r2Msg);
      throw new Error(`Fallo en R2: ${r2Msg}`);
    }

    const videoUrl = `${PUBLIC_URL}/${r2Key}`;

    // Registrar en `recordings` con type='formacion' para que cuente en la cuota.
    const { error } = await supabase.from("recordings").insert({
      id: fileId,
      title,
      url: videoUrl,
      r2_key: r2Key,
      duration,
      file_size: buffer.length,
      empresa_id: profile.empresa_id,
      owner_user_id: user.id,
      type: "formacion",
    });
    if (error) {
      try {
        await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: r2Key }));
      } catch {}
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ url: videoUrl, r2_key: r2Key, duration }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    console.error("[formacion/video POST] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
