import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/supabase/get-context";
import { generarHtmlModelo } from "@/features/gestoria/modelos/services/pdf-generator";
import { construirSnapshotEmpresa } from "@/features/gestoria/modelos/actions/export-actions";
import { calcular347 } from "@/features/gestoria/modelos/services/calculo-347";
import { listFacturasParaModelo } from "@/features/gestoria/modelos/actions/modelos-actions";
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

  let registros347:
    | Array<{
        nif: string;
        nombre: string;
        clave: string;
        importe_q1: number;
        importe_q2: number;
        importe_q3: number;
        importe_q4: number;
        importe_total: number;
      }>
    | undefined;

  if (modelo.tipo === "347") {
    const { data } = await listFacturasParaModelo(id);
    registros347 = calcular347({ facturas: data });
  }

  const html = generarHtmlModelo(modelo as ModeloAeat, snapshot, registros347);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
