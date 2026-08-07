import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarCodigo } from "./codigos";

/**
 * Resolución del destino en cada escaneo. Server-only con service-role: quien
 * escanea es un cliente anónimo sin cuenta, y así la tabla no necesita política
 * de lectura para `anon`.
 */

export type DestinoQr =
  | { estado: "OK"; qrId: string; destino: string }
  | { estado: "INACTIVO"; nombre: string }
  | { estado: "NO_EXISTE" };

export async function resolverDestino(codigoRaw: string): Promise<DestinoQr> {
  const codigo = normalizarCodigo(codigoRaw);
  if (!codigo) return { estado: "NO_EXISTE" };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("qr_codigos")
      .select("id, destino, estado, nombre")
      .eq("codigo", codigo)
      .maybeSingle();

    if (error) {
      console.error("[qr][resolverDestino]", error.message);
      return { estado: "NO_EXISTE" };
    }
    if (!data) return { estado: "NO_EXISTE" };

    const fila = data as { id: string; destino: string; estado: string; nombre: string };
    if (fila.estado !== "ACTIVO") {
      return { estado: "INACTIVO", nombre: fila.nombre };
    }

    return { estado: "OK", qrId: fila.id, destino: fila.destino };
  } catch (err) {
    console.error("[qr][resolverDestino] fatal:", err);
    return { estado: "NO_EXISTE" };
  }
}

/** Clasifica el aparato a partir del user-agent. Solo para saber si la gente
 *  escanea desde móvil: no identifica a nadie. */
export function clasificarDispositivo(userAgent: string | null): string {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "otro";
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/.test(ua)) return "movil";
  if (/mozilla|chrome|safari|firefox|edge/.test(ua)) return "escritorio";
  return "otro";
}

/**
 * Suma el escaneo. Nunca lanza: si la estadística falla, el cliente tiene que
 * llegar a su destino igual. Contar es secundario; redirigir es el servicio.
 */
export async function registrarEscaneo(
  qrId: string,
  userAgent: string | null,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("qr_registrar_escaneo", {
      p_qr_id: qrId,
      p_dispositivo: clasificarDispositivo(userAgent),
    });
    if (error) console.error("[qr][registrarEscaneo]", error.message);
  } catch (err) {
    console.error("[qr][registrarEscaneo] fatal:", err);
  }
}
