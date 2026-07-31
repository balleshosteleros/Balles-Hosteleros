import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { presignPutR2 } from "@/shared/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paso 1 de la subida directa: valida usuario, empresa y cuota, y devuelve una
 * URL PUT firmada para que el navegador suba el vídeo DIRECTAMENTE a R2.
 *
 * El archivo NUNCA pasa por esta función (body diminuto: solo metadatos), por
 * lo que no aplica el límite de ~4.5 MB del body en Vercel que hacía fallar las
 * grabaciones grandes aunque hubiera conexión.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("usuarios")
      .select("empresa_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.empresa_id) {
      return NextResponse.json(
        { error: "Usuario sin empresa asignada" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const fileSize = Number(body?.fileSize ?? 0);
    const mimeType: string =
      typeof body?.mimeType === "string" && body.mimeType
        ? body.mimeType
        : "video/webm";

    if (!fileSize || fileSize <= 0) {
      return NextResponse.json(
        { error: "Tamaño de archivo requerido" },
        { status: 400 },
      );
    }

    // Cuota POR EMPRESA (default 500 GB). Misma lógica que el registro final.
    const admin = createAdminClient();
    const { data: usage } = await admin
      .from("storage_usage_por_empresa")
      .select("bytes_used, bytes_limit")
      .eq("empresa_id", profile.empresa_id)
      .single();

    const bytesUsed = Number(usage?.bytes_used ?? 0);
    const bytesLimit = Number(usage?.bytes_limit ?? 500 * 1024 ** 3);

    if (bytesUsed + fileSize > bytesLimit) {
      const usedGb = (bytesUsed / 1024 ** 3).toFixed(2);
      const limitGb = (bytesLimit / 1024 ** 3).toFixed(1);
      return NextResponse.json(
        {
          error: "Has alcanzado el límite de almacenamiento de tu plan",
          detail: `Uso actual ${usedGb} GB / ${limitGb} GB. Borra grabaciones antiguas o amplía tu plan para subir más.`,
        },
        { status: 413 },
      );
    }

    const fileId = crypto.randomUUID();
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const r2Key = `empresa_${profile.empresa_id}/grabaciones/${fileId}.${ext}`;

    const uploadUrl = presignPutR2(r2Key, mimeType);

    return NextResponse.json({ uploadUrl, r2Key, fileId, mimeType });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al firmar la subida";
    console.error("[recordings presign] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
