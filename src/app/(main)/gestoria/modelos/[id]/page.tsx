import { notFound } from "next/navigation";
import { ModeloEditor } from "@/features/gestoria/modelos/components/ModeloEditor";
import {
  getModelo,
  listAsignaciones,
  listFacturasParaModelo,
  recalcularCasillas,
} from "@/features/gestoria/modelos/actions/modelos-actions";
import { calcular347 } from "@/features/gestoria/modelos/services/calculo-347";
import type { AsignacionModelo } from "@/features/gestoria/modelos/types/modelos";

export const dynamic = "force-dynamic";

export default async function ModeloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const modeloRes = await getModelo(id);
  if (!modeloRes.ok || !modeloRes.data) notFound();
  const modelo = modeloRes.data;

  if (modelo.tipo === "390" && modelo.estado !== "PRESENTADO") {
    await recalcularCasillas(id);
    const re = await getModelo(id);
    if (re.ok && re.data) Object.assign(modelo, re.data);
  }

  const [facturasRes, asignacionesRes] = await Promise.all([
    listFacturasParaModelo(id),
    listAsignaciones(id),
  ]);

  const facturas = facturasRes.ok ? facturasRes.data : [];
  const asignaciones = (asignacionesRes.ok
    ? asignacionesRes.data
    : []) as unknown as AsignacionModelo[];

  let registros347:
    | Array<{
        contacto_id: string;
        nif: string;
        nombre: string;
        tipo_contacto: string;
        clave: string;
        importe_t1: number;
        importe_t2: number;
        importe_t3: number;
        importe_t4: number;
        importe_total: number;
      }>
    | undefined;

  if (modelo.tipo === "347") {
    registros347 = calcular347({ facturas });
  }

  return (
    <ModeloEditor
      modelo={modelo}
      facturas={facturas}
      asignaciones={asignaciones}
      registros347={registros347}
    />
  );
}
