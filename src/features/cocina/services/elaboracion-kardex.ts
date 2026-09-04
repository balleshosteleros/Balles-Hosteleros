import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  registrarMovimiento,
  revertirMovimientosPorDocumento,
} from "@/features/logistica/services/kardex";

/**
 * Confirmar / revertir una ELABORACIÓN por el kardex.
 *
 * QUÉ ES UNA ELABORACIÓN (definición de Iván, 03-sep): coger productos de compra y
 * fabricar con ellos un producto nuevo, que luego se usa en los escandallos. Es lo mismo
 * que un producto de compra, solo que no se compra: se hace.
 *
 * CÓMO SE TRABAJA (también suyo): el jefe de cocina apunta cada semana lo que ha hecho y
 * **cuánto le ha salido** ("he hecho esta salsa y me ha salido 1 litro"). Elige la receta
 * y teclea la cantidad producida; el sistema descuenta los ingredientes **en proporción**.
 *
 * Sustituye a las RPC `confirmar_elaboracion` / `revertir_elaboracion`, que estaban rotas
 * (leían una columna renombrada en junio), se saltaban el kardex y **solo sumaban el
 * elaborado sin descontar los ingredientes** — fabricaban existencias de la nada.
 *
 * Una confirmación genera:
 *   · N SALIDAS — un movimiento por ingrediente del escandallo.
 *   · 1 ENTRADA — el producto elaborado, con su coste real (lo que costó fabricarlo).
 * Todo con `documento_tipo='elaboracion'` y `documento_id` = la elaboración, para poder
 * revertirlo en bloque.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export interface LineaConsumo {
  productoId: string;
  nombre: string;
  cantidad: number;
  medida: string | null;
}

export interface PrevisionElaboracion {
  ok: boolean;
  error?: string;
  producto: { id: string; nombre: string; medida: string | null } | null;
  cantidadProducida: number;
  /** Cuántas unidades rinde la receta tal como está escrita (escandallos.porciones, 1 por defecto). */
  rinde: number;
  /** cantidadProducida / rinde: cuántas veces se hace la receta. */
  factor: number;
  consumo: LineaConsumo[];
}

/** Lee la elaboración, su receta y calcula qué se consumiría. No escribe nada. */
async function calcular(admin: AdminClient, elabId: string): Promise<
  PrevisionElaboracion & { elab?: Record<string, unknown> }
> {
  const vacio = (error: string): PrevisionElaboracion => ({
    ok: false, error, producto: null, cantidadProducida: 0, rinde: 1, factor: 0, consumo: [],
  });

  const { data: elab } = await admin
    .from("elaboraciones")
    .select("id, empresa_id, estado, producto_elaboracion_id, cantidad_producida, fecha, responsable, nombre")
    .eq("id", elabId)
    .maybeSingle();
  if (!elab) return vacio("Esa elaboración ya no existe.");

  const productoId = elab.producto_elaboracion_id as string | null;
  const cantidadProducida = Number(elab.cantidad_producida ?? 0);
  if (!productoId) return vacio("La elaboración no tiene producto asignado.");
  if (!(cantidadProducida > 0)) return vacio("Indica cuánta cantidad ha salido antes de confirmar.");

  const { data: prod } = await admin
    .from("productos")
    .select("id, nombre, medida")
    .eq("id", productoId)
    .maybeSingle();
  if (!prod) return vacio("El producto de la elaboración ya no existe.");

  // La receta de la elaboración es su composición (misma tabla que usa el descuento por
  // ventas: una sola fuente para "qué lleva esto").
  const { data: comp } = await admin
    .from("producto_composicion")
    .select("ingrediente_id, cantidad, merma_pct")
    .eq("producto_venta_id", productoId);

  if (!comp || comp.length === 0) {
    // Doctrina de Iván, la misma que en ventas: sin escandallo no se descuenta nada.
    // Confirmar sin receta solo sumaría el elaborado — que es justo el fallo que
    // arrastraba el módulo viejo.
    return vacio(
      `"${prod.nombre}" no tiene escandallo todavía. Sin la receta no se sabe qué ingredientes gasta, así que no se puede confirmar: se estaría creando mercancía de la nada.`,
    );
  }

  // Cuánto rinde la receta tal como está escrita. Si no está declarado, se entiende que
  // está escrita "por unidad" (1 kg / 1 L), que es como funciona el escandallo de venta.
  const { data: esc } = await admin
    .from("escandallos")
    .select("porciones")
    .eq("producto_id", productoId)
    .maybeSingle();
  const rinde = Number(esc?.porciones ?? 0) > 0 ? Number(esc?.porciones) : 1;
  const factor = cantidadProducida / rinde;

  const ids = comp.map((c) => c.ingrediente_id as string);
  const infoById = new Map<string, { nombre: string; medida: string | null; factorConv: number }>();
  if (ids.length > 0) {
    const { data: prods } = await admin
      .from("productos")
      .select("id, nombre, medida, factor_conversion")
      .in("id", ids);
    for (const p of prods ?? []) {
      const f = Number(p.factor_conversion ?? 1);
      infoById.set(p.id as string, {
        nombre: (p.nombre as string) ?? "—",
        medida: (p.medida as string) ?? null,
        factorConv: Number.isFinite(f) && f > 0 ? f : 1,
      });
    }
  }

  const consumo: LineaConsumo[] = [];
  for (const c of comp) {
    const info = infoById.get(c.ingrediente_id as string);
    const merma = Number(c.merma_pct ?? 0);
    // Misma fórmula que el descuento por ventas: receta × (1+merma) ÷ factor_conversion.
    const cantidad = (factor * Number(c.cantidad ?? 0) * (1 + merma / 100)) / (info?.factorConv ?? 1);
    if (!(cantidad > 0)) continue;
    consumo.push({
      productoId: c.ingrediente_id as string,
      nombre: info?.nombre ?? "—",
      cantidad,
      medida: info?.medida ?? null,
    });
  }

  return {
    ok: true,
    producto: { id: prod.id as string, nombre: prod.nombre as string, medida: (prod.medida as string) ?? null },
    cantidadProducida,
    rinde,
    factor,
    consumo,
    elab: elab as Record<string, unknown>,
  };
}

/**
 * Qué se va a descontar si se confirma. Se enseña ANTES de confirmar: si el rendimiento
 * de la receta está mal declarado, el error se ve en pantalla en vez de descuadrar el
 * almacén en silencio.
 */
export async function previsualizarElaboracion(
  elabId: string,
  client?: AdminClient,
): Promise<PrevisionElaboracion> {
  const admin = client ?? createAdminClient();
  const { elab: _elab, ...prevision } = await calcular(admin, elabId);
  void _elab;
  return prevision;
}

/** Confirma: N salidas de ingredientes + 1 entrada del elaborado, todo por el kardex. */
export async function confirmarElaboracionKardex(
  elabId: string,
  client?: AdminClient,
): Promise<{ ok: boolean; error?: string; salidas?: number; entrada?: boolean }> {
  const admin = client ?? createAdminClient();
  const r = await calcular(admin, elabId);
  if (!r.ok || !r.producto || !r.elab) return { ok: false, error: r.error };

  const elab = r.elab;
  const empresaId = String(elab.empresa_id);
  if (elab.estado === "confirmado") return { ok: false, error: "Esa elaboración ya estaba confirmada." };

  const fechaISO = elab.fecha ? `${String(elab.fecha)}T12:00:00Z` : new Date().toISOString();
  const createdBy = (elab.responsable as string | null) ?? null;
  const referencia = (elab.nombre as string | null) ?? "Elaboración";

  // 1) SALIDAS: los ingredientes que se han gastado.
  //    `origenLineaId` = (elaboración, producto) por el índice único del kardex, que da
  //    idempotencia gratis: confirmar dos veces no duplica movimientos.
  let salidas = 0;
  let valorConsumido = 0;
  let costeConocido = true;
  for (const linea of r.consumo) {
    const mov = await registrarMovimiento(
      {
        empresaId,
        productoId: linea.productoId,
        tipo: "salida",
        cantidad: linea.cantidad,
        referencia,
        documentoTipo: "elaboracion",
        documentoId: elabId,
        origenLineaId: elabId,
        motivo: `Elaboración: ${r.producto.nombre}`,
        createdBy,
        fecha: fechaISO,
      },
      admin,
    );
    if (!mov.omitido && !mov.duplicado) salidas++;
    // El coste del elaborado es lo que ha costado fabricarlo. Si algún ingrediente no
    // tiene precio conocido, no se inventa: el elaborado queda sin coste.
    const { data: ultimo } = await admin
      .from("stock_movimientos")
      .select("valor_total")
      .eq("documento_id", elabId)
      .eq("producto_id", linea.productoId)
      .maybeSingle();
    const valor = ultimo?.valor_total == null ? null : Number(ultimo.valor_total);
    if (valor == null) costeConocido = false;
    else valorConsumido += valor;
  }

  // 2) ENTRADA: el producto elaborado, con su coste real por unidad.
  const costeUnitario =
    costeConocido && r.cantidadProducida > 0 ? valorConsumido / r.cantidadProducida : null;
  const entrada = await registrarMovimiento(
    {
      empresaId,
      productoId: r.producto.id,
      tipo: "entrada",
      cantidad: r.cantidadProducida,
      referencia,
      documentoTipo: "elaboracion",
      documentoId: elabId,
      origenLineaId: elabId,
      motivo: `Elaborado (${r.consumo.length} ingredientes)`,
      createdBy,
      fecha: fechaISO,
      costeUnitario,
    },
    admin,
  );

  await admin
    .from("elaboraciones")
    .update({ estado: "confirmado", updated_at: new Date().toISOString() })
    .eq("id", elabId);

  return { ok: true, salidas, entrada: !entrada.omitido };
}

/** Vuelve a borrador: deshace TODOS los movimientos de la elaboración. */
export async function revertirElaboracionKardex(
  elabId: string,
  client?: AdminClient,
): Promise<{ ok: boolean; error?: string; revertidos?: number }> {
  const admin = client ?? createAdminClient();
  const { data: elab } = await admin
    .from("elaboraciones")
    .select("id, empresa_id, estado")
    .eq("id", elabId)
    .maybeSingle();
  if (!elab) return { ok: false, error: "Esa elaboración ya no existe." };
  if (elab.estado !== "confirmado") {
    return { ok: false, error: "Solo se puede volver a borrador una elaboración confirmada." };
  }

  const { revertidos } = await revertirMovimientosPorDocumento(
    { empresaId: String(elab.empresa_id), documentoTipo: "elaboracion", documentoId: elabId },
    admin,
  );
  await admin
    .from("elaboraciones")
    .update({ estado: "borrador", updated_at: new Date().toISOString() })
    .eq("id", elabId);

  return { ok: true, revertidos };
}
