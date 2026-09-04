import { FileX2, Clock } from "lucide-react";
import { iconsDeEmpresa } from "@/shared/lib/favicon-empresa";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolverTokenDocEmpleado,
  DOCS_EMPLEADO,
} from "@/features/rrhh/services/documentos/empleado-doc-token";
import { SubirDocEmpleadoView } from "./SubirDocEmpleadoView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Qué se le pide exactamente en cada caso, en su idioma, no en el nuestro. */
const DESCRIPCION: Record<string, string> = {
  iban:
    "Necesitamos el certificado de titularidad de tu cuenta: el documento que emite el banco y " +
    "que puedes descargar desde su app. Tiene que verse tu nombre como titular y el IBAN completo. " +
    "Vale una foto o un PDF, siempre que se lea bien.",
  dni_anverso: "Sube la cara delantera de tu DNI o NIE. Comprueba que se leen todos los datos.",
  dni_reverso: "Sube la cara trasera de tu DNI o NIE. Comprueba que se leen todos los datos.",
  ss:
    "Sube tu documento de la Seguridad Social donde aparezca tu número de afiliación " +
    "(vida laboral o tarjeta sanitaria).",
};

export default async function SubirDocEmpleadoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const res = await resolverTokenDocEmpleado(admin, token);

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
    .select("nombre")
    .eq("id", res.row.empleado_id)
    .maybeSingle();
  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre")
    .eq("id", res.row.empresa_id)
    .maybeSingle();

  return (
    <SubirDocEmpleadoView
      endpoint={`/api/documentos/${encodeURIComponent(token)}`}
      empleadoNombre={(emp?.nombre as string | null)?.trim() || "de nuevo"}
      empresaNombre={(empresa?.nombre as string) ?? "la empresa"}
      titulo={DOCS_EMPLEADO[res.row.tipo_doc].label}
      descripcion={DESCRIPCION[res.row.tipo_doc] ?? ""}
      yaSubido={res.row.subido_en != null}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // La empresa sale del propio token: el empleado ve el icono de SU empresa en
  // la pestaña, no el del software.
  const { token } = await params;
  const res = await resolverTokenDocEmpleado(createAdminClient(), token);
  return {
    robots: { index: false, follow: false },
    icons: await iconsDeEmpresa({ id: res.ok ? res.row.empresa_id : "" }),
  };
}
