/**
 * POST /api/pagina-web/leads — captura de lead desde formulario público.
 * - Valida Zod
 * - Rate limit por ip_hash (30s)
 * - Guarda referrer/utm, hashea ip, trunca UA
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertarLead, verificarRateLimit } from "@/features/marketing/pagina-web/actions/leads-actions";
import { extraerIp, ipHash, truncarUserAgent } from "@/features/marketing/pagina-web/services/ip-hash";

export const runtime = "nodejs";

const bodySchema = z.object({
  empresaId: z.string().uuid(),
  paginaId: z.string().uuid().optional(),
  bloqueId: z.string().max(128).optional(),
  payload: z.record(z.string(), z.unknown()),
  utm: z
    .object({
      source: z.string().max(80).optional(),
      medium: z.string().max(80).optional(),
      campaign: z.string().max(80).optional(),
    })
    .nullable()
    .optional(),
  referrer: z.string().max(500).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Datos inválidos" },
        { status: 400 },
      );
    }
    const ip = extraerIp(req.headers);
    const ipH = ipHash(ip);

    if (ipH) {
      const pasa = await verificarRateLimit(ipH, 30);
      if (!pasa) {
        return NextResponse.json(
          { ok: false, error: "Demasiadas solicitudes. Espera unos segundos." },
          { status: 429 },
        );
      }
    }

    const ua = truncarUserAgent(req.headers.get("user-agent"));

    const res = await insertarLead({
      empresaId: parsed.data.empresaId,
      paginaId: parsed.data.paginaId,
      bloqueId: parsed.data.bloqueId,
      payload: parsed.data.payload,
      utm: parsed.data.utm ?? null,
      referrer: parsed.data.referrer ?? null,
      userAgent: ua,
      ipHash: ipH,
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: res.id });
  } catch (err) {
    console.error("[api/pagina-web/leads]", err);
    return NextResponse.json(
      { ok: false, error: "Error inesperado" },
      { status: 500 },
    );
  }
}
