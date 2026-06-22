"use server";

/**
 * Insert de leads (formularios públicos) — usa service_role client desde el
 * endpoint API porque las rutas públicas son anónimas y no pueden escribir con
 * RLS "admin-only". Las RLS siguen impidiendo lectura cruzada.
 */
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const leadInputSchema = z.object({
  empresaId: z.string().guid(),
  paginaId: z.string().guid().optional(),
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
  userAgent: z.string().max(120).nullable().optional(),
  ipHash: z.string().max(64).nullable().optional(),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

export async function insertarLead(input: LeadInput): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  try {
    const parsed = leadInputSchema.safeParse(input);
    if (!parsed.success) {
      console.error("[pagina-web][insertarLead] validación:", parsed.error.issues);
      return { ok: false, error: "Datos inválidos." };
    }
    const payload = parsed.data.payload;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("leads_web")
      .insert({
        empresa_id: parsed.data.empresaId,
        pagina_id: parsed.data.paginaId ?? null,
        bloque_id: parsed.data.bloqueId ?? null,
        nombre: stringField(payload, "nombre"),
        email: stringField(payload, "email"),
        telefono: stringField(payload, "telefono"),
        mensaje: stringField(payload, "mensaje"),
        payload,
        utm: parsed.data.utm ?? null,
        referrer: parsed.data.referrer ?? null,
        user_agent: parsed.data.userAgent ?? null,
        ip_hash: parsed.data.ipHash ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[pagina-web][insertarLead]", error.message);
      return { ok: false, error: "No se pudo guardar el lead." };
    }
    return { ok: true, id: (data as { id: string }).id };
  } catch (err) {
    console.error("[pagina-web][insertarLead] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

function stringField(obj: Record<string, unknown>, key: string): string | null {
  const val = obj[key];
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

/**
 * Comprueba si la misma ip_hash ha enviado un lead en los últimos `segundos` segundos.
 */
export async function verificarRateLimit(ipHashVal: string, segundos = 30): Promise<boolean> {
  if (!ipHashVal) return true;
  const supabase = createAdminClient();
  const desde = new Date(Date.now() - segundos * 1000).toISOString();
  const { count, error } = await supabase
    .from("leads_web")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHashVal)
    .gte("created_at", desde);
  if (error) {
    console.error("[pagina-web][verificarRateLimit]", error.message);
    return true;
  }
  return (count ?? 0) === 0;
}
