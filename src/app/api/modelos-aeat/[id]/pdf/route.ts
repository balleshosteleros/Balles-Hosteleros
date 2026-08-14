import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/supabase/get-context";
import { generarHtmlModelo } from "@/features/gestoria/modelos/services/pdf-generator";
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

  const snapshot: SnapshotEmpresa =
    (modelo.snapshot_empresa as SnapshotEmpresa | null) ??
    (await construirSnapshotEmpresa(empresaId));

  let registros347:
    | Array<{
        nif: string;
        nombre: string;
        clave: string;
        importe_t1: number;
        importe_t2: number;
        importe_t3: number;
        importe_t4: number;
        importe_total: number;
      }>
    | undefined;

  if (modelo.tipo === "347") {
    registros347 = await getRegistros347(id, modelo.ejercicio as number);
  }

  const html = generarHtmlModelo(modelo as ModeloAeat, snapshot, registros347);

  // No hay motor de PDF en servidor: la hoja está maquetada en A4 con CSS de
  // impresión y es el navegador quien la exporta. Abrimos su diálogo al cargar
  // para que "Imprimir / Guardar como PDF" sea un paso, no una búsqueda.
  const htmlImprimible = html.replace(
    "</body>",
    "<script>window.addEventListener('load',()=>window.print())</script></body>",
  );

  return new NextResponse(htmlImprimible, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
