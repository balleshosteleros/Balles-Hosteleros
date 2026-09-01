import { NextResponse } from "next/server";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2 } from "@/shared/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // El listado sigue al selector de empresa: la RLS no aísla la empresa
    // activa, así que sin este filtro se verían grabaciones de otra sociedad.
    const empresaId = await getEmpresaActivaForUser(supabase, user.id);
    if (!empresaId) return NextResponse.json([]);

    const { data, error } = await supabase
      .from("recordings")
      .select("*")
      .eq("empresa_id", empresaId)
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

    // La empresa la manda el selector (cookie), no la de origen del usuario:
    // si no, el almacenamiento de una empresa se vería desde otra.
    const empresaId = await getEmpresaActivaForUser(supabase, user.id);

    if (!empresaId) {
      return NextResponse.json({ error: "Usuario sin empresa asignada" }, { status: 403 });
    }

    // ── Camino nuevo: subida directa a R2 ya completada ──────────────────
    // El navegador subió el vídeo con la URL firmada (/api/recordings/presign)
    // y ahora solo registra la fila. Body diminuto (JSON), sin límite de tamaño.
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      const r2Key = typeof body?.r2Key === "string" ? body.r2Key : "";
      if (!r2Key) {
        return NextResponse.json({ error: "r2Key requerido" }, { status: 400 });
      }
      // El key debe pertenecer a la empresa del usuario (evita registrar objetos ajenos).
      if (!r2Key.startsWith(`empresa_${empresaId}/`)) {
        return NextResponse.json({ error: "Clave de objeto inválida" }, { status: 403 });
      }

      const title = typeof body?.title === "string" && body.title ? body.title : "Grabación sin título";
      const duration = Number(body?.duration) || 0;
      const fileSize = Number(body?.fileSize) || 0;
      const fileId = typeof body?.fileId === "string" && body.fileId ? body.fileId : crypto.randomUUID();

      // Departamento (canónico) que el navegador recibió del presign, validado
      // de nuevo contra los accesos reales del usuario. Fuente para permisos.
      const departamentoIn = typeof body?.departamento === "string" ? body.departamento.trim() : "";
      let departamento: string | null = null;
      if (departamentoIn) {
        const { data: depsData } = await supabase.rpc("bh_departamentos_usuario", {
          p_empresa: empresaId,
        });
        const misDeptos: string[] = Array.isArray(depsData) ? (depsData as string[]) : [];
        const match = misDeptos.find((d) => d.toUpperCase() === departamentoIn.toUpperCase());
        departamento = match ?? null;
      }

      const { publicUrl: PUBLIC_URL } = getR2();
      const videoUrl = `${PUBLIC_URL}/${r2Key}`;

      const { data, error } = await supabase
        .from("recordings")
        .insert({
          id: fileId,
          title,
          url: videoUrl,
          r2_key: r2Key,
          duration,
          file_size: fileSize,
          empresa_id: empresaId,
          owner_user_id: user.id,
          type: "grabacion",
          departamento,
        })
        .select()
        .single();

      if (error) {
        console.error("[Supabase] Error al insertar (directo):", error.message);
        return NextResponse.json(
          { error: "No se pudo registrar la grabación", db_error: error.message },
          { status: 500 },
        );
      }
      return NextResponse.json(data, { status: 201 });
    }

    // ── Camino legado: FormData (archivo por el servidor) ────────────────
    // Se mantiene como fallback. Sujeto al límite de body de Vercel (~4.5 MB),
    // por eso la ruta preferida es la subida directa de arriba.
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "Grabación sin título";
    const duration = parseInt(formData.get("duration") as string) || 0;
    const mimeType = (formData.get("mimeType") as string) || "video/webm";
    const departamentoIn = ((formData.get("departamento") as string) || "").trim();

    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    // Departamento destino, validado contra los accesibles por el usuario. Sin
    // esto, una grabación que cayera por este camino quedaba sin departamento y
    // no la veía nadie salvo admin, aunque el usuario sí lo hubiera elegido.
    const { data: depsData } = await supabase.rpc("bh_departamentos_usuario", {
      p_empresa: empresaId,
    });
    const misDeptos: string[] = Array.isArray(depsData)
      ? [...new Set((depsData as string[]).filter(Boolean))]
      : [];

    let departamento = "";
    if (departamentoIn) {
      const match = misDeptos.find(
        (d) => d.toUpperCase() === departamentoIn.toUpperCase(),
      );
      if (!match) {
        return NextResponse.json(
          { error: "No tienes acceso a ese departamento" },
          { status: 403 },
        );
      }
      departamento = match;
    } else if (misDeptos.length === 1) {
      departamento = misDeptos[0];
    } else if (misDeptos.length > 1) {
      return NextResponse.json(
        { error: "Debes elegir un departamento", needsDepartamento: true },
        { status: 422 },
      );
    }

    // Cuota POR EMPRESA: cada empresa tiene su propio límite (default 500 GB).
    const admin = createAdminClient();
    const { data: usage } = await admin
      .from("storage_usage_por_empresa")
      .select("bytes_used, bytes_limit")
      .eq("empresa_id", empresaId)
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
    // Misma carpeta física por departamento que la subida directa.
    const carpeta = departamento
      ? departamento.replace(/[^A-Za-z0-9._-]/g, "_")
      : "_sin_departamento";
    const r2Key = `empresa_${empresaId}/grabaciones/${carpeta}/${fileId}.${ext}`;
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
        empresa_id: empresaId,
        owner_user_id: user.id,
        type: "grabacion",
        departamento: departamento || null,
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
