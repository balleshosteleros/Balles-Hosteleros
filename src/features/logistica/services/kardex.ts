import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { signoDeTipo, type DocumentoTipo, type TipoMovimiento } from "@/features/logistica/data/kardex";
import { getCosteEnFecha } from "@/features/logistica/services/coste-producto";
import {
  AlmacenCerradoError,
  assertAlmacenAbierto,
  esErrorAlmacenCerrado,
  getCierreVigente,
} from "@/features/logistica/services/cierre-almacen";

/**
 * Servicio del kardex de stock (PRP-057, revisado en PRP-080 Fase 2).
 *
 * Fuente de verdad del histórico = tabla `stock_movimientos`. `stock.cantidad_actual`
 * es el saldo materializado (rápido para listados).
 *
 * QUIÉN CALCULA EL SALDO: **la base de datos**, no este archivo. Al insertar, borrar o
 * cambiar un movimiento, un trigger reencadena todos los saldos de ese producto en
 * orden real y deja `stock.cantidad_actual` cuadrado. Antes se hacía aquí, sumando al
 * saldo vivo, y por eso un movimiento con fecha atrasada (un albarán de la semana
 * pasada, las ventas de Ágora que llegan al día siguiente) quedaba con el saldo de HOY
 * metido en medio del histórico de entonces.
 *
 * ANCLAS: un inventario o un ajuste no suman ni restan, **dicen cuánto hay**. Se pasan
 * con `saldoFijado` y el recálculo deduce solo la cantidad y el signo.
 *
 * CIERRE DE ALMACÉN: un trigger rechaza cualquier escritura anterior al corte vigente.
 * Aquí se comprueba antes para poder avisar en condiciones (ver `cierre-almacen.ts`).
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
  /**
   * ANCLA: este movimiento no suma ni resta, **fija** el saldo del producto a este
   * valor. Es lo que son de verdad un inventario ("el día X había 12") y un ajuste
   * ("déjalo en 12"). El recálculo deduce solo la cantidad y el signo de la resta con
   * el saldo anterior, así que si luego aparece un albarán con fecha anterior, el
   * recuento sigue mandando en vez de descuadrarse.
   */
  saldoFijado?: number | null;
}

export interface MovimientoResultado {
  saldoAnterior: number;
  saldoResultante: number;
  duplicado: boolean; // true si el origen ya estaba registrado (idempotencia)
  omitido?: boolean; // true si el producto no controla stock (no se registró nada)
  /** true si `impedirNegativo` frenó el movimiento: no se registró nada. */
  rechazado?: boolean;
  /** true si el almacén está cerrado a esa fecha: no se registró nada. */
  rechazadoPorCierre?: boolean;
  /** Motivo del rechazo, listo para enseñar. */
  mensaje?: string;
}

/** Lee el saldo actual del producto (0 si no tiene fila de stock todavía). */
async function leerSaldo(
  admin: AdminClient,
  empresaId: string,
  productoId: string,
): Promise<{ saldo: number }> {
  const { data } = await admin
    .from("stock")
    .select("cantidad_actual")
    .eq("empresa_id", empresaId)
    .eq("producto_id", productoId)
    .maybeSingle();
  return { saldo: data ? Number(data.cantidad_actual ?? 0) : 0 };
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

  // Almacén cerrado: se comprueba ANTES de escribir nada. El trigger lo impediría
  // igualmente, pero así el aviso llega con un mensaje decente y los procesos de
  // varias filas (un inventario, una elaboración) no se quedan a medias.
  const corte = await getCierreVigente(admin, input.empresaId);
  if (corte && new Date(fechaISO).getTime() < new Date(corte).getTime()) {
    const { saldo } = await leerSaldo(admin, input.empresaId, input.productoId);
    let mensaje = "El almacén está cerrado a esa fecha.";
    try {
      await assertAlmacenAbierto(admin, input.empresaId, fechaISO);
    } catch (err) {
      if (err instanceof AlmacenCerradoError) mensaje = err.message;
    }
    return {
      saldoAnterior: saldo,
      saldoResultante: saldo,
      duplicado: false,
      rechazadoPorCierre: true,
      mensaje,
    };
  }

  const { saldo: saldoAnterior } = await leerSaldo(admin, input.empresaId, input.productoId);
  // Un ancla DICE el saldo; un movimiento normal lo mueve. (Ojo: el saldo definitivo
  // lo pone el recálculo al encadenar el histórico; esto es solo lo que se ve desde
  // aquí, que coincide salvo que el movimiento venga con fecha atrasada.)
  const esAncla = input.saldoFijado != null;
  const saldoResultante = esAncla ? Number(input.saldoFijado) : saldoAnterior + signo * cantidad;

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

  const { error: errIns } = await admin.from("stock_movimientos").insert({
    empresa_id: input.empresaId,
    producto_id: input.productoId,
    fecha: fechaISO,
    tipo: input.tipo,
    cantidad,
    signo,
    saldo_resultante: saldoResultante,
    saldo_fijado: input.saldoFijado ?? null,
    coste_unitario: costeUnitario,
    valor_total: valorTotal,
    referencia: input.referencia ?? null,
    documento_tipo: input.documentoTipo,
    documento_id: input.documentoId ?? null,
    origen_linea_id: input.origenLineaId ?? null,
    motivo: input.motivo ?? null,
    created_by: input.createdBy ?? null,
  });
  if (errIns) {
    if (esErrorAlmacenCerrado(errIns)) {
      return {
        saldoAnterior,
        saldoResultante: saldoAnterior,
        duplicado: false,
        rechazadoPorCierre: true,
        mensaje: (errIns as { message?: string }).message ?? "El almacén está cerrado a esa fecha.",
      };
    }
    throw errIns;
  }

  // El saldo definitivo lo ha dejado el recálculo (trigger). Se relee en vez de
  // devolver el que calculamos aquí: si el movimiento venía con fecha atrasada, o si
  // había un ancla por medio, el bueno es el de la base de datos.
  const { saldo: saldoFinal } = await leerSaldo(admin, input.empresaId, input.productoId);

  return { saldoAnterior, saldoResultante: saldoFinal, duplicado: false };
}

/**
 * Borra TODOS los movimientos de un documento (p. ej. al reprocesar un día de ventas
 * o anular una recepción). Tras esto se puede volver a registrar sin duplicar.
 *
 * Ya no toca `stock` a mano: el recálculo repara los saldos al borrar. Antes actualizaba
 * el stock fila a fila y borraba después, así que si el borrado fallaba a mitad —lo que
 * ahora pasa cuando el período está cerrado— dejaba las existencias movidas sin haber
 * borrado nada.
 *
 * Si alguno de los movimientos cae en período cerrado, **no borra ninguno** y lanza
 * `AlmacenCerradoError`: deshacer medio documento sería peor que no deshacerlo.
 */
export async function revertirMovimientosPorDocumento(
  args: { empresaId: string; documentoTipo: DocumentoTipo; documentoId: string },
  client?: AdminClient,
): Promise<{ revertidos: number }> {
  const admin = client ?? createAdminClient();
  const { data: movs } = await admin
    .from("stock_movimientos")
    .select("id, fecha")
    .eq("empresa_id", args.empresaId)
    .eq("documento_tipo", args.documentoTipo)
    .eq("documento_id", args.documentoId);

  if (!movs || movs.length === 0) return { revertidos: 0 };

  // El más antiguo manda: si ese está cerrado, el documento entero es intocable.
  const masAntigua = (movs as { fecha: string }[])
    .map((m) => m.fecha)
    .sort()[0];
  await assertAlmacenAbierto(admin, args.empresaId, masAntigua);

  const { error } = await admin
    .from("stock_movimientos")
    .delete()
    .eq("empresa_id", args.empresaId)
    .eq("documento_tipo", args.documentoTipo)
    .eq("documento_id", args.documentoId);
  if (error) {
    if (esErrorAlmacenCerrado(error)) {
      throw new AlmacenCerradoError(
        (error as { message?: string }).message ?? "El almacén está cerrado a esa fecha.",
      );
    }
    throw error;
  }

  return { revertidos: movs.length };
}
