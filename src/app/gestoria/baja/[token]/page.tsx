import { FileX2, Clock } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenDocsBaja,
  DOCS_BAJA,
} from "@/features/rrhh/services/gestoria/gestoria-baja-documentos";
import { SubirDocsBajaView } from "./SubirDocsBajaView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SubirDocsBajaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const res = await resolverTokenDocsBaja(admin, token);

  if (!res.ok) {
    const caducado = res.reason === "expired";
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-3">
            {caducado ? (
              <Clock className="h-10 w-10 text-amber-500" />
            ) : (
              <FileX2 className="h-10 w-10 text-rose-500" />
            )}
          </div>
          <h1 className="text-lg font-semibold text-zinc-900">
            {caducado ? "Enlace caducado" : "Enlace no válido"}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            {caducado
              ? "El enlace ha caducado. Pide a la empresa que te lo reenvíe."
              : "El enlace no es válido."}
          </p>
        </div>
      </div>
    );
  }

  const { data: emp } = await admin
    .from("empleados")
    .select("nombre, apellidos, dni_nie")
    .eq("id", res.row.empleado_id)
    .maybeSingle();
  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", res.row.empresa_id)
    .maybeSingle();

  const documentos = DOCS_BAJA.map((d) => ({
    ...d,
    subido:
      d.clave === "justificante"
        ? res.row.justificante_subido_en != null
        : res.row.certificado_subido_en != null,
  }));

  return (
    <SubirDocsBajaView
      endpoint={`/api/gestoria/baja/${encodeURIComponent(token)}`}
      trabajador={{
        nombre: `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim() || "Trabajador",
        dniNie: (emp?.dni_nie as string | null) ?? null,
      }}
      empresaNombre={(empresa?.nombre as string) ?? "la empresa"}
      documentos={documentos}
    />
  );
}
