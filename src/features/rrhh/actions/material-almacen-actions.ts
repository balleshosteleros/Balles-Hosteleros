"use server";

/**
 * Almacen de uniforme y material: lectura de los tres saldos, del libro de
 * movimientos, y las dos entradas manuales (material nuevo y bajas por rotura
 * en la estanteria).
 *
 * Lo que mueve una ENTREGA no se escribe aqui: eso lo dispara la firma del acta
 * (ver `services/material/movimientos.ts`). Aqui solo vive lo que RRHH hace a
 * mano sobre el almacen.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/supabase/get-context";
import { registrarMovimiento, saldoDePieza } from "@/features/rrhh/services/material/movimientos";
import type {
  MovimientoMaterial,
  SaldoMaterial,
  TipoMovimiento,
} from "@/features/rrhh/data/material-stock";
import type { CategoriaMaterial } from "@/features/rrhh/data/entregas";

/** El libro crece sin techo y Supabase corta en 1000: se pagina siempre. */
const MOVIMIENTOS_POR_PAGINA = 100;

function mensajeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Error desconocido";
}

async function nombreUsuarioActual(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("usuarios")
    .select("nombre, apellidos, full_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return "";
  const u = data as {
    nombre: string | null;
    apellidos: string | null;
    full_name: string | null;
    email: string | null;
  };
  const compuesto = `${u.nombre ?? ""} ${u.apellidos ?? ""}`.trim();
  return compuesto || u.full_name || u.email || "";
}

// ------------------------------------------------------------------
// Lectura
// ------------------------------------------------------------------

type FilaSaldo = {
  tipo_id: string | null;
  tipo_nombre: string;
  categoria: string;
  talla: string | null;
  en_almacen: number;
  en_manos: number;
  total_empresa: number;
};

/**
 * Los tres numeros por pieza, con el ultimo recuento que la conto.
 *
 * Solo aparecen las piezas que han tenido algun movimiento: un tipo del catalogo
 * que nunca se ha comprado ni entregado no tiene nada que contar todavia.
 */
export async function listSaldosMaterial(): Promise<SaldoMaterial[]> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return [];
  const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

  const { data, error } = await db
    .from("material_saldos")
    .select("tipo_id, tipo_nombre, categoria, talla, en_almacen, en_manos, total_empresa")
    .eq("empresa_id", empresaId);

  if (error) {
    console.error("[rrhh] listSaldosMaterial:", error.message);
    return [];
  }

  const saldos = (data ?? []) as FilaSaldo[];
  if (saldos.length === 0) return [];

  // El ultimo recuento CONFIRMADO que incluyo cada pieza, para poder enseñar
  // cuando se conto por ultima vez y que descuadre salio.
  const { data: recuentos } = await db
    .from("material_recuentos")
    .select("id, fecha, material_recuentos_lineas(tipo_id, talla, diferencia)")
    .eq("empresa_id", empresaId)
    .eq("estado", "confirmado")
    .order("fecha", { ascending: false })
    .limit(50);

  type FilaRecuento = {
    fecha: string;
    material_recuentos_lineas: {
      tipo_id: string | null;
      talla: string | null;
      diferencia: number;
    }[] | null;
  };

  const ultimo = new Map<string, { fecha: string; diferencia: number }>();
  for (const r of (recuentos ?? []) as FilaRecuento[]) {
    for (const linea of r.material_recuentos_lineas ?? []) {
      const clave = `${linea.tipo_id ?? ""}|${linea.talla ?? ""}`;
      // Van ordenados de mas nuevo a mas viejo: el primero que llega es el bueno.
      if (!ultimo.has(clave)) {
        ultimo.set(clave, { fecha: r.fecha, diferencia: linea.diferencia });
      }
    }
  }

  return saldos
    .map((s) => {
      const recuento = ultimo.get(`${s.tipo_id ?? ""}|${s.talla ?? ""}`);
      return {
        tipoId: s.tipo_id,
        tipoNombre: s.tipo_nombre,
        categoria: s.categoria as CategoriaMaterial,
        talla: s.talla,
        enAlmacen: s.en_almacen,
        enManos: s.en_manos,
        totalEmpresa: s.total_empresa,
        ultimoRecuento: recuento?.fecha ?? null,
        ultimoDescuadre: recuento?.diferencia ?? null,
      };
    })
    .sort((a, b) => {
      if (a.categoria !== b.categoria) return a.categoria === "uniforme" ? -1 : 1;
      const porNombre = a.tipoNombre.localeCompare(b.tipoNombre, "es");
      if (porNombre !== 0) return porNombre;
      return (a.talla ?? "").localeCompare(b.talla ?? "", "es");
    });
}

type FilaMovimiento = {
  id: string;
  tipo_id: string | null;
  tipo_nombre: string;
  categoria: string;
  talla: string | null;
  fecha: string;
  tipo_movimiento: string;
  delta_almacen: number;
  delta_manos: number;
  entrega_id: string | null;
  empleado_id: string | null;
  motivo: string | null;
  observaciones: string | null;
  proveedor: string | null;
  documento_referencia: string | null;
  coste_unitario: number | null;
  revierte_a: string | null;
  created_por_nombre: string | null;
  created_at: string;
};

/** El libro, de lo mas reciente a lo mas antiguo. Paginado. */
export async function listMovimientosMaterial(
  pagina = 0,
): Promise<{ movimientos: MovimientoMaterial[]; hayMas: boolean }> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return { movimientos: [], hayMas: false };
  const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

  const desde = Math.max(0, pagina) * MOVIMIENTOS_POR_PAGINA;
  // Se pide uno de mas para saber si queda pagina siguiente, sin contar el total.
  const hasta = desde + MOVIMIENTOS_POR_PAGINA;

  const { data, error } = await db
    .from("material_movimientos")
    .select(
      "id, tipo_id, tipo_nombre, categoria, talla, fecha, tipo_movimiento, delta_almacen, delta_manos, entrega_id, empleado_id, motivo, observaciones, proveedor, documento_referencia, coste_unitario, revierte_a, created_por_nombre, created_at",
    )
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .range(desde, hasta);

  if (error) {
    console.error("[rrhh] listMovimientosMaterial:", error.message);
    return { movimientos: [], hayMas: false };
  }

  const filas = (data ?? []) as FilaMovimiento[];
  const hayMas = filas.length > MOVIMIENTOS_POR_PAGINA;
  const visibles = hayMas ? filas.slice(0, MOVIMIENTOS_POR_PAGINA) : filas;

  // Nombre del trabajador en los movimientos que vienen de una entrega.
  const empleadoIds = [...new Set(visibles.map((f) => f.empleado_id).filter(Boolean))] as string[];
  const nombres = new Map<string, string>();
  if (empleadoIds.length) {
    const { data: empleados } = await db
      .from("empleados")
      .select("id, nombre, apellidos")
      .in("id", empleadoIds);
    for (const e of (empleados ?? []) as {
      id: string;
      nombre: string | null;
      apellidos: string | null;
    }[]) {
      nombres.set(e.id, `${e.nombre ?? ""} ${e.apellidos ?? ""}`.trim());
    }
  }

  return {
    movimientos: visibles.map((f) => ({
      id: f.id,
      tipoId: f.tipo_id,
      tipoNombre: f.tipo_nombre,
      categoria: f.categoria as CategoriaMaterial,
      talla: f.talla,
      fecha: f.fecha,
      tipoMovimiento: f.tipo_movimiento as TipoMovimiento,
      deltaAlmacen: f.delta_almacen,
      deltaManos: f.delta_manos,
      entregaId: f.entrega_id,
      empleadoId: f.empleado_id,
      empleadoNombre: f.empleado_id ? nombres.get(f.empleado_id) ?? null : null,
      motivo: f.motivo,
      observaciones: f.observaciones,
      proveedor: f.proveedor,
      documentoReferencia: f.documento_referencia,
      costeUnitario: f.coste_unitario,
      revierteA: f.revierte_a,
      creadoPorNombre: f.created_por_nombre,
      createdAt: f.created_at,
    })),
    hayMas,
  };
}

// ------------------------------------------------------------------
// Escritura manual
// ------------------------------------------------------------------

/**
 * Regla de Iban (10-09-2026): en el almacen TODOS los campos son obligatorios
 * menos las observaciones. Un albaran sin proveedor ni numero no se puede
 * reclamar despues, y sin coste no se sabe cuanto vale lo que se pierde.
 */
const entradaSchema = z.object({
  tipoId: z.string().uuid("Elige un tipo de material"),
  talla: z.string().trim().max(20).nullable(),
  unidades: z.number().int("Las unidades son números enteros").min(1, "Al menos una unidad"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  proveedor: z.string().trim().min(1, "Pon el proveedor").max(200),
  documentoReferencia: z.string().trim().min(1, "Pon el nº de albarán o factura").max(100),
  costeUnitario: z.number("Pon el coste por unidad").min(0, "El coste no puede ser negativo"),
  observaciones: z.string().trim().max(1000).nullable(),
});

export type EntradaMaterialInput = z.infer<typeof entradaSchema>;

/**
 * Entra material nuevo al almacen. Sube lo que hay en la estanteria y el total
 * de la empresa: es la unica forma junto al saldo inicial de que aparezca
 * material que antes no existia.
 */
export async function registrarEntradaMaterial(input: EntradaMaterialInput) {
  try {
    const parsed = entradaSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
    }

    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const tipo = await cargarTipo(db, empresaId, parsed.data.tipoId);
    if (!tipo) return { ok: false as const, error: "Ese tipo de material no existe" };
    if (tipo.requiereTalla && !parsed.data.talla) {
      return { ok: false as const, error: `Indica la talla de ${tipo.nombre.toLowerCase()}` };
    }

    const res = await registrarMovimiento({
      empresaId,
      pieza: {
        tipoId: tipo.id,
        tipoNombre: tipo.nombre,
        categoria: tipo.categoria,
        talla: tipo.requiereTalla ? parsed.data.talla : null,
      },
      tipoMovimiento: "compra",
      unidades: parsed.data.unidades,
      fecha: parsed.data.fecha,
      proveedor: parsed.data.proveedor,
      documentoReferencia: parsed.data.documentoReferencia,
      costeUnitario: parsed.data.costeUnitario,
      observaciones: parsed.data.observaciones,
      usuarioId: userId,
      usuarioNombre: await nombreUsuarioActual(db, userId),
    });
    if (!res.ok) return { ok: false as const, error: res.error ?? "No se pudo registrar" };

    revalidatePath("/rrhh/entregas");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

const bajaSchema = z.object({
  tipoId: z.string().uuid("Elige un tipo de material"),
  talla: z.string().trim().max(20).nullable(),
  unidades: z.number().int("Las unidades son números enteros").min(1, "Al menos una unidad"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  motivo: z.string().trim().min(1, "Explica por qué se da de baja").max(500),
  observaciones: z.string().trim().max(1000).nullable(),
});

export type BajaAlmacenInput = z.infer<typeof bajaSchema>;

/**
 * Da de baja material que se ha estropeado EN LA ESTANTERIA. No hay acta que
 * firmar: no hay trabajador de por medio. Baja el almacen y el total.
 */
export async function registrarBajaAlmacen(input: BajaAlmacenInput) {
  try {
    const parsed = bajaSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
    }

    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const tipo = await cargarTipo(db, empresaId, parsed.data.tipoId);
    if (!tipo) return { ok: false as const, error: "Ese tipo de material no existe" };

    const talla = tipo.requiereTalla ? parsed.data.talla : null;

    // No se puede dar de baja lo que no hay: dejaria el almacen en negativo y
    // el descuadre pasaria a ser un misterio en vez de un dato.
    const saldo = await saldoDePieza(empresaId, tipo.id, talla);
    if (parsed.data.unidades > saldo.enAlmacen) {
      return {
        ok: false as const,
        error:
          saldo.enAlmacen > 0
            ? `Solo hay ${saldo.enAlmacen} en el almacén`
            : "No queda ninguna en el almacén",
      };
    }

    const res = await registrarMovimiento({
      empresaId,
      pieza: {
        tipoId: tipo.id,
        tipoNombre: tipo.nombre,
        categoria: tipo.categoria,
        talla,
      },
      tipoMovimiento: "deterioro_almacen",
      unidades: parsed.data.unidades,
      fecha: parsed.data.fecha,
      motivo: parsed.data.motivo,
      observaciones: parsed.data.observaciones,
      usuarioId: userId,
      usuarioNombre: await nombreUsuarioActual(db, userId),
    });
    if (!res.ok) return { ok: false as const, error: res.error ?? "No se pudo registrar" };

    revalidatePath("/rrhh/entregas");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/** El tipo del catalogo, comprobando que es de esta empresa. */
async function cargarTipo(
  db: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  tipoId: string,
): Promise<{ id: string; nombre: string; categoria: CategoriaMaterial; requiereTalla: boolean } | null> {
  const { data } = await db
    .from("entregas_tipos_material")
    .select("id, nombre, categoria, requiere_talla")
    .eq("id", tipoId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!data) return null;
  const t = data as {
    id: string;
    nombre: string;
    categoria: string;
    requiere_talla: boolean | null;
  };
  return {
    id: t.id,
    nombre: t.nombre,
    categoria: (t.categoria === "uniforme" ? "uniforme" : "material") as CategoriaMaterial,
    requiereTalla: !!t.requiere_talla,
  };
}
