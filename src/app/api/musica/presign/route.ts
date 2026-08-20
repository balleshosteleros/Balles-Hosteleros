import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { presignPutR2 } from "@/shared/lib/r2";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paso 1 de la subida de una canción: valida permiso, formato y cuota, y
 * devuelve una URL PUT firmada para que el navegador suba el MP3 DIRECTAMENTE a
 * R2. El archivo nunca pasa por esta función (body diminuto: solo metadatos),
 * así que no aplica el límite de ~4.5 MB del body en Vercel.
 *
 * La música tiene su propio tope (5 GB por defecto ≈ 85 horas) DENTRO de los
 * 500 GB de la empresa: sin él, subir discografías enteras se comería el
 * almacenamiento de grabaciones y documentos.
 */

// Formatos de audio aceptados. Se valida el MIME que declara el navegador y la
// extensión: no queremos que por aquí entren vídeos ni ejecutables.
const MIME_PERMITIDOS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
  "audio/webm": "weba",
};

// Tope por archivo. Una canción normal en MP3 320 kbps ronda los 10 MB; 50 MB
// deja margen de sobra para WAV/FLAC sin permitir subir un disco entero como
// un único archivo.
const MAX_BYTES_CANCION = 50 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) {
      return NextResponse.json(
        { error: "Usuario sin empresa asignada" },
        { status: 403 },
      );
    }

    // Subir canciones es GESTIÓN: requiere el permiso MÚSICA de Ajustes → Roles.
    const { esDirector, permisos } = await getRolContext(user.id);
    if (!puedeEditarModulo(permisos, "MÚSICA")) {
      return NextResponse.json(
        { error: "Tu rol no puede añadir canciones" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const fileSize = Number(body?.fileSize ?? 0);
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
    const nombreArchivo =
      typeof body?.nombreArchivo === "string" ? body.nombreArchivo : "";

    if (!fileSize || fileSize <= 0) {
      return NextResponse.json(
        { error: "Tamaño de archivo requerido" },
        { status: 400 },
      );
    }

    const ext = MIME_PERMITIDOS[mimeType.toLowerCase()];
    if (!ext) {
      return NextResponse.json(
        { error: "Formato no admitido. Sube archivos de audio (MP3, M4A, WAV…)." },
        { status: 415 },
      );
    }

    if (fileSize > MAX_BYTES_CANCION) {
      const mb = (fileSize / 1024 ** 2).toFixed(0);
      return NextResponse.json(
        { error: `«${nombreArchivo || "El archivo"}» ocupa ${mb} MB. El máximo por canción es 50 MB.` },
        { status: 413 },
      );
    }

    // Cuota de MÚSICA de la empresa. La vista ya trae el tope efectivo
    // (5 GB por defecto) y lo consumido por las canciones activas.
    const { data: uso } = await supabase
      .from("musica_uso_por_empresa")
      .select("bytes_used, bytes_limit")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    const bytesUsed = Number(uso?.bytes_used ?? 0);
    const bytesLimit = Number(uso?.bytes_limit ?? 5 * 1024 ** 3);

    if (bytesUsed + fileSize > bytesLimit) {
      const usadoGb = (bytesUsed / 1024 ** 3).toFixed(2);
      const limiteGb = (bytesLimit / 1024 ** 3).toFixed(1);
      return NextResponse.json(
        {
          error: `Se ha alcanzado el límite de música (${usadoGb} GB de ${limiteGb} GB). Borra canciones que ya no uséis o amplía el tope en Configuración.`,
          quotaExceeded: true,
        },
        { status: 413 },
      );
    }

    // Key determinista por empresa: mismo esquema que las grabaciones, para que
    // el consumo por empresa siga siendo legible en el bucket.
    const fileId = crypto.randomUUID();
    const r2Key = `empresa_${empresaId}/musica/${fileId}.${ext}`;
    const uploadUrl = presignPutR2(r2Key, mimeType);

    return NextResponse.json({ uploadUrl, r2Key, fileId, mimeType });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[musica] presign:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
