/**
 * Cron: procesa la cola de emails de follow-up de visita.
 *
 * Cada minuto (configurado en vercel.json) lee los pendientes vencidos,
 * los envía vía `sendEmail` (que ya tiene cascada SMTP empresa → depto →
 * Resend de plataforma) y los marca como enviados.
 *
 * Autorización: Bearer ${CRON_SECRET} (mismo patrón que el resto de crons).
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_INTENTOS = 3;
const MAX_POR_TIRADA = 50;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado" },
      { status: 503 },
    );
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: pendientes, error: errSelect } = await supabase
    .from("visita_emails_pendientes")
    .select("id, empresa_id, to_email, asunto, cuerpo_html, intentos")
    .eq("enviado", false)
    .lte("programado_para", new Date().toISOString())
    .lt("intentos", MAX_INTENTOS)
    .order("programado_para", { ascending: true })
    .limit(MAX_POR_TIRADA);

  if (errSelect) {
    return NextResponse.json(
      { ok: false, error: errSelect.message },
      { status: 500 },
    );
  }
  if (!pendientes || pendientes.length === 0) {
    return NextResponse.json({ ok: true, procesados: 0 });
  }

  let enviados = 0;
  let errores = 0;

  for (const row of pendientes) {
    const r = await sendEmail({
      empresaId: row.empresa_id as string,
      to: row.to_email as string,
      subject: row.asunto as string,
      html: row.cuerpo_html as string,
    });

    if (r.ok) {
      await supabase
        .from("visita_emails_pendientes")
        .update({
          enviado: true,
          enviado_at: new Date().toISOString(),
          intentos: (row.intentos as number ?? 0) + 1,
          error: null,
        })
        .eq("id", row.id as string);
      enviados++;
    } else {
      const err =
        "error" in r ? r.error : "Sin transport configurado";
      await supabase
        .from("visita_emails_pendientes")
        .update({
          intentos: (row.intentos as number ?? 0) + 1,
          error: err.slice(0, 500),
        })
        .eq("id", row.id as string);
      errores++;
    }
  }

  return NextResponse.json({
    ok: true,
    procesados: pendientes.length,
    enviados,
    errores,
  });
}
