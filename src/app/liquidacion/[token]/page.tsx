import { FileX2, Clock, CheckCircle2 } from "lucide-react";
import { iconsDeEmpresa } from "@/shared/lib/favicon-empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenConfirmacionPago,
  detalleLiquidacionPorToken,
} from "@/features/rrhh/services/nominas/rrhh-pagos-confirmacion";
import { nombreMes } from "@/features/rrhh/services/nominas/nominas-gestoria";
import { ConfirmarLiquidacionView } from "./ConfirmarLiquidacionView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConfirmarLiquidacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const res = await resolverTokenConfirmacionPago(admin, token);

  if (!res.ok) {
    if (res.reason === "used") {
      return (
        <AvisoEnlace
          tono="ok"
          titulo="Este enlace ya se ha usado"
          mensaje={
            res.periodo
              ? `Ya confirmaste tu liquidación de ${nombreMes(res.periodo)}. No hace falta que hagas nada más.`
              : "Ya confirmaste esta liquidación. No hace falta que hagas nada más."
          }
        />
      );
    }
    return res.reason === "expired" ? (
      <AvisoEnlace
        tono="aviso"
        titulo="Enlace caducado"
        mensaje="El enlace ha caducado. Pide a la empresa que te lo reenvíe."
      />
    ) : (
      <AvisoEnlace tono="error" titulo="Enlace no válido" mensaje="El enlace no es válido." />
    );
  }

  const det = await detalleLiquidacionPorToken(admin, res.row);
  if (!det.ok) {
    return det.reason === "used" ? (
      <AvisoEnlace
        tono="ok"
        titulo="Este enlace ya se ha usado"
        mensaje="Ya confirmaste esta liquidación. No hace falta que hagas nada más."
      />
    ) : (
      <AvisoEnlace tono="error" titulo="No disponible" mensaje={det.error} />
    );
  }

  return (
    <ConfirmarLiquidacionView
      endpoint={`/api/liquidacion/${encodeURIComponent(token)}`}
      detalle={det.detalle}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // La empresa se resuelve por el propio token del enlace: asi la asesoria ve
  // el icono de SU cliente en la pestana, no el del software.
  const { token } = await params;
  const res = await resolverTokenConfirmacionPago(createAdminClient(), token);
  return {
    robots: { index: false, follow: false },
    icons: await iconsDeEmpresa({ id: res.ok ? res.row.empresa_id : "" }),
  };
}

/**
 * Pantalla de aviso cuando el enlace no abre la liquidación. El tono separa un
 * enlace YA USADO (que no es un error: cumplió su función) de uno caducado o
 * inválido, para no alarmar a quien simplemente vuelve a pulsar su correo.
 */
function AvisoEnlace({
  tono,
  titulo,
  mensaje,
}: {
  tono: "ok" | "aviso" | "error";
  titulo: string;
  mensaje: string;
}) {
  const icono =
    tono === "ok" ? (
      <CheckCircle2 className="h-10 w-10 text-emerald-600" />
    ) : tono === "aviso" ? (
      <Clock className="h-10 w-10 text-amber-500" />
    ) : (
      <FileX2 className="h-10 w-10 text-rose-500" />
    );

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 text-center">
        <div className="flex justify-center mb-3">{icono}</div>
        <h1 className="text-lg font-semibold text-zinc-900">{titulo}</h1>
        <p className="mt-2 text-sm text-zinc-600">{mensaje}</p>
        <p className="mt-6 text-xs text-zinc-400">Ya puedes cerrar esta ventana.</p>
      </div>
    </div>
  );
}
