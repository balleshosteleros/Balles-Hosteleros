import { abrirDocumento } from "./actions";
import { iconsDeUrl } from "@/shared/lib/favicon-empresa";
import { FirmaPublicaView } from "./FirmaPublicaView";
import { FileX2, Clock, AlertTriangle } from "lucide-react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FirmarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await abrirDocumento(token);

  if (!res.ok) {
    const icon =
      res.reason === "expired" ? (
        <Clock className="h-10 w-10 text-amber-500" />
      ) : res.reason === "consumed" ? (
        <AlertTriangle className="h-10 w-10 text-zinc-500" />
      ) : (
        <FileX2 className="h-10 w-10 text-rose-500" />
      );
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-3">{icon}</div>
          <h1 className="text-lg font-semibold text-zinc-900">
            {res.reason === "expired"
              ? "Enlace caducado"
              : res.reason === "consumed"
                ? "Enlace ya utilizado"
                : "Enlace no válido"}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">{res.message}</p>
        </div>
      </div>
    );
  }

  return <FirmaPublicaView documento={res.documento} token={token} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // La empresa sale del propio token del enlace de firma: quien firma ve el
  // icono de SU empresa en la pestana, no el del software. `logoUrl` ya viene
  // resuelto como isotipo-con-preferencia desde `abrirDocumento`.
  const { token } = await params;
  const res = await abrirDocumento(token);
  return {
    title: "Firmar documento",
    robots: { index: false, follow: false },
    icons: iconsDeUrl(res.ok ? res.documento.empresa.logoUrl : null),
  };
}
