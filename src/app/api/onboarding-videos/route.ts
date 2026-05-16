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
    _r2 = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return { client: _r2, bucket, publicUrl };
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// GET — lista todos los videos de onboarding (visibles para cualquier autenticado vía RLS).
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("recordings")
      .select("*")
      .eq("type", "onboarding")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}

// POST — sube un video de onboarding. Solo admin/director (RLS lo refuerza).
export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Video de onboarding";
    const categoria = (formData.get("categoria") as string) || "general";
    const duration = parseInt(formData.get("duration") as string) || 0;
    const mimeType = (formData.get("mimeType") as string) || "video/mp4";

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    // Cuota global compartida con grabaciones.
    const admin = createAdminClient();
    const { data: usage } = await admin
      .from("storage_usage_global")
      .select("bytes_used, bytes_limit")
      .single();

    const bytesUsed = Number(usage?.bytes_used ?? 0);
    const bytesLimit = Number(usage?.bytes_limit ?? 9.5 * 1024 ** 3);

    if (bytesUsed + file.size > bytesLimit) {
      const usedGb = (bytesUsed / 1024 ** 3).toFixed(2);
      const limitGb = (bytesLimit / 1024 ** 3).toFixed(1);
      return NextResponse.json(
        {
          error: "Límite de almacenamiento de fase beta alcanzado",
          detail: `Uso actual ${usedGb} GB / ${limitGb} GB.`,
        },
        { status: 413 }
      );
    }

    const { client: r2Client, bucket: BUCKET_NAME, publicUrl: PUBLIC_URL } = getR2();
    const fileId = crypto.randomUUID();
    const ext = mimeType.includes("webm") ? "webm" : "mp4";
    const r2Key = `onboarding/${slugify(categoria)}/${slugify(title)}-${fileId.slice(0, 8)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: r2Key,
          Body: buffer,
          ContentType: mimeType,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
    } catch (r2Error: any) {
      console.error("[R2 onboarding] Error al subir:", r2Error?.message || r2Error);
      throw new Error(`Fallo en R2: ${r2Error?.message}`);
    }

    const videoUrl = `${PUBLIC_URL}/${r2Key}`;

    const { data, error } = await supabase
      .from("recordings")
      .insert({
        id: fileId,
        title,
        url: videoUrl,
        r2_key: r2Key,
        duration,
        file_size: buffer.length,
        empresa_id: null,
        owner_user_id: user.id,
        type: "onboarding",
      })
      .select()
      .single();

    if (error) {
      try {
        await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: r2Key }));
      } catch {}
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error("[onboarding-videos POST] Error:", err?.message);
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await req.json();
    const { data: rec } = await supabase
      .from("recordings")
      .select("r2_key, type")
      .eq("id", id)
      .single();

    if (rec?.type !== "onboarding") {
      return NextResponse.json({ error: "Solo borra videos de onboarding" }, { status: 400 });
    }

    if (rec?.r2_key) {
      try {
        const { client: r2Client, bucket: BUCKET_NAME } = getR2();
        await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: rec.r2_key }));
      } catch (e) {
        console.warn("Could not delete onboarding from R2", e);
      }
    }

    const { error } = await supabase.from("recordings").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al borrar" }, { status: 500 });
  }
}
