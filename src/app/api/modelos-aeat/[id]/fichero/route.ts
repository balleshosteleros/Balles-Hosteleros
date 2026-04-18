import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/supabase/get-context";
import {
  generarFicheroAEAT,
  toLatin1Bytes,
} from "@/features/gestoria/modelos/services/fichero-aeat";
import { construirSnapshotEmpresa } from "@/features/gestoria/modelos/actions/export-actions";
import { listFacturasParaModelo } from "@/features/gestoria/modelos/actions/modelos-actions";
import { calcular347 } from "@/features/gestoria/modelos/services/calculo-347";
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

  const snapshot: SnapshotEmpresa =
    (modelo.snapshot_empresa as SnapshotEmpresa | null) ??
    (await construirSnapshotEmpresa(empresaId));

  let registros347 = undefined;
  if (modelo.tipo === "347") {
    const { data } = await listFacturasParaModelo(id);
    registros347 = calcular347({ facturas: data });
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
