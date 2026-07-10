import { NextResponse } from "next/server";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2 } from "@/shared/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("recordings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching recordings:", error);
      return NextResponse.json({ error: "Error al listar grabaciones", details: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching recordings:", err);
    const message = err instanceof Error ? err.message : "Error al listar grabaciones";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

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
    const title = (formData.get("title") as string) || "Grabación sin título";
    const duration = parseInt(formData.get("duration") as string) || 0;
    const mimeType = (formData.get("mimeType") as string) || "video/webm";

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    // Cuota POR EMPRESA: cada empresa tiene su propio límite (default 500 GB).
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
          detail: `Uso actual ${usedGb} GB / ${limitGb} GB. Borra grabaciones antiguas o amplía tu plan para subir más.`,
        },
        { status: 413 }
      );
    }

    const { client: r2Client, bucket: BUCKET_NAME, publicUrl: PUBLIC_URL } = getR2();
    const fileId = crypto.randomUUID();
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const r2Key = `empresa_${profile.empresa_id}/grabaciones/${fileId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: r2Key,
          Body: buffer,
          ContentType: mimeType,
        })
      );
    } catch (r2Error) {
      const r2Msg = r2Error instanceof Error ? r2Error.message : String(r2Error);
      console.error("[R2] Error al subir:", r2Msg);
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
        empresa_id: profile.empresa_id,
        owner_user_id: user.id,
        type: "grabacion",
      })
      .select()
      .single();

    if (error) {
      // Rollback: si falló el insert, borramos el objeto recién subido a R2.
      try {
        await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: r2Key }));
      } catch {}
      console.error("[Supabase] Error al insertar:", error.message);
      return NextResponse.json(
        { error: "No se pudo registrar la grabación", db_error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    console.error("[recordings POST] Error:", message);
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
      .select("r2_key, url")
      .eq("id", id)
      .single();

    if (rec) {
      const key = rec.r2_key || rec.url?.split("/").slice(-1)[0];
      if (key) {
        try {
          const { client: r2Client, bucket: BUCKET_NAME } = getR2();
          await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        } catch (e) {
          console.warn("Could not delete from R2", e);
        }
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

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerClient();
    const { id, title } = await req.json();
    const { data, error } = await supabase
      .from("recordings")
      .update({ title })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
