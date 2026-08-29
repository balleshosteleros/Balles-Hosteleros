import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devuelve los departamentos (canónicos) a los que el usuario tiene acceso por
 * su rol — la MISMA fuente que usa el chat y las tareas (bh_departamentos_usuario).
 * La UI de grabación usa esto para: (a) elegir dónde guardar si el usuario
 * pertenece a varios, y (b) las carpetas visibles en "Mis grabaciones".
 *
 * Respuesta: { departamentos: string[] }  (ordenados alfabéticamente)
 */
export async function GET() {
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
      return NextResponse.json({ departamentos: [] });
    }

    // Admin client para poder llamar al helper SECURITY DEFINER con el uid real.
    // bh_departamentos_usuario usa auth.uid() internamente, así que lo invocamos
    // con el cliente de sesión (respeta el uid del usuario).
    const { data, error } = await supabase.rpc("bh_departamentos_usuario", {
      p_empresa: empresaId,
    });

    if (error) {
      console.error("[recordings departamentos] RPC error:", error.message);
      return NextResponse.json({ departamentos: [] });
    }

    const departamentos = Array.isArray(data)
      ? [...new Set(data as string[])].filter(Boolean).sort()
      : [];

    return NextResponse.json({ departamentos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    console.error("[recordings departamentos] Error:", message);
    return NextResponse.json({ departamentos: [] });
  }
}
