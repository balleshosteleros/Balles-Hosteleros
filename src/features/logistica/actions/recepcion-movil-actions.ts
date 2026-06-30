"use server";

/**
 * §5 Recepción móvil de albaranes — orquestación.
 *
 * Crea el albarán desde un pedido "Enviado" con las CANTIDADES RECIBIDAS que indica
 * el empleado en el móvil (precargadas con lo pedido) y lo marca "Entregado" para que
 * entre el stock. Reutiliza `createAlbaran` y `updateAlbaranEstado` del flujo de
 * escritorio. El producto y el precio salen del pedido en BD (fuente de verdad), no
 * del cliente; del cliente solo se acepta la cantidad recibida por línea.
 */
import { getLogisticaContext } from "@/features/logistica/lib/supabase-context";
import { getZonaHorariaEmpresa } from "@/features/empresa/lib/empresa-server";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { createAlbaran, updateAlbaranEstado } from "@/features/logistica/actions/albaranes-actions";

interface LineaPedidoRow {
  id: string;
  producto_id: string | null;
  producto_nombre: string | null;
  cantidad: number | string | null;
  unidad: string | null;
  precio_unitario: number | string | null;
}

export async function recibirAlbaranDesdePedido(input: {
  pedidoId: string;
  recibidos: { lineaId: string; cantidad: number }[];
}): Promise<{ ok: boolean; albaranId?: string; numero?: string; stockAviso?: string; error?: string }> {
  try {
    const { supabase, userId, empresaId } = await getLogisticaContext();
    if (!empresaId) return { ok: false, error: "No autenticado" };

    const { data: pedido, error: pErr } = await supabase
      .from("pedidos")
      .select("id, estado, proveedor_nombre, almacen, numero, numero_secuencial, dto_pct, dto_eur, notas")
      .eq("id", input.pedidoId)
      .eq("empresa_id", empresaId)
      .single();
    if (pErr || !pedido) return { ok: false, error: "Pedido no encontrado" };

    const { data: lineasRows, error: lErr } = await supabase
      .from("lineas_pedido")
      .select("id, producto_id, producto_nombre, cantidad, unidad, precio_unitario")
      .eq("pedido_id", input.pedidoId)
      .order("orden", { ascending: true });
    if (lErr) throw lErr;

    const recibidoPorLinea = new Map(
      (input.recibidos ?? []).map((r) => [r.lineaId, Math.max(Number(r.cantidad) || 0, 0)]),
    );

    const ref =
      (pedido.numero as string | null) ||
      (pedido.numero_secuencial != null ? `PED-${pedido.numero_secuencial}` : String(pedido.id).slice(0, 8));

    const lineas = ((lineasRows ?? []) as LineaPedidoRow[])
      .map((l) => {
        const cantidad = recibidoPorLinea.has(l.id)
          ? (recibidoPorLinea.get(l.id) as number)
          : Number(l.cantidad) || 0;
        const precioUC = Number(l.precio_unitario) || 0;
        return {
          id: l.id,
          productoId: l.producto_id ?? "",
          producto: l.producto_nombre ?? "",
          cantidad,
          unidad: l.unidad ?? "ud",
          precioUC,
          impuesto: 0,
          dtoPct: 0,
          dtoEur: 0,
          total: Math.round(cantidad * precioUC * 100) / 100,
          docPedido: ref,
        };
      })
      .filter((l) => l.cantidad > 0 && l.productoId);

    if (lineas.length === 0) {
      return { ok: false, error: "No has indicado ninguna cantidad recibida." };
    }

    // Nombre de quien recepciona (creador del albarán).
    let creador = "";
    if (userId) {
      const { data: u } = await supabase
        .from("usuarios")
        .select("nombre, apellidos")
        .eq("user_id", userId)
        .single();
      if (u) creador = `${u.nombre ?? ""} ${u.apellidos ?? ""}`.trim();
    }

    const tz = await getZonaHorariaEmpresa(supabase, empresaId);
    const fecha = hoyEnZona(tz);

    const res = await createAlbaran({
      pedidoId: pedido.id as string,
      proveedorNombre: (pedido.proveedor_nombre as string) ?? "",
      almacen: (pedido.almacen as string) ?? "",
      documento: `ALB-${ref}`,
      fecha,
      dtoPct: Number(pedido.dto_pct) || 0,
      dtoEur: Number(pedido.dto_eur) || 0,
      notas: (pedido.notas as string) ?? "",
      creador,
      lineas,
      numeroSecuencial:
        typeof pedido.numero_secuencial === "number" ? pedido.numero_secuencial : undefined,
    });
    if (!res.ok) return { ok: false, error: res.error };

    // Recepción → suma stock (idempotente en la action).
    const est = await updateAlbaranEstado(res.id, "Entregado");
    const stockAviso = (est as { stockAviso?: string }).stockAviso;

    return { ok: true, albaranId: res.id, numero: res.numero, stockAviso };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[recepcion-movil] recibirAlbaranDesdePedido:", msg);
    return { ok: false, error: msg };
  }
}
