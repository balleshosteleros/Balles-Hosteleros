import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
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

    // La empresa la manda el selector (cookie), no la de origen del usuario:
    // si no, el almacenamiento de una empresa se vería desde otra.
    const empresaId = await getEmpresaActivaForUser(supabase, user.id);

    if (!empresaId) {
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
    const departamentoIn: string =
      typeof body?.departamento === "string" ? body.departamento.trim() : "";

    if (!fileSize || fileSize <= 0) {
      return NextResponse.json(
        { error: "Tamaño de archivo requerido" },
        { status: 400 },
      );
    }

    // Departamento destino: debe ser uno al que el usuario tiene acceso.
    // bh_departamentos_usuario devuelve ya la lista canónica (misma fuente que
    // el chat/tareas), así que validamos contra ella.
    const { data: depsData } = await supabase.rpc("bh_departamentos_usuario", {
      p_empresa: empresaId,
    });
    const misDeptos: string[] = Array.isArray(depsData)
      ? [...new Set((depsData as string[]).filter(Boolean))]
      : [];

    let departamento = "";
    if (departamentoIn) {
      // Coincidencia case-insensitive contra los departamentos accesibles.
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
      // Pertenece a un solo departamento: se asigna automáticamente.
      departamento = misDeptos[0];
    } else if (misDeptos.length > 1) {
      // Varios departamentos y no eligió: la UI debe preguntar.
      return NextResponse.json(
        { error: "Debes elegir un departamento", needsDepartamento: true },
        { status: 422 },
      );
    }
    // Si misDeptos.length === 0 (ej. usuario sin depto/rol reconocido),
    // departamento queda "" → solo lo verá admin/dueño (RLS lo maneja).

    // Cuota POR EMPRESA (default 500 GB). Misma lógica que el registro final.
    const admin = createAdminClient();
    const { data: usage } = await admin
      .from("storage_usage_por_empresa")
      .select("bytes_used, bytes_limit")
      .eq("empresa_id", empresaId)
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
    // Carpeta física por departamento dentro de la empresa. Sanitizamos el
    // nombre para el path (solo se usa como carpeta; la fuente de verdad para
    // permisos es la columna `departamento` de la BD).
    const carpeta = departamento
      ? departamento.replace(/[^A-Za-z0-9._-]/g, "_")
      : "_sin_departamento";
    const r2Key = `empresa_${empresaId}/grabaciones/${carpeta}/${fileId}.${ext}`;

    const uploadUrl = presignPutR2(r2Key, mimeType);

    return NextResponse.json({ uploadUrl, r2Key, fileId, mimeType, departamento });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al firmar la subida";
    console.error("[recordings presign] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
