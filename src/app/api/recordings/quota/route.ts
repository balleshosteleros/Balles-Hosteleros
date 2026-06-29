import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — cuota de almacenamiento de la empresa del usuario autenticado.
// Devuelve bytes_used / bytes_limit de `storage_usage_por_empresa`.
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
    const { data: usage } = await admin
      .from("storage_usage_por_empresa")
      .select("bytes_used, bytes_limit")
      .eq("empresa_id", profile.empresa_id)
      .single();

    return NextResponse.json({
      bytes_used: Number(usage?.bytes_used ?? 0),
      bytes_limit: Number(usage?.bytes_limit ?? 500 * 1024 ** 3),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al obtener la cuota";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
