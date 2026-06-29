import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Etiquetas legibles por tipo de contenido almacenado en `recordings`.
const TIPO_LABELS: Record<string, string> = {
  grabacion: "Grabaciones de pantalla",
  formacion: "Formación",
  marketing: "Marketing",
  onboarding: "Onboarding",
};

// GET — almacenamiento de la empresa del usuario autenticado:
// cuota total (bytes_used / bytes_limit) + desglose por tipo de contenido.
export async function GET() {
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
      return NextResponse.json({ error: "Usuario sin empresa asignada" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Cuota total de la empresa
    const { data: usage } = await admin
      .from("storage_usage_por_empresa")
      .select("bytes_used, bytes_limit")
      .eq("empresa_id", profile.empresa_id)
      .single();

    // Desglose por tipo: sumamos file_size agrupando por `type`.
    const { data: rows } = await admin
      .from("recordings")
      .select("type, file_size")
      .eq("empresa_id", profile.empresa_id);

    const porTipo = new Map<string, { bytes: number; count: number }>();
    for (const r of rows ?? []) {
      const tipo = (r.type as string) || "grabacion";
      const prev = porTipo.get(tipo) ?? { bytes: 0, count: 0 };
      prev.bytes += Number(r.file_size ?? 0);
      prev.count += 1;
      porTipo.set(tipo, prev);
    }

    const desglose = Array.from(porTipo.entries()).map(([tipo, v]) => ({
      tipo,
      label: TIPO_LABELS[tipo] ?? tipo,
      bytes: v.bytes,
      count: v.count,
    }));

    return NextResponse.json({
      bytes_used: Number(usage?.bytes_used ?? 0),
      bytes_limit: Number(usage?.bytes_limit ?? 500 * 1024 ** 3),
      desglose,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al obtener el almacenamiento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
