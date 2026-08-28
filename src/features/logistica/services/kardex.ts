import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { signoDeTipo, type DocumentoTipo, type TipoMovimiento } from "@/features/logistica/data/kardex";
import { getCosteEnFecha } from "@/features/logistica/services/coste-producto";

/**
 * Servicio del kardex de stock (PRP-057).
 *
 * Fuente de verdad del histórico = tabla `stock_movimientos`. `stock.cantidad_actual`
 * se mantiene como saldo materializado (rápido para listados) y se actualiza en cada
 * movimiento. `saldo_resultante` se guarda como foto del saldo tras aplicar el movimiento.
 *
 * Pensado para llamarse desde acciones server / crons con el cliente service role
 * (la escritura de stock_movimientos no tiene policy para usuarios).
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export interface RegistrarMovimientoInput {
  empresaId: string;
  productoId: string;
  tipo: TipoMovimiento;
  cantidad: number; // valor absoluto, >= 0
  referencia?: string | null;
  documentoTipo: DocumentoTipo;
  documentoId?: string | null;
  origenLineaId?: string | null;
  motivo?: string | null;
  createdBy?: string | null;
  fecha?: string; // ISO; default NOW() en BD
  /**
   * Rechaza el movimiento si dejaría el saldo por debajo de cero, en vez de
   * registrarlo. Solo para las salidas que APUNTA UNA PERSONA en el momento
   * (mermas): ahí un saldo negativo significa que se ha tecleado de más y se
   * puede avisar antes de guardar.
   *
   * NO se usa en ventas ni recepciones: esas son hechos ya ocurridos, y
   * negarse a registrarlas escondería el problema real (stock sin dar de alta)
   * además de romper el cron. Ahí el negativo es el síntoma, no la causa.
   */
  impedirNegativo?: boolean;
  /**
   * Coste por UNIDAD DE STOCK en el momento del movimiento. Se guarda **congelado**: el
   * historial debe seguir diciendo lo que costó, no lo que cuesta hoy.
   *
   * Si no se pasa, se resuelve solo desde el histórico de precios de compra a la fecha del
   * movimiento (`getCostesEnFecha`). Pásalo cuando el documento ya lo sepa mejor — un
   * albarán conoce el precio exacto de esa entrega — y ojo entonces con la unidad: si la
   * línea viene en cajas de 12, el coste unitario es el de LA UNIDAD, no el de la caja.
   */
  costeUnitario?: number | null;
}

export interface MovimientoResultado {
  saldoAnterior: number;
  saldoResultante: number;
  duplicado: boolean; // true si el origen ya estaba registrado (idempotencia)
  omitido?: boolean; // true si el producto no controla stock (no se registró nada)
  /** true si `impedirNegativo` frenó el movimiento: no se registró nada. */
  rechazado?: boolean;
}

/** Lee el saldo actual del producto (0 si no tiene fila de stock todavía). */
async function leerSaldo(
  admin: AdminClient,
  empresaId: string,
  productoId: string,
): Promise<{ saldo: number; existeFila: boolean }> {
  const { data } = await admin
    .from("stock")
    .select("cantidad_actual")
    .eq("empresa_id", empresaId)
    .eq("producto_id", productoId)
    .maybeSingle();
  if (!data) return { saldo: 0, existeFila: false };
  return { saldo: Number(data.cantidad_actual ?? 0), existeFila: true };
}

/** Crea o actualiza la fila de stock con el nuevo saldo. */
async function aplicarSaldo(
  admin: AdminClient,
  empresaId: string,
  productoId: string,
  nuevoSaldo: number,
  existeFila: boolean,
  fechaISO: string,
): Promise<void> {
  if (existeFila) {
    await admin
      .from("stock")
      .update({ cantidad_actual: nuevoSaldo, ultimo_movimiento: fechaISO })
      .eq("empresa_id", empresaId)
      .eq("producto_id", productoId);
    return;
  }
  // No había fila de stock: la creamos copiando nombre/unidad del producto.
  const { data: prod } = await admin
    .from("productos")
    .select("nombre, unidad:medida")
    .eq("id", productoId)
    .maybeSingle();
  await admin.from("stock").insert({
    empresa_id: empresaId,
    producto_id: productoId,
    producto_nombre: prod?.nombre ?? null,
    cantidad_actual: nuevoSaldo,
    unidad: prod?.unidad ?? null,
    ultimo_movimiento: fechaISO,
  });
}

/**
 * Registra un movimiento de stock y actualiza el saldo materializado.
 * Idempotente: si ya existe un movimiento con el mismo (origen_linea_id, producto_id),
 * no hace nada y devuelve `duplicado: true`.
 */
export async function registrarMovimiento(
  input: RegistrarMovimientoInput,
  client?: AdminClient,
): Promise<MovimientoResultado> {
  const admin = client ?? createAdminClient();
  const fechaISO = input.fecha ?? new Date().toISOString();
  const signo = signoDeTipo(input.tipo);
  const cantidad = Math.abs(Number(input.cantidad));

  // Candado "Controlar stock": si el producto tiene controla_stock=false, NO se
  // registra movimiento ni se toca el stock (ni entradas ni salidas). El histórico
  // previo se conserva (solo se congela). Centralizado aquí → cubre todos los caminos.
  const { data: prodCtrl } = await admin
    .from("productos")
    .select("controla_stock")
    .eq("id", input.productoId)
    .maybeSingle();
  if (prodCtrl && prodCtrl.controla_stock === false) {
    const { saldo } = await leerSaldo(admin, input.empresaId, input.productoId);
    return { saldoAnterior: saldo, saldoResultante: saldo, duplicado: false, omitido: true };
  }

  // Guardia de idempotencia por origen.
  if (input.origenLineaId) {
    const { data: existente } = await admin
      .from("stock_movimientos")
      .select("saldo_resultante")
      .eq("origen_linea_id", input.origenLineaId)
      .eq("producto_id", input.productoId)
      .maybeSingle();
    if (existente) {
      return {
        saldoAnterior: Number(existente.saldo_resultante) - signo * cantidad,
        saldoResultante: Number(existente.saldo_resultante),
        duplicado: true,
      };
    }
  }

  const { saldo: saldoAnterior, existeFila } = await leerSaldo(admin, input.empresaId, input.productoId);
  const saldoResultante = saldoAnterior + signo * cantidad;

  // Freno para las salidas apuntadas a mano: no se puede sacar del almacén más
  // de lo que hay. Sin esto, mermar 5 de algo que tiene 2,4 dejaba el saldo en
  // -2,6 sin decir nada (caso real de Larios Rose, 27-ago) — y así es como se
  // fabrican los stocks negativos que luego falsean la reposición.
  if (input.impedirNegativo && saldoResultante < 0) {
    return { saldoAnterior, saldoResultante: saldoAnterior, duplicado: false, rechazado: true };
  }

  // Coste congelado: lo que costaba ESE DÍA, no lo que cueste cuando se mire el historial.
  // Si el documento no lo aporta, se busca en el histórico de precios a la fecha del
  // movimiento. `null` significa "no se sabe" y se guarda como tal: un 0 sería mentira.
  let costeUnitario = input.costeUnitario ?? null;
  if (costeUnitario == null) {
    costeUnitario = await getCosteEnFecha(admin, input.productoId, fechaISO);
  }
  const valorTotal = costeUnitario == null ? null : costeUnitario * cantidad;

  await admin.from("stock_movimientos").insert({
    empresa_id: input.empresaId,
    producto_id: input.productoId,
    fecha: fechaISO,
    tipo: input.tipo,
    cantidad,
    signo,
    saldo_resultante: saldoResultante,
    coste_unitario: costeUnitario,
    valor_total: valorTotal,
    referencia: input.referencia ?? null,
    documento_tipo: input.documentoTipo,
    documento_id: input.documentoId ?? null,
    origen_linea_id: input.origenLineaId ?? null,
    motivo: input.motivo ?? null,
    created_by: input.createdBy ?? null,
  });

  await aplicarSaldo(admin, input.empresaId, input.productoId, saldoResultante, existeFila, fechaISO);

  return { saldoAnterior, saldoResultante, duplicado: false };
}

/**
 * Revierte TODOS los movimientos de un documento (p. ej. al reprocesar un día de
 * ventas o anular una recepción): devuelve el efecto al stock y borra los movimientos.
 * Tras esto se puede volver a registrar sin duplicar.
 */
export async function revertirMovimientosPorDocumento(
  args: { empresaId: string; documentoTipo: DocumentoTipo; documentoId: string },
  client?: AdminClient,
): Promise<{ revertidos: number }> {
  const admin = client ?? createAdminClient();
  const { data: movs } = await admin
    .from("stock_movimientos")
    .select("id, producto_id, cantidad, signo")
    .eq("empresa_id", args.empresaId)
    .eq("documento_tipo", args.documentoTipo)
    .eq("documento_id", args.documentoId);

  if (!movs || movs.length === 0) return { revertidos: 0 };

  const fechaISO = new Date().toISOString();
  for (const m of movs as { id: string; producto_id: string; cantidad: number; signo: number }[]) {
    const { saldo, existeFila } = await leerSaldo(admin, args.empresaId, m.producto_id);
    // Deshacer el efecto: restar lo que en su día se aplicó (signo * cantidad).
    const nuevoSaldo = saldo - m.signo * Number(m.cantidad);
    await aplicarSaldo(admin, args.empresaId, m.producto_id, nuevoSaldo, existeFila, fechaISO);
  }

  await admin
    .from("stock_movimientos")
    .delete()
    .eq("empresa_id", args.empresaId)
    .eq("documento_tipo", args.documentoTipo)
    .eq("documento_id", args.documentoId);

  return { revertidos: movs.length };
}
