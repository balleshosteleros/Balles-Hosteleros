import { NextResponse } from "next/server";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2 } from "@/shared/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
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

    // Onboarding = contenido global de la plataforma (empresa_id null), no
    // aplica a la cuota por empresa. Solo sumamos los vídeos de onboarding
    // contra un límite global propio (100 GB).
    const ONBOARDING_LIMIT_BYTES = 100 * 1024 ** 3;
    const admin = createAdminClient();
    const { data: usageRows } = await admin
      .from("recordings")
      .select("file_size")
      .eq("type", "onboarding");

    const bytesUsed = (usageRows ?? []).reduce(
      (sum, r) => sum + Number(r.file_size ?? 0),
      0
    );

    if (bytesUsed + file.size > ONBOARDING_LIMIT_BYTES) {
      const usedGb = (bytesUsed / 1024 ** 3).toFixed(2);
      const limitGb = (ONBOARDING_LIMIT_BYTES / 1024 ** 3).toFixed(1);
      return NextResponse.json(
        {
          error: "Límite de almacenamiento de vídeos de onboarding alcanzado",
          detail: `Uso actual ${usedGb} GB / ${limitGb} GB. Borra vídeos antiguos o contacta soporte para ampliar.`,
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
    } catch (r2Error) {
      const r2Msg = r2Error instanceof Error ? r2Error.message : String(r2Error);
      console.error("[R2 onboarding] Error al subir:", r2Msg);
      throw new Error(`Fallo en R2: ${r2Msg}`);
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    console.error("[onboarding-videos POST] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al borrar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
