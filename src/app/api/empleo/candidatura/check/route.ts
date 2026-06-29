import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Comprobación en vivo (mientras el candidato escribe) de si su email o su
// teléfono ya están registrados en una candidatura de ESTA empresa. La regla de
// negocio es one-candidate-per-company: el mismo email o teléfono no puede tener
// dos candidaturas en la misma empresa (en ninguna vacante). El portal lo usa
// para avisar en rojo bajo el campo concreto antes de enviar.

const CheckSchema = z.object({
  empresa_id: z.string().guid(),
  email: z.string().trim().max(180).optional().default(""),
  telefono: z.string().trim().max(30).optional().default(""),
});

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = CheckSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json({ ok: false, emailExiste: false, telefonoExiste: false }, { status: 400 });
    }
    const { empresa_id: empresaId, email, telefono } = parsed.data;

    // Nada que comprobar todavía.
    if (!email && !telefono) {
      return NextResponse.json({ ok: true, emailExiste: false, telefonoExiste: false });
    }

    const supabase = service();
    const { data, error } = await supabase
      .rpc("candidato_duplicado_check", {
        p_empresa_id: empresaId,
        p_email: email || null,
        p_telefono: telefono || null,
      })
      .maybeSingle<{ email_existe: boolean; telefono_existe: boolean }>();

    if (error) {
      console.error("[candidatura/check] rpc error:", error.message);
      // Fallo silencioso: no bloqueamos al candidato por un error de red en el aviso.
      return NextResponse.json({ ok: true, emailExiste: false, telefonoExiste: false });
    }

    return NextResponse.json({
      ok: true,
      emailExiste: !!data?.email_existe,
      telefonoExiste: !!data?.telefono_existe,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[candidatura/check] fatal:", msg);
    return NextResponse.json({ ok: true, emailExiste: false, telefonoExiste: false }, { status: 200 });
  }
}
