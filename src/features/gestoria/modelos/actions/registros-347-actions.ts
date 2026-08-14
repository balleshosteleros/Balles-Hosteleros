"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { calcular347, type Registro347 } from "../services/calculo-347";
import { listFacturasParaModelo } from "./modelos-actions";

/**
 * Contactos del ejercicio cuyas operaciones YA se declaran en el 111 o el 115.
 * El 347 debe excluirlos: las rentas con retención (alquileres del 115, servicios
 * profesionales del 111) se informan en su propio modelo y declararlas también
 * aquí las duplicaría frente a la AEAT.
 */
async function contactosExcluidosDel347(
  supabase: Awaited<ReturnType<typeof getAppContext>>["supabase"],
  empresaId: string,
  ejercicio: number,
  tipo: "111" | "115",
): Promise<Set<string>> {
  const excluidos = new Set<string>();

  const { data: modelos } = await supabase
    .from("modelos_aeat")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("tipo", tipo)
    .eq("ejercicio", ejercicio);

  for (const m of (modelos ?? []) as Array<{ id: string }>) {
    const { data: asignaciones } = await supabase
      .from("asignaciones_modelo")
      .select("factura_id")
      .eq("modelo_id", m.id);

    const facturaIds = ((asignaciones ?? []) as Array<{ factura_id: string }>).map(
      (a) => a.factura_id,
    );
    if (facturaIds.length === 0) continue;

    const { data: facturas } = await supabase
      .from("facturas")
      .select("contacto_id")
      .eq("empresa_id", empresaId)
      .in("id", facturaIds);

    for (const f of (facturas ?? []) as Array<{ contacto_id: string | null }>) {
      if (f.contacto_id) excluidos.add(f.contacto_id);
    }
  }

  return excluidos;
}

/**
 * Calcula los registros del 347 de un modelo aplicando las exclusiones legales
 * (contactos ya declarados en 111/115). Es el único punto por el que deben pasar
 * la vista, el PDF y el fichero AEAT, para que los tres muestren lo mismo.
 */
export async function getRegistros347(
  modeloId: string,
  ejercicio: number,
): Promise<Registro347[]> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return [];

  const facturasRes = await listFacturasParaModelo(modeloId);
  if (!facturasRes.ok) return [];

  const [excluirContactosDe111, excluirContactosDe115] = await Promise.all([
    contactosExcluidosDel347(supabase, empresaId, ejercicio, "111"),
    contactosExcluidosDel347(supabase, empresaId, ejercicio, "115"),
  ]);

  return calcular347({
    facturas: facturasRes.data,
    excluirContactosDe111,
    excluirContactosDe115,
  });
}
