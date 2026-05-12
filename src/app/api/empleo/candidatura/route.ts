import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { z } from "zod";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CV_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MIN = 15;
const RATE_LIMIT_MAX = 5;

const CandidaturaSchema = z.object({
  empresa_slug: z.string().min(1).max(80),
  empresa_id: z.string().uuid(),
  oferta_id: z.string().uuid(),
  nombre: z.string().min(1).max(80),
  apellidos: z.string().min(1).max(120),
  email: z.string().email().max(180),
  telefono: z.string().min(5).max(30),
  carta_presentacion: z.string().max(5000).optional().default(""),
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
  const ip = xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

async function checkRateLimit(supabase: ReturnType<typeof service>, ip: string, empresaId: string) {
  const windowAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000).toISOString();

  const { data: existing } = await supabase
    .from("candidaturas_rate_limit")
    .select("count, window_start")
    .eq("ip_hash", ip)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("candidaturas_rate_limit").insert({
      ip_hash: ip,
      empresa_id: empresaId,
      count: 1,
    });
    return { allowed: true };
  }

  if (existing.window_start < windowAgo) {
    await supabase
      .from("candidaturas_rate_limit")
      .update({ count: 1, window_start: new Date().toISOString() })
      .eq("ip_hash", ip)
      .eq("empresa_id", empresaId);
    return { allowed: true };
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return { allowed: false };
  }

  await supabase
    .from("candidaturas_rate_limit")
    .update({ count: existing.count + 1 })
    .eq("ip_hash", ip)
    .eq("empresa_id", empresaId);
  return { allowed: true };
}

async function verifyTurnstile(token: string | null): Promise<boolean> {
  // Si no hay TURNSTILE_SECRET configurado, captcha es opcional (dev/preview).
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json() as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const captchaToken = (fd.get("captcha_token") as string | null) ?? null;
    const cv = fd.get("cv") as File | null;

    const parsed = CandidaturaSchema.safeParse({
      empresa_slug: String(fd.get("empresa_slug") ?? "").trim(),
      empresa_id: String(fd.get("empresa_id") ?? "").trim(),
      oferta_id: String(fd.get("oferta_id") ?? "").trim(),
      nombre: String(fd.get("nombre") ?? "").trim(),
      apellidos: String(fd.get("apellidos") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim().toLowerCase(),
      telefono: String(fd.get("telefono") ?? "").trim(),
      carta_presentacion: String(fd.get("carta_presentacion") ?? "").trim(),
    });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { ok: false, error: `Datos inválidos: ${firstIssue.path.join(".")} — ${firstIssue.message}` },
        { status: 400 },
      );
    }
    const { empresa_slug: empresaSlug, empresa_id: empresaId, oferta_id: ofertaId,
            nombre, apellidos, email, telefono, carta_presentacion: cartaPresentacion } = parsed.data;

    if (cv && cv.size > MAX_CV_BYTES) {
      return NextResponse.json({ ok: false, error: "El CV supera el tamaño máximo de 5MB" }, { status: 400 });
    }
    if (cv && cv.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "El CV debe ser un PDF" }, { status: 400 });
    }

    if (!(await verifyTurnstile(captchaToken))) {
      return NextResponse.json({ ok: false, error: "Captcha no válido" }, { status: 400 });
    }

    const supabase = service();
    const ip = ipHash(req);

    // Rate limit
    const rl = await checkRateLimit(supabase, ip, empresaId);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Demasiadas candidaturas recientes desde tu conexión. Inténtalo más tarde." },
        { status: 429 },
      );
    }

    // Verificar que la oferta existe y es pública
    const { data: vacante, error: vacErr } = await supabase
      .from("vacantes")
      .select("id, empresa_id, puesto_id, departamento_id, estado_publicacion, visible_publicamente")
      .eq("id", ofertaId)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (vacErr || !vacante) {
      return NextResponse.json({ ok: false, error: "Oferta no encontrada" }, { status: 404 });
    }
    if (!vacante.visible_publicamente || vacante.estado_publicacion !== "publicada") {
      return NextResponse.json({ ok: false, error: "Esta oferta no está abierta" }, { status: 410 });
    }

    // Subida del CV (si existe)
    let cvUrl: string | null = null;
    if (cv) {
      const candidatoTempId = crypto.randomUUID();
      const path = `${empresaId}/${candidatoTempId}.pdf`;
      const buffer = Buffer.from(await cv.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from("cvs-candidatos")
        .upload(path, buffer, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (upErr) {
        console.error("[candidatura] cv upload error:", upErr.message);
      } else {
        cvUrl = path;
      }
    }

    // Insertar candidato
    const { data: candidato, error: insErr } = await supabase
      .from("candidatos")
      .insert({
        empresa_id: empresaId,
        vacante_id: vacante.id,
        nombre,
        apellidos,
        email,
        telefono,
        cv_url: cvUrl,
        carta_presentacion: cartaPresentacion || null,
        origen: "web",
        fase: "nuevo",
        estado: "nuevo",
      })
      .select("id")
      .single();

    if (insErr) {
      console.error("[candidatura] insert error:", insErr.message);
      return NextResponse.json({ ok: false, error: "No se pudo registrar la candidatura" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: candidato.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[candidatura] fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
