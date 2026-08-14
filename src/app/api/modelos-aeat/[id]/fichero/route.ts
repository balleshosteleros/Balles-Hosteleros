import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/supabase/get-context";
import {
  generarFicheroAEAT,
  ficheroAeatEsPresentable,
  toLatin1Bytes,
} from "@/features/gestoria/modelos/services/fichero-aeat";
import { construirSnapshotEmpresa } from "@/features/gestoria/modelos/actions/export-actions";
import { getRegistros347 } from "@/features/gestoria/modelos/actions/registros-347-actions";
import type { ModeloAeat, SnapshotEmpresa } from "@/features/gestoria/modelos/types/modelos";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId)
    return NextResponse.json({ error: "Sin empresa" }, { status: 403 });

  const { data: modelo } = await supabase
    .from("modelos_aeat")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .single();
  if (!modelo) return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });

  // El generador NO cumple el diseño de registro oficial de la AEAT: entregar el
  // fichero invitaría a subirlo a la Sede, que lo rechazaría. Se corta aquí
  // mientras no se implemente el diseño oficial del modelo.
  if (!ficheroAeatEsPresentable(modelo.tipo as ModeloAeat["tipo"])) {
    return NextResponse.json(
      {
        error:
          "El fichero para la Sede Electrónica aún no está disponible: requiere el diseño de registro oficial de la AEAT para este modelo. Usa el PDF para revisar o traspasar las cifras.",
      },
      { status: 501 },
    );
  }

  const snapshot: SnapshotEmpresa =
    (modelo.snapshot_empresa as SnapshotEmpresa | null) ??
    (await construirSnapshotEmpresa(empresaId));

  let registros347 = undefined;
  if (modelo.tipo === "347") {
    registros347 = await getRegistros347(id, modelo.ejercicio as number);
  }

  const { contenido, mimeType, filename } = generarFicheroAEAT({
    modelo: modelo as ModeloAeat,
    snapshot,
    registros347,
  });

  const bytes = toLatin1Bytes(contenido);

  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
