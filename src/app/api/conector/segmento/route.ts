/**
 * POST /api/conector/segmento — el grabador/cámara sube un clip de vídeo a R2.
 *
 * Arquitectura B (videovigilancia cloud): el vídeo REAL de 30 días vive en
 * NUESTRO Cloudflare R2, no en el grabador. El grabador es solo la tubería:
 * captura clips (segmentos MP4 de ~1 min) y los empuja aquí por conexión de
 * SALIDA. El software rebobina leyendo R2, nunca se conecta al grabador.
 *
 * Autenticación: cabecera `Authorization: Bearer <device_token>` del conector
 * ya emparejado (se compara su hash sha256). Usa service role → no pasa por RLS.
 * El clip se atribuye a la empresa dueña del conector; la cámara debe ser suya.
 *
 * Body: multipart/form-data
 *   - file:      el clip (video/mp4)
 *   - camara_id: uuid de la cámara (debe pertenecer al conector/empresa)
 *   - inicio:    ISO 8601, instante de inicio del clip
 *   - fin:       ISO 8601, instante de fin del clip
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hashDeviceToken } from "@/features/camaras/lib/pairing";
import { putObjectR2, deleteObjectR2 } from "@/shared/lib/r2";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Límite defensivo por clip (100 MB): un segmento de ~1 min cabe de sobra.
const MAX_BYTES = 100 * 1024 * 1024;

const MetaSchema = z.object({
  camara_id: z.string().uuid(),
  inicio: z.string().datetime({ offset: true }),
  fin: z.string().datetime({ offset: true }),
});

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(request: Request) {
  // 1) Autenticación del dispositivo por device_token (Bearer).
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Falta device_token" }, { status: 401 });
  }

  const supabase = service();
  const { data: conector, error: e0 } = await supabase
    .from("conectores")
    .select("id, empresa_id, activo")
    .eq("device_token_hash", hashDeviceToken(token))
    .maybeSingle();

  if (e0) {
    console.error("[conector/segmento] lookup:", e0.message);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
  if (!conector || !conector.activo) {
    return NextResponse.json({ ok: false, error: "Dispositivo no autorizado" }, { status: 401 });
  }

  // 2) Parseo del multipart.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }
  const file = form.get("file");
  const parsed = MetaSchema.safeParse({
    camara_id: form.get("camara_id"),
    inicio: form.get("inicio"),
    fin: form.get("fin"),
  });
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Falta el archivo del clip" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Metadatos inválidos" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Tamaño de clip fuera de rango" }, { status: 413 });
  }

  const { camara_id, inicio, fin } = parsed.data;
  if (new Date(fin).getTime() <= new Date(inicio).getTime()) {
    return NextResponse.json({ ok: false, error: "Rango temporal inválido" }, { status: 400 });
  }

  // 3) La cámara debe pertenecer al conector (y por tanto a la empresa).
  const { data: camara, error: e1 } = await supabase
    .from("camaras")
    .select("id, empresa_id, conector_id")
    .eq("id", camara_id)
    .maybeSingle();
  if (e1) {
    console.error("[conector/segmento] camara:", e1.message);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
  if (!camara || camara.empresa_id !== conector.empresa_id) {
    return NextResponse.json({ ok: false, error: "Cámara no válida" }, { status: 404 });
  }

  // 4) Cuota por empresa (los clips de cámara cuentan como el resto de vídeo).
  const { data: usage } = await supabase
    .from("storage_usage_por_empresa")
    .select("bytes_used, bytes_limit")
    .eq("empresa_id", conector.empresa_id)
    .maybeSingle();
  const bytesUsed = Number(usage?.bytes_used ?? 0);
  const bytesLimit = Number(usage?.bytes_limit ?? 500 * 1024 ** 3);
  if (bytesUsed + file.size > bytesLimit) {
    return NextResponse.json(
      { ok: false, error: "Cuota de almacenamiento agotada para esta empresa" },
      { status: 413 },
    );
  }

  // 5) Subida a R2. Organización por empresa/cámara/día para barrido y borrado.
  const id = crypto.randomUUID();
  const dia = inicio.slice(0, 10); // YYYY-MM-DD
  const r2Key = `empresa_${conector.empresa_id}/camaras/${camara_id}/${dia}/${id}.mp4`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let url: string;
  try {
    url = await putObjectR2(r2Key, buffer, "video/mp4");
  } catch (r2Error) {
    const msg = r2Error instanceof Error ? r2Error.message : String(r2Error);
    console.error("[conector/segmento] R2:", msg);
    return NextResponse.json({ ok: false, error: "Fallo al subir el clip" }, { status: 502 });
  }

  // 6) Registro del metadato + marca de actividad del conector.
  const duracion_seg = Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 1000);
  const { data: row, error: e2 } = await supabase
    .from("camara_grabaciones")
    .insert({
      id,
      empresa_id: conector.empresa_id,
      camara_id,
      conector_id: conector.id,
      r2_key: r2Key,
      url,
      inicio,
      fin,
      duracion_seg,
      file_size: buffer.length,
      mime_type: "video/mp4",
    })
    .select("id")
    .single();

  if (e2) {
    // Rollback en R2 si no pudimos registrar el metadato.
    try { await deleteObjectR2(r2Key); } catch {}
    console.error("[conector/segmento] insert:", e2.message);
    return NextResponse.json({ ok: false, error: "No se pudo registrar el clip" }, { status: 500 });
  }

  // Latido: el grabador está vivo y subiendo → marca online + last_seen_at.
  await supabase
    .from("conectores")
    .update({ estado: "online", last_seen_at: new Date().toISOString() })
    .eq("id", conector.id);

  return NextResponse.json({ ok: true, grabacion_id: row.id }, { status: 201 });
}
