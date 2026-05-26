/**
 * POST /api/visita/lead — captura de lead desde la landing /v/[slug].
 *
 * Público (sin auth). Valida payload con Zod, hace rate-limit suave por
 * IP-hash, inserta el lead con un `resena_token` único, y programa el
 * email follow-up en `visita_emails_pendientes` con el delay configurado
 * por la empresa (default 2h).
 *
 * Devuelve { ok: true } siempre que no haya error técnico. No detalla si
 * el email/teléfono ya existía: tratamos cada captura como nueva visita.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import crypto from "node:crypto";
import { generarEmailVisita } from "@/lib/visita/email-template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_MIN = 15;

const Schema = z.object({
  empresa_id: z.string().uuid(),
  empresa_slug: z.string().min(1).max(80),
  nombre: z.string().trim().min(1).max(80),
  email: z.string().email().max(180).nullable().optional(),
  telefono: z.string().trim().min(5).max(30).nullable().optional(),
  consentimiento: z.boolean(),
});

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function ipHash(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip =
    xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function baseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "https://demo.balleshosteleros.com";
}

async function rateLimited(
  supabase: ReturnType<typeof service>,
  ip: string,
): Promise<boolean> {
  const desde = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60_000).toISOString();
  const { count } = await supabase
    .from("visita_leads")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ip)
    .gte("created_at", desde);
  return (count ?? 0) >= RATE_LIMIT_MAX;
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const input = parsed.data;
  if (!input.consentimiento) {
    return NextResponse.json(
      { ok: false, error: "Falta el consentimiento" },
      { status: 400 },
    );
  }
  if (!input.email && !input.telefono) {
    return NextResponse.json(
      { ok: false, error: "Email o teléfono requerido" },
      { status: 400 },
    );
  }

  const supabase = service();
  const ip = ipHash(req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  if (await rateLimited(supabase, ip)) {
    return NextResponse.json(
      { ok: false, error: "Demasiados envíos, vuelve a intentarlo en unos minutos" },
      { status: 429 },
    );
  }

  // Resolver empresa por slug y validar coincidencia con empresa_id.
  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nombre, logo_url, color")
    .eq("id", input.empresa_id)
    .eq("carta_slug", input.empresa_slug)
    .maybeSingle();
  if (!empresa) {
    return NextResponse.json(
      { ok: false, error: "Empresa no encontrada" },
      { status: 404 },
    );
  }

  // Config para resolver el delay y el contenido del email.
  const { data: cfg } = await supabase
    .from("visita_config")
    .select("activado, email_asunto, email_cuerpo, email_delay_minutos")
    .eq("empresa_id", empresa.id)
    .maybeSingle();
  if (!cfg?.activado) {
    return NextResponse.json(
      { ok: false, error: "Landing no activa" },
      { status: 403 },
    );
  }

  // Crear lead con resena_token único.
  const resenaToken = crypto.randomBytes(18).toString("base64url");
  const { data: lead, error: errLead } = await supabase
    .from("visita_leads")
    .insert({
      empresa_id: empresa.id,
      nombre: input.nombre,
      email: input.email ?? null,
      telefono: input.telefono ?? null,
      consentimiento: input.consentimiento,
      resena_token: resenaToken,
      source: "carta_qr",
      ip_hash: ip,
      user_agent: userAgent,
    })
    .select("id")
    .single<{ id: string }>();
  if (errLead || !lead) {
    return NextResponse.json(
      { ok: false, error: errLead?.message ?? "No se pudo guardar" },
      { status: 500 },
    );
  }

  // Programar email follow-up si hay email del cliente.
  if (input.email) {
    const { asunto, html } = generarEmailVisita({
      nombreLead: input.nombre,
      nombreEmpresa: empresa.nombre as string,
      logoUrl: (empresa.logo_url as string | null) ?? null,
      colorPrimario: (empresa.color as string | null) ?? null,
      asunto: (cfg.email_asunto as string),
      cuerpo: (cfg.email_cuerpo as string),
      baseUrl: baseUrl(req),
      resenaToken,
    });

    const programadoPara = new Date(
      Date.now() + ((cfg.email_delay_minutos as number) ?? 120) * 60_000,
    ).toISOString();

    await supabase.from("visita_emails_pendientes").insert({
      empresa_id: empresa.id,
      lead_id: lead.id,
      to_email: input.email,
      asunto,
      cuerpo_html: html,
      programado_para: programadoPara,
    });
  }

  return NextResponse.json({ ok: true });
}
