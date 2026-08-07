"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { reservarCodigoLibre } from "../services/codigos";
import type { CodigoQr, DestinoHistorico } from "../types";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/**
 * El destino solo puede ser http/https. Sin esta validación esto sería un
 * redirector abierto: cualquiera con acceso al panel podría apuntar un QR a
 * `javascript:` o a un esquema raro y usarlo contra los clientes del restaurante.
 */
const destinoSchema = z
  .string()
  .trim()
  .min(1, "Escribe a dónde quieres que lleve el código.")
  .max(2000, "La dirección es demasiado larga.")
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    "La dirección debe empezar por https:// (o http://).",
  );

const crearSchema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre para reconocerlo.").max(120),
  descripcion: z.string().trim().max(500).optional().nullable(),
  destino: destinoSchema,
});

const editarSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().trim().min(1, "Ponle un nombre para reconocerlo.").max(120),
  descripcion: z.string().trim().max(500).optional().nullable(),
  destino: destinoSchema,
});

export async function listarCodigosQr(): Promise<ActionResult<CodigoQr[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    const { data, error } = await supabase
      .from("qr_codigos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[qr][listarCodigosQr]", error.message);
      return { ok: false, error: "No se pudieron cargar los códigos QR." };
    }
    return { ok: true, data: (data ?? []) as CodigoQr[] };
  } catch (err) {
    console.error("[qr][listarCodigosQr] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function crearCodigoQr(
  input: z.input<typeof crearSchema>,
): Promise<ActionResult<CodigoQr>> {
  try {
    const parsed = crearSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
    }

    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    // Reserva atómica: el código queda quemado ya, para que dos personas creando
    // un QR a la vez no puedan llevarse el mismo.
    const codigo = await reservarCodigoLibre();
    if (!codigo) {
      return { ok: false, error: "No se pudo generar un código. Inténtalo de nuevo." };
    }

    const { data, error } = await supabase
      .from("qr_codigos")
      .insert({
        empresa_id: empresaId,
        codigo,
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion || null,
        destino: parsed.data.destino,
        creado_por: userId,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[qr][crearCodigoQr]", error.message);
      return { ok: false, error: "No se pudo crear el código QR." };
    }

    await registrarDestino(data as CodigoQr, parsed.data.destino, userId);

    revalidatePath("/marketing/qr");
    return { ok: true, data: data as CodigoQr };
  } catch (err) {
    console.error("[qr][crearCodigoQr] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function editarCodigoQr(
  input: z.input<typeof editarSchema>,
): Promise<ActionResult> {
  try {
    const parsed = editarSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
    }

    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    // El destino anterior se compara para no ensuciar el histórico con cambios de
    // nombre: solo interesa registrar cuando cambia a dónde lleva el QR.
    const { data: previo } = await supabase
      .from("qr_codigos")
      .select("id, empresa_id, destino")
      .eq("id", parsed.data.id)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (!previo) return { ok: false, error: "Ese código QR no existe." };

    const { error } = await supabase
      .from("qr_codigos")
      .update({
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion || null,
        destino: parsed.data.destino,
      })
      .eq("id", parsed.data.id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[qr][editarCodigoQr]", error.message);
      return { ok: false, error: "No se pudieron guardar los cambios." };
    }

    const anterior = (previo as { destino: string }).destino;
    if (anterior !== parsed.data.destino) {
      await registrarDestino(
        { id: parsed.data.id, empresa_id: empresaId } as CodigoQr,
        parsed.data.destino,
        userId,
      );
    }

    revalidatePath("/marketing/qr");
    return { ok: true };
  } catch (err) {
    console.error("[qr][editarCodigoQr] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function cambiarEstadoCodigoQr(
  id: string,
  estado: "ACTIVO" | "INACTIVO",
): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    const { error } = await supabase
      .from("qr_codigos")
      .update({ estado })
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[qr][cambiarEstadoCodigoQr]", error.message);
      return { ok: false, error: "No se pudo cambiar el estado." };
    }

    revalidatePath("/marketing/qr");
    return { ok: true };
  } catch (err) {
    console.error("[qr][cambiarEstadoCodigoQr] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function listarHistoricoDestinos(
  qrId: string,
): Promise<ActionResult<DestinoHistorico[]>> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa activa." };

    const { data, error } = await supabase
      .from("qr_destinos_historico")
      .select("id, qr_id, destino, created_at")
      .eq("qr_id", qrId)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[qr][listarHistoricoDestinos]", error.message);
      return { ok: false, error: "No se pudo cargar el histórico." };
    }
    return { ok: true, data: (data ?? []) as DestinoHistorico[] };
  } catch (err) {
    console.error("[qr][listarHistoricoDestinos] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

/**
 * Deja constancia de a dónde apuntó el QR y desde cuándo. Con service-role porque
 * el histórico no se escribe desde el navegador: es un registro, no un dato
 * editable. Nunca hace fallar la operación principal — si el registro falla, el
 * cambio de destino sigue siendo válido.
 */
async function registrarDestino(
  qr: Pick<CodigoQr, "id" | "empresa_id">,
  destino: string,
  userId: string | null,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("qr_destinos_historico").insert({
      qr_id: qr.id,
      empresa_id: qr.empresa_id,
      destino,
      cambiado_por: userId,
    });
    if (error) console.error("[qr][registrarDestino]", error.message);
  } catch (err) {
    console.error("[qr][registrarDestino] fatal:", err);
  }
}
