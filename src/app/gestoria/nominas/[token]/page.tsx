import { FileX2, Clock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenNominasGestoria,
  nombreMes,
} from "@/features/rrhh/services/nominas/nominas-gestoria";
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
    const icon =
      res.reason === "expired" ? (
        <Clock className="h-10 w-10 text-amber-500" />
      ) : (
        <FileX2 className="h-10 w-10 text-rose-500" />
      );
    const titulo = res.reason === "expired" ? "Enlace caducado" : "Enlace no válido";
    const mensaje =
      res.reason === "expired"
        ? "El enlace ha caducado. Pide a la empresa que te lo reenvíe."
        : "El enlace no es válido.";
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

  return (
    <SubirNominasView
      endpoint={`/api/gestoria/nominas/${encodeURIComponent(token)}`}
      empresaNombre={(empresa?.nombre as string) ?? "la empresa"}
      mesLabel={nombreMes(res.row.periodo)}
    />
  );
}
