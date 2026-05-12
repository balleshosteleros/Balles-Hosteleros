import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  _supabase = createClient(url, key);
  return _supabase;
}

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

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("recordings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching recordings:", error);
      return NextResponse.json({ error: "Error al listar grabaciones", details: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error fetching recordings:", err);
    return NextResponse.json({ error: err?.message || "Error al listar grabaciones" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase();
    const { client: r2Client, bucket: BUCKET_NAME, publicUrl: PUBLIC_URL } = getR2();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Grabación sin título";
    const duration = parseInt(formData.get("duration") as string) || 0;
    const mimeType = (formData.get("mimeType") as string) || "video/webm";

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const fileId = crypto.randomUUID();
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const fileName = `${fileId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: buffer,
          ContentType: mimeType,
        })
      );
    } catch (r2Error: any) {
      console.error("[R2] Error al subir:", r2Error?.message || r2Error);
      throw new Error(`Fallo en R2: ${r2Error?.message}`);
    }

    const videoUrl = `${PUBLIC_URL}/${fileName}`;

    const { data, error } = await supabase
      .from("recordings")
      .insert({
        id: fileId,
        title,
        url: videoUrl,
        duration,
        file_size: buffer.length,
      })
      .select()
      .single();

    if (error) {
      console.error("[Supabase] Error al insertar:", error.message);
      return NextResponse.json({
        message: "Video subido a R2, pero falló el registro en DB",
        url: videoUrl,
        db_error: error.message,
      }, { status: 207 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error("[recordings POST] Error:", err?.message);
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = getSupabase();
    const { id } = await req.json();
    const { data: rec } = await supabase.from("recordings").select("url").eq("id", id).single();

    if (rec) {
      try {
        const { client: r2Client, bucket: BUCKET_NAME } = getR2();
        const fileName = rec.url.split("/").pop();
        if (fileName) {
          await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: fileName }));
        }
      } catch (e) {
        console.warn("Could not delete from R2", e);
      }
    }

    const { error } = await supabase.from("recordings").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al borrar" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = getSupabase();
    const { id, title } = await req.json();
    const { data, error } = await supabase.from("recordings").update({ title }).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al actualizar" }, { status: 500 });
  }
}
