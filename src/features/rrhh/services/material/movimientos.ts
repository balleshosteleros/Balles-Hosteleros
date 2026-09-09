/**
 * La unica puerta por la que se escribe en el libro del almacen.
 *
 * POR QUE UNA SOLA PUERTA
 *   Los tres saldos (en almacen / en manos / total de la empresa) se calculan
 *   sumando este libro. Si cada sitio del codigo escribiera sus propias lineas,
 *   antes o despues alguien pondria los signos al reves y el almacen empezaria
 *   a mentir sin que nadie lo notara. Aqui los signos NO se pasan por parametro:
 *   se derivan de `deltasDe()` a partir del tipo de movimiento. Quien llama dice
 *   QUE ha pasado; los numeros los pone esta capa.
 *
 * ESCRIBE CON EL CLIENTE DE SERVICIO
 *   La tabla tiene RLS de lectura pero ninguna policy de escritura, a proposito:
 *   ningun usuario puede tocar el libro desde el navegador. Por eso aqui se usa
 *   el cliente admin, y por eso cada funcion comprueba ella misma la empresa.
 *
 * NADA SE EDITA NI SE BORRA
 *   Corregir es anadir la linea contraria (`revertirMovimientos`). Un libro que
 *   se puede reescribir no sirve como explicacion de por que faltan tres camisas.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  deltasDe,
  type TipoMovimiento,
  type UbicacionMaterial,
} from "@/features/rrhh/data/material-stock";
import type { CategoriaMaterial } from "@/features/rrhh/data/entregas";

/** Lo que hay que saber de la pieza que se mueve. */
export interface PiezaMovida {
  tipoId: string | null;
  /** Congelado en la fila: el libro sigue legible si se borra el tipo. */
  tipoNombre: string;
  categoria: CategoriaMaterial;
  talla: string | null;
}

export interface RegistrarMovimientoInput {
  empresaId: string;
  pieza: PiezaMovida;
  tipoMovimiento: TipoMovimiento;
  /** Siempre positivo. El signo lo pone `deltasDe()`. */
  unidades?: number;
  fecha?: string;
  /** Solo en `inicial`: si la pieza ya estaba puesta o estaba en la estanteria. */
  ubicacion?: UbicacionMaterial;
  /** Solo en `ajuste_recuento`: si sobraba (+) o faltaba (−). */
  signo?: 1 | -1;
  entregaId?: string | null;
  empleadoId?: string | null;
  recuentoId?: string | null;
  motivo?: string | null;
  proveedor?: string | null;
  documentoReferencia?: string | null;
  costeUnitario?: number | null;
  usuarioId?: string | null;
  usuarioNombre?: string | null;
}

export interface ResultadoMovimiento {
  ok: boolean;
  /** Ids de las lineas escritas. Vacio si no habia nada que escribir. */
  ids: string[];
  error?: string;
}

/**
 * Los movimientos que van atados a una entrega mueven exactamente una unidad,
 * porque una entrega ES una unidad (regla del modulo: tres camisetas son tres
 * entregas). Aceptar `unidades` ahi solo serviria para colar incoherencias.
 */
const MOVIMIENTOS_DE_UNA_UNIDAD: TipoMovimiento[] = [
  "entrega",
  "devolucion",
  "deterioro_trabajador",
  "no_devuelta",
];

/** Los que no tienen sentido sin explicacion escrita. */
const EXIGEN_MOTIVO: TipoMovimiento[] = [
  "deterioro_trabajador",
  "deterioro_almacen",
  "no_devuelta",
  "ajuste_recuento",
];

/**
 * Escribe un movimiento en el libro.
 *
 * Idempotente para lo que nace de una entrega: la base de datos tiene un indice
 * unico por (entrega, tipo de movimiento), asi que reintentar la firma de un
 * acta no descuenta la pieza dos veces. Si choca con ese indice se considera
 * exito silencioso: el hecho ya estaba grabado.
 */
export async function registrarMovimiento(
  input: RegistrarMovimientoInput,
): Promise<ResultadoMovimiento> {
  const {
    empresaId,
    pieza,
    tipoMovimiento,
    fecha,
    ubicacion,
    signo,
    entregaId = null,
    empleadoId = null,
    recuentoId = null,
    motivo = null,
    proveedor = null,
    documentoReferencia = null,
    costeUnitario = null,
    usuarioId = null,
    usuarioNombre = null,
  } = input;

  if (!empresaId) return { ok: false, ids: [], error: "Falta la empresa" };
  if (!pieza.tipoNombre) return { ok: false, ids: [], error: "Falta el tipo de material" };

  const unidades = MOVIMIENTOS_DE_UNA_UNIDAD.includes(tipoMovimiento)
    ? 1
    : Math.abs(Math.trunc(input.unidades ?? 1));

  if (unidades < 1) {
    return { ok: false, ids: [], error: "Las unidades tienen que ser al menos 1" };
  }
  if (EXIGEN_MOTIVO.includes(tipoMovimiento) && !motivo?.trim()) {
    return { ok: false, ids: [], error: "Hay que explicar el motivo" };
  }

  const { deltaAlmacen, deltaManos } = deltasDe(tipoMovimiento, unidades, {
    ubicacion,
    signo,
  });

  // El CHECK de la tabla ya lo impide, pero fallar aqui da un mensaje util en
  // vez de un error de base de datos: pasa cuando un ajuste sale a diferencia 0.
  if (deltaAlmacen === 0 && deltaManos === 0) {
    return { ok: true, ids: [] };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("material_movimientos")
    .insert({
      empresa_id: empresaId,
      tipo_id: pieza.tipoId,
      tipo_nombre: pieza.tipoNombre,
      categoria: pieza.categoria,
      talla: pieza.talla,
      fecha: fecha ?? new Date().toISOString().slice(0, 10),
      tipo_movimiento: tipoMovimiento,
      delta_almacen: deltaAlmacen,
      delta_manos: deltaManos,
      entrega_id: entregaId,
      empleado_id: empleadoId,
      recuento_id: recuentoId,
      motivo: motivo?.trim() || null,
      proveedor: proveedor?.trim() || null,
      documento_referencia: documentoReferencia?.trim() || null,
      coste_unitario: costeUnitario,
      created_by: usuarioId,
      created_por_nombre: usuarioNombre,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = el indice unico por entrega. El movimiento ya estaba grabado:
    // reintentar una firma no puede descontar la pieza otra vez.
    if (error.code === "23505") return { ok: true, ids: [] };
    return { ok: false, ids: [], error: error.message };
  }

  return { ok: true, ids: [data.id] };
}

/**
 * Deshace los movimientos de una entrega anadiendo la linea contraria de cada
 * uno. Se usa al borrar una entrega ya firmada: la pieza vuelve a donde estaba.
 *
 * No borra nada. Borrar la linea original dejaria el libro sin explicar por que
 * el saldo cambio, que es justo para lo que existe el libro.
 */
export async function revertirMovimientosDeEntrega(
  entregaId: string,
  opciones?: { usuarioId?: string | null; usuarioNombre?: string | null },
): Promise<ResultadoMovimiento> {
  if (!entregaId) return { ok: false, ids: [], error: "Falta la entrega" };

  const supabase = createAdminClient();

  const { data: originales, error } = await supabase
    .from("material_movimientos")
    .select(
      "id, empresa_id, tipo_id, tipo_nombre, categoria, talla, tipo_movimiento, delta_almacen, delta_manos, empleado_id",
    )
    .eq("entrega_id", entregaId)
    .is("revierte_a", null);

  if (error) return { ok: false, ids: [], error: error.message };
  if (!originales?.length) return { ok: true, ids: [] };

  // Las que ya tienen su reversion no se revierten otra vez.
  const { data: yaRevertidos } = await supabase
    .from("material_movimientos")
    .select("revierte_a")
    .eq("entrega_id", entregaId)
    .not("revierte_a", "is", null);

  const revertidos = new Set((yaRevertidos ?? []).map((r) => r.revierte_a as string));
  const pendientes = originales.filter((m) => !revertidos.has(m.id));
  if (!pendientes.length) return { ok: true, ids: [] };

  const hoy = new Date().toISOString().slice(0, 10);
  const filas = pendientes.map((m) => ({
    empresa_id: m.empresa_id,
    tipo_id: m.tipo_id,
    tipo_nombre: m.tipo_nombre,
    categoria: m.categoria,
    talla: m.talla,
    fecha: hoy,
    tipo_movimiento: m.tipo_movimiento,
    // La linea contraria: mismos numeros con el signo cambiado.
    delta_almacen: -m.delta_almacen,
    delta_manos: -m.delta_manos,
    entrega_id: entregaId,
    empleado_id: m.empleado_id,
    revierte_a: m.id,
    motivo: "Se anuló la entrega",
    created_by: opciones?.usuarioId ?? null,
    created_por_nombre: opciones?.usuarioNombre ?? null,
  }));

  const { data: insertadas, error: errorInsert } = await supabase
    .from("material_movimientos")
    .insert(filas)
    .select("id");

  if (errorInsert) return { ok: false, ids: [], error: errorInsert.message };

  return { ok: true, ids: (insertadas ?? []).map((f) => f.id) };
}

/**
 * Lee los tres saldos de una pieza concreta. Lo usan las validaciones que
 * quieren avisar de que se esta entregando algo que no hay en la estanteria.
 */
export async function saldoDePieza(
  empresaId: string,
  tipoId: string | null,
  talla: string | null,
): Promise<{ enAlmacen: number; enManos: number; totalEmpresa: number }> {
  const supabase = createAdminClient();

  let consulta = supabase
    .from("material_saldos")
    .select("en_almacen, en_manos, total_empresa")
    .eq("empresa_id", empresaId)
    .eq("talla_clave", talla ?? "");

  consulta = tipoId ? consulta.eq("tipo_id", tipoId) : consulta.is("tipo_id", null);

  const { data } = await consulta.maybeSingle();

  return {
    enAlmacen: data?.en_almacen ?? 0,
    enManos: data?.en_manos ?? 0,
    totalEmpresa: data?.total_empresa ?? 0,
  };
}
