import { FileX2, Clock, CheckCircle2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenModelosGestoria,
  listarModelosDelToken,
} from "@/features/gestoria/modelos/services/gestoria-modelos-tokens";
import { periodoALabel } from "@/features/gestoria/modelos/types/modelos";
import { SubirModelosView } from "./SubirModelosView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SubirModelosPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const res = await resolverTokenModelosGestoria(admin, token);

  if (!res.ok) {
    const icon =
      res.reason === "expired" ? (
        <Clock className="h-10 w-10 text-amber-500" />
      ) : res.reason === "completed" ? (
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      ) : (
        <FileX2 className="h-10 w-10 text-rose-500" />
      );
    const titulo =
      res.reason === "expired"
        ? "Enlace caducado"
        : res.reason === "completed"
          ? "Modelos ya recibidos"
          : "Enlace no válido";
    const mensaje =
      res.reason === "expired"
        ? "El enlace ha caducado. Pide a la empresa que te lo reenvíe."
        : res.reason === "completed"
          ? "Los modelos de este periodo ya se subieron correctamente."
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

  const modelos = await listarModelosDelToken(admin, res.row);
  const periodoLabel = periodoALabel(res.row.periodo, res.row.ejercicio);

  return (
    <SubirModelosView
      endpoint={`/api/gestoria/modelos/subir/${encodeURIComponent(token)}`}
      empresaNombre={(empresa?.nombre as string) ?? "la empresa"}
      periodoLabel={periodoLabel}
      grupo={res.row.grupo}
      modelos={modelos.map((m) => ({ tipo: m.tipo, label: m.label, tienePdf: m.tienePdf }))}
    />
  );
}
