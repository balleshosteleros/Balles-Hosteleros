/**
 * Ruta pública /q/[codigo] — el salto que hace que las cartas impresas dejen de
 * ser una decisión irreversible.
 *
 * El QR impreso apunta AQUÍ (qr.balleshosteleros.com/<codigo>), nunca al destino
 * final. Cambiar el destino desde el panel cambia a dónde lleva el papel, sin
 * reimprimir nada. Es exactamente lo que no se podía hacer con los QR de GHL, que
 * llevaban `api.whatsapp.com` grabado dentro de los cuadraditos.
 *
 * Anónima: quien escanea es un cliente sin cuenta en el sistema.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { QrNoDisponible } from "@/features/marketing/qr/components/public/QrNoDisponible";
import {
  registrarEscaneo,
  resolverDestino,
} from "@/features/marketing/qr/services/resolver";

export const dynamic = "force-dynamic";

export default async function QrRedirectPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const destino = await resolverDestino(codigo);

  if (destino.estado === "NO_EXISTE") {
    return <QrNoDisponible motivo="NO_EXISTE" />;
  }

  if (destino.estado === "INACTIVO") {
    return <QrNoDisponible motivo="INACTIVO" nombre={destino.nombre} />;
  }

  // El contador se suma ANTES del redirect: `redirect()` corta la ejecución
  // lanzando una excepción de control, así que nada posterior se ejecutaría.
  // `registrarEscaneo` nunca lanza — si la estadística falla, el cliente llega
  // igual a su destino.
  const userAgent = (await headers()).get("user-agent");
  await registrarEscaneo(destino.qrId, userAgent);

  redirect(destino.destino);
}
