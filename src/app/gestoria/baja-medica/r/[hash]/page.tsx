import { FileX2, Clock } from "lucide-react";
import { iconsDeEmpresa } from "@/shared/lib/favicon-empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenComprobantePorHash,
  fechaEs,
} from "@/features/rrhh/services/gestoria/baja-medica-documentos";
import { SubirComprobanteView } from "../../[token]/SubirComprobanteView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pantalla abierta desde el RECORDATORIO. El token en claro solo vivía en el
 * primer correo, así que el recordatorio enlaza por hash y aquí se resuelve por
 * esa vía. Reusa la misma vista y el mismo flujo de subida.
 */
export default async function SubirComprobantePorHashPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const admin = createAdminClient();
  const res = await resolverTokenComprobantePorHash(admin, hash);

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

  const [{ data: emp }, { data: empresa }] = await Promise.all([
    admin
      .from("empleados")
      .select("nombre, apellidos, dni_nie")
      .eq("id", res.row.empleado_id)
      .maybeSingle(),
    admin.from("empresas").select("nombre").eq("id", res.row.empresa_id).maybeSingle(),
  ]);

  return (
    <SubirComprobanteView
      endpoint={`/api/gestoria/baja-medica/r/${encodeURIComponent(hash)}`}
      trabajador={{
        nombre: `${emp?.nombre ?? ""} ${emp?.apellidos ?? ""}`.trim() || "Trabajador",
        dniNie: (emp?.dni_nie as string | null) ?? null,
      }}
      empresaNombre={(empresa?.nombre as string) ?? "la empresa"}
      fechaBaja={fechaEs(res.row.fecha_inicio)}
      yaSubido={res.row.comprobante_subido_en != null}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const res = await resolverTokenComprobantePorHash(createAdminClient(), hash);
  return {
    robots: { index: false, follow: false },
    icons: await iconsDeEmpresa({ id: res.ok ? res.row.empresa_id : "" }),
  };
}
