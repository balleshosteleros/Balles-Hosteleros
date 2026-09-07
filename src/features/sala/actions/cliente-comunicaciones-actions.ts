"use server";

import { createClient, getUsuarioActual } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Una comunicación enviada a LA PERSONA, no a una de sus reservas.
 *
 * Son las campañas: el correo del mes, la felicitación de su cumpleaños. Van
 * dirigidas al cliente y le siguen esté donde esté su ficha, así que se ven
 * igual se abra desde Clientes o desde cualquiera de sus reservas.
 */
export interface ClienteComunicacion {
  id: string;
  /** Por dónde salió. */
  via: "CORREO" | "WHATSAPP" | "SMS";
  /** Lo que el cliente tiene en su bandeja: el asunto, o el nombre de la campaña. */
  titulo: string;
  destinatario: string | null;
  /** Nombre de la campaña, para saber de cuál vino. */
  campana: string;
  enviadoAt: string | null;
  /** Cuándo lo abrió, si consta. Solo en correo. */
  abiertoAt: string | null;
  fallido: boolean;
  /** Por qué no salió. Solo cuando falló. */
  error: string | null;
}

const VIA_POR_CANAL: Record<string, ClienteComunicacion["via"]> = {
  email: "CORREO",
  whatsapp: "WHATSAPP",
  sms: "SMS",
};

/**
 * Campañas que ha recibido un cliente, de la más reciente a la más antigua.
 *
 * Solo lectura. Se enseñan también las que fallaron: que a alguien no le llegue
 * su felicitación es justo lo que hay que poder ver desde su ficha, y ocultarlo
 * lo convertiría en un silencio inexplicable.
 */
export async function listClienteComunicaciones(clienteId: string) {
  try {
    const supabase = await createClient();
    const user = await getUsuarioActual();
    if (!user) return { ok: false, data: [] as ClienteComunicacion[] };
    const empresaId = await getEmpresaActivaForUser(
      supabase as unknown as SupabaseClient,
      user.id,
    );
    if (!empresaId) return { ok: false, data: [] as ClienteComunicacion[] };

    // El filtro por empresa va explícito: la RLS acota a las empresas DEL
    // usuario, no a la ACTIVA (mismo motivo que en el resto de sala).
    const { data, error } = await supabase
      .from("campanas_envios")
      .select(
        "id, destinatario, estado, enviado_en, abierto_en, error, created_at, campanas_marketing(nombre, canal, payload)",
      )
      .eq("cliente_id", clienteId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const filas: ClienteComunicacion[] = (data ?? []).map((r) => {
      const campana = (r.campanas_marketing ?? {}) as {
        nombre?: string;
        canal?: string;
        payload?: Record<string, unknown>;
      };
      const asunto = (campana.payload?.asunto as string | undefined)?.trim();
      return {
        id: r.id as string,
        via: VIA_POR_CANAL[campana.canal ?? "email"] ?? "CORREO",
        titulo: asunto || campana.nombre || "Campaña",
        destinatario: (r.destinatario as string | null) ?? null,
        campana: campana.nombre ?? "",
        enviadoAt: (r.enviado_en as string | null) ?? (r.created_at as string),
        abiertoAt: (r.abierto_en as string | null) ?? null,
        fallido: r.estado === "fallido",
        error: (r.error as string | null) ?? null,
      };
    });

    return { ok: true, data: filas };
  } catch (err) {
    console.error("[cliente-comunicaciones] list:", err);
    return { ok: false, data: [] as ClienteComunicacion[] };
  }
}
