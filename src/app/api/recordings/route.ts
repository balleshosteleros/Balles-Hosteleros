import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

console.log("R2 Configuration Initialized:", {
  endpoint: process.env.R2_ENDPOINT,
  bucket: BUCKET_NAME,
  hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
  hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY
});

export async function GET() {
  try {
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
    return NextResponse.json({ error: "Error al listar grabaciones" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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

    console.log(">>> [R2] Iniciando subida de:", fileName, "al bucket:", BUCKET_NAME);
    
    // 1. Subir a Cloudflare R2
    try {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileName,
          Body: buffer,
          ContentType: mimeType,
        })
      );
      console.log(">>> [R2] ¡ÉXITO! Archivo subido correctamente.");
    } catch (r2Error: any) {
      console.error(">>> [R2] ERROR al subir:", r2Error.message || r2Error);
      throw new Error(`Fallo en R2: ${r2Error.message}`);
    }

    const videoUrl = `${PUBLIC_URL}/${fileName}`;

    console.log(">>> [Supabase] Registrando metadatos...");
    // 2. Guardar en Supabase
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
      console.error(">>> [Supabase] ERROR al insertar:", error.message);
      // Nota: El archivo ya está en R2, pero el registro falló.
      return NextResponse.json({ 
        message: "Video subido a R2, pero falló el registro en DB",
        url: videoUrl,
        db_error: error.message 
      }, { status: 207 }); // 207 Multi-Status para indicar éxito parcial
    }

    console.log(">>> [DONE] Todo guardado correctamente.");
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error(">>> [CRITICAL] Error en POST:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    const { data: rec } = await supabase.from("recordings").select("url").eq("id", id).single();
    
    if (rec) {
      const fileName = rec.url.split("/").pop();
      if (fileName) {
        try {
          await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: fileName }));
        } catch (e) {
          console.warn("Could not delete from R2", e);
        }
      }
    }

    const { error } = await supabase.from("recordings").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error al borrar" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, title } = await req.json();
    const { data, error } = await supabase.from("recordings").update({ title }).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}
