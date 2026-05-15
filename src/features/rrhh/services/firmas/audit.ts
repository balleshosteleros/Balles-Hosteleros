import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalStringify, sha256 } from "./crypto";

export type TipoEventoFirma =
  | "creado"
  | "enviado"
  | "reenviado"
  | "abierto"
  | "otp_enviado"
  | "otp_validado"
  | "otp_fallido"
  | "otp_bloqueado"
  | "firmado"
  | "rechazado"
  | "expirado";

export type RegistrarEventoInput = {
  documentoId: string;
  tipo: TipoEventoFirma;
  actorUserId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export type EventoRegistrado = {
  id: string;
  hash: string;
  prevHash: string | null;
};

export async function registrarEvento(
  input: RegistrarEventoInput,
): Promise<EventoRegistrado> {
  const admin = createAdminClient();

  const { data: prev, error: prevErr } = await admin
    .from("firmas_eventos")
    .select("hash")
    .eq("documento_id", input.documentoId)
    .order("ocurrido_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prevErr) throw prevErr;
  const prevHash = prev?.hash ?? null;

  const ocurridoEn = new Date().toISOString();
  const payloadCanonico = canonicalStringify({
    documentoId: input.documentoId,
    tipo: input.tipo,
    actorUserId: input.actorUserId ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    metadata: input.metadata ?? {},
    prevHash,
    ocurridoEn,
  });
  const hash = sha256(payloadCanonico);

  const { data: inserted, error } = await admin
    .from("firmas_eventos")
    .insert({
      documento_id: input.documentoId,
      tipo: input.tipo,
      actor_user_id: input.actorUserId ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
      prev_hash: prevHash,
      hash,
      ocurrido_en: ocurridoEn,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: inserted.id as string, hash, prevHash };
}

export type EventoAuditoria = {
  id: string;
  tipo: TipoEventoFirma;
  actorUserId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
  ocurridoEn: string;
};

export async function listarEventos(documentoId: string): Promise<EventoAuditoria[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("firmas_eventos")
    .select("id, tipo, actor_user_id, ip, user_agent, metadata, prev_hash, hash, ocurrido_en")
    .eq("documento_id", documentoId)
    .order("ocurrido_en", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    tipo: r.tipo as TipoEventoFirma,
    actorUserId: (r.actor_user_id as string | null) ?? null,
    ip: (r.ip as string | null) ?? null,
    userAgent: (r.user_agent as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    prevHash: (r.prev_hash as string | null) ?? null,
    hash: r.hash as string,
    ocurridoEn: r.ocurrido_en as string,
  }));
}

export function verificarCadena(
  documentoId: string,
  eventos: EventoAuditoria[],
): { ok: boolean; rotoEn?: string } {
  let prev: string | null = null;
  for (const e of eventos) {
    if (e.prevHash !== prev) return { ok: false, rotoEn: e.id };
    const recomputado = sha256(
      canonicalStringify({
        documentoId,
        tipo: e.tipo,
        actorUserId: e.actorUserId,
        ip: e.ip,
        userAgent: e.userAgent,
        metadata: e.metadata,
        prevHash: e.prevHash,
        ocurridoEn: e.ocurridoEn,
      }),
    );
    if (recomputado !== e.hash) return { ok: false, rotoEn: e.id };
    prev = e.hash;
  }
  return { ok: true };
}
