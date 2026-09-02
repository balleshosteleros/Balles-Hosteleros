import { FileX2, Clock } from "lucide-react";
import { iconsDeEmpresa } from "@/shared/lib/favicon-empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenNominasGestoria,
  estadoMesesNominas,
  mesActualEmpresa,
} from "@/features/rrhh/services/nominas/nominas-gestoria";
import { mesAnterior } from "@/features/rrhh/lib/nominas-periodos";
import { SubirNominasView } from "./SubirNominasView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SubirNominasPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const res = await resolverTokenNominasGestoria(admin, token);

  if (!res.ok) {
    // El enlace permanente no caduca ni se cierra al entregar. Estos dos casos
    // son enlaces ANTIGUOS (los que llevaban el mes dentro) o uno anulado a mano.
    const icon =
      res.reason === "expired" ? (
        <Clock className="h-10 w-10 text-amber-500" />
      ) : (
        <FileX2 className="h-10 w-10 text-rose-500" />
      );
    const titulo = res.reason === "expired" ? "Enlace caducado" : "Enlace no válido";
    const mensaje =
      res.reason === "expired"
        ? "Este enlace era de un mes concreto y ha caducado. Pide a la empresa el enlace nuevo: es permanente y sirve para cualquier mes."
        : "El enlace no es válido. Pide uno nuevo al departamento de RRHH de la empresa.";
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-3">{icon}</div>
          <h1 className="text-lg font-semibold text-zinc-900">{titulo}</h1>
          <p className="mt-2 text-sm text-zinc-600">{mensaje}</p>
        </div>
      </div>
    );
  }

  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", res.row.empresa_id)
    .maybeSingle();

  const mesActual = await mesActualEmpresa(admin, res.row.empresa_id);
  return (
    <SubirNominasView
      endpoint={`/api/gestoria/nominas/${encodeURIComponent(token)}`}
      empresaNombre={(empresa?.nombre as string) ?? "la empresa"}
      meses={await estadoMesesNominas(admin, res.row.empresa_id, mesActual)}
      mesSugerido={mesAnterior(mesActual)}
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
  const res = await resolverTokenNominasGestoria(createAdminClient(), token);
  return {
    robots: { index: false, follow: false },
    icons: await iconsDeEmpresa({ id: res.ok ? res.row.empresa_id : "" }),
  };
}
