"use server";

/**
 * Recuento fisico del almacen de uniforme.
 *
 * Contar lo que hay de verdad en la estanteria y enfrentarlo a lo que dice el
 * sistema. El descuadre no es un error que haya que esconder: es el dato. Una
 * empresa siempre tiene alguna de mas o de menos, y saber cuantas y de que es
 * lo que permite dejar de comprar a ciegas.
 *
 * EL TEORICO SE CONGELA AL ABRIR. Si se leyera al confirmar, una entrega hecha
 * mientras se cuenta cambiaria el saldo y el descuadre saldria falso.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAppContext } from "@/lib/supabase/get-context";
import { registrarMovimiento } from "@/features/rrhh/services/material/movimientos";
import { listSaldosMaterial } from "./material-almacen-actions";
import type { CategoriaMaterial } from "@/features/rrhh/data/entregas";

export type EstadoRecuento = "abierto" | "confirmado" | "anulado";

export interface LineaRecuento {
  id: string;
  tipoId: string | null;
  tipoNombre: string;
  talla: string | null;
  teoricoAlmacen: number;
  /** Null = todavia sin contar. */
  contadoAlmacen: number | null;
  diferencia: number;
  nota: string | null;
}

export interface Recuento {
  id: string;
  fecha: string;
  nombre: string | null;
  estado: EstadoRecuento;
  nota: string | null;
  confirmadoEn: string | null;
  confirmadoPorNombre: string | null;
  lineas: LineaRecuento[];
}

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
  return `${u.nombre ?? ""} ${u.apellidos ?? ""}`.trim() || u.full_name || u.email || "";
}

type FilaLinea = {
  id: string;
  tipo_id: string | null;
  tipo_nombre: string;
  talla: string | null;
  teorico_almacen: number;
  contado_almacen: number | null;
  diferencia: number;
  nota: string | null;
};

type FilaRecuento = {
  id: string;
  fecha: string;
  nombre: string | null;
  estado: string;
  nota: string | null;
  confirmado_en: string | null;
  confirmado_por_nombre: string | null;
  material_recuentos_lineas: FilaLinea[] | null;
};

function mapRecuento(r: FilaRecuento): Recuento {
  return {
    id: r.id,
    fecha: r.fecha,
    nombre: r.nombre,
    estado: r.estado as EstadoRecuento,
    nota: r.nota,
    confirmadoEn: r.confirmado_en,
    confirmadoPorNombre: r.confirmado_por_nombre,
    lineas: (r.material_recuentos_lineas ?? [])
      .map((l) => ({
        id: l.id,
        tipoId: l.tipo_id,
        tipoNombre: l.tipo_nombre,
        talla: l.talla,
        teoricoAlmacen: l.teorico_almacen,
        contadoAlmacen: l.contado_almacen,
        diferencia: l.diferencia,
        nota: l.nota,
      }))
      .sort((a, b) => {
        const porNombre = a.tipoNombre.localeCompare(b.tipoNombre, "es");
        if (porNombre !== 0) return porNombre;
        return (a.talla ?? "").localeCompare(b.talla ?? "", "es");
      }),
  };
}

const SELECT_RECUENTO =
  "id, fecha, nombre, estado, nota, confirmado_en, confirmado_por_nombre, material_recuentos_lineas(id, tipo_id, tipo_nombre, talla, teorico_almacen, contado_almacen, diferencia, nota)";

/** Los recuentos de la empresa, del mas reciente al mas antiguo. */
export async function listRecuentos(): Promise<Recuento[]> {
  const { supabase, empresaId } = await getAppContext();
  if (!empresaId) return [];
  const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

  const { data, error } = await db
    .from("material_recuentos")
    .select(SELECT_RECUENTO)
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[rrhh] listRecuentos:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as FilaRecuento[]).map(mapRecuento);
}

/**
 * Abre un recuento con una linea por pieza que tenga saldo en el almacen, con
 * el teorico ya congelado.
 *
 * Solo puede haber uno abierto a la vez: contar dos veces en paralelo produce
 * dos ajustes sobre el mismo saldo y el segundo corrige un descuadre que el
 * primero ya arreglo.
 */
export async function abrirRecuento(nombre?: string) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data: abierto } = await db
      .from("material_recuentos")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("estado", "abierto")
      .maybeSingle();
    if (abierto) {
      return { ok: false as const, error: "Ya hay un recuento abierto. Ciérralo antes de empezar otro." };
    }

    const saldos = await listSaldosMaterial();
    // Se cuenta lo que puede estar en la estanteria. Lo que solo esta en manos
    // de la gente no se cuenta aqui: eso se comprueba pieza a pieza en su ficha.
    const aContar = saldos.filter((s) => s.enAlmacen !== 0);
    if (aContar.length === 0) {
      return { ok: false as const, error: "No hay nada en el almacén que contar" };
    }

    const { data: cabecera, error } = await db
      .from("material_recuentos")
      .insert({
        empresa_id: empresaId,
        nombre: nombre?.trim() || null,
        estado: "abierto",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    const recuentoId = (cabecera as { id: string }).id;

    const { error: errorLineas } = await db.from("material_recuentos_lineas").insert(
      aContar.map((s) => ({
        recuento_id: recuentoId,
        tipo_id: s.tipoId,
        tipo_nombre: s.tipoNombre,
        talla: s.talla,
        teorico_almacen: s.enAlmacen,
      })),
    );
    if (errorLineas) throw errorLineas;

    revalidatePath("/rrhh/entregas");
    return { ok: true as const, recuentoId };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

const conteoSchema = z.object({
  lineaId: z.string().uuid(),
  contado: z.number().int("Cuenta en unidades enteras").min(0, "No puede ser negativo").nullable(),
});

/** Apunta lo que hay de verdad en la estanteria de una linea. */
export async function guardarConteo(input: z.infer<typeof conteoSchema>) {
  try {
    const parsed = conteoSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dato no válido" };
    }

    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    // La linea tiene que ser de un recuento ABIERTO de esta empresa: un recuento
    // confirmado ya genero sus ajustes y cambiarlo dejaria el libro mintiendo.
    const { data: linea } = await db
      .from("material_recuentos_lineas")
      .select("id, material_recuentos!inner(empresa_id, estado)")
      .eq("id", parsed.data.lineaId)
      .maybeSingle();

    const cab = (linea as { material_recuentos?: { empresa_id: string; estado: string } } | null)
      ?.material_recuentos;
    if (!cab || cab.empresa_id !== empresaId) {
      return { ok: false as const, error: "Esa línea no existe" };
    }
    if (cab.estado !== "abierto") {
      return { ok: false as const, error: "El recuento ya está cerrado" };
    }

    const { error } = await db
      .from("material_recuentos_lineas")
      .update({ contado_almacen: parsed.data.contado })
      .eq("id", parsed.data.lineaId);
    if (error) throw error;

    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/**
 * Cierra el recuento y ajusta el almacen: por cada linea que no cuadra se
 * escribe un movimiento con la diferencia. A partir de ahi el sistema dice lo
 * mismo que la estanteria.
 *
 * Las lineas sin contar se dejan estar: no contar algo no significa que falte.
 */
export async function confirmarRecuento(recuentoId: string) {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data, error } = await db
      .from("material_recuentos")
      .select(SELECT_RECUENTO)
      .eq("id", recuentoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false as const, error: "Ese recuento no existe" };

    const recuento = mapRecuento(data as unknown as FilaRecuento);
    if (recuento.estado !== "abierto") {
      return { ok: false as const, error: "Este recuento ya está cerrado" };
    }

    const contadas = recuento.lineas.filter((l) => l.contadoAlmacen !== null);
    if (contadas.length === 0) {
      return { ok: false as const, error: "Todavía no has contado nada" };
    }

    const usuarioNombre = await nombreUsuarioActual(db, userId);
    const descuadres = contadas.filter((l) => l.diferencia !== 0);

    // La categoria no viaja en la linea del recuento: se lee del catalogo para
    // que el movimiento quede bien clasificado en el libro.
    const tipoIds = [...new Set(descuadres.map((l) => l.tipoId).filter(Boolean))] as string[];
    const categorias = new Map<string, CategoriaMaterial>();
    if (tipoIds.length) {
      const { data: tipos } = await db
        .from("entregas_tipos_material")
        .select("id, categoria")
        .in("id", tipoIds);
      for (const t of (tipos ?? []) as { id: string; categoria: string }[]) {
        categorias.set(t.id, (t.categoria === "uniforme" ? "uniforme" : "material") as CategoriaMaterial);
      }
    }

    let ajustes = 0;
    for (const linea of descuadres) {
      const res = await registrarMovimiento({
        empresaId,
        recuentoId,
        pieza: {
          tipoId: linea.tipoId,
          tipoNombre: linea.tipoNombre,
          categoria: (linea.tipoId ? categorias.get(linea.tipoId) : undefined) ?? "material",
          talla: linea.talla,
        },
        tipoMovimiento: "ajuste_recuento",
        unidades: Math.abs(linea.diferencia),
        signo: linea.diferencia > 0 ? 1 : -1,
        fecha: recuento.fecha,
        motivo:
          linea.diferencia > 0
            ? `Sobraban ${linea.diferencia} al contar${linea.nota ? `: ${linea.nota}` : ""}`
            : `Faltaban ${Math.abs(linea.diferencia)} al contar${linea.nota ? `: ${linea.nota}` : ""}`,
        usuarioId: userId,
        usuarioNombre,
      });
      if (!res.ok) {
        return {
          ok: false as const,
          error: `No se pudo ajustar ${linea.tipoNombre}: ${res.error}. El recuento sigue abierto.`,
        };
      }
      ajustes += 1;
    }

    const { error: errorCierre } = await db
      .from("material_recuentos")
      .update({
        estado: "confirmado",
        confirmado_en: new Date().toISOString(),
        confirmado_por: userId,
        confirmado_por_nombre: usuarioNombre,
      })
      .eq("id", recuentoId)
      .eq("empresa_id", empresaId);
    if (errorCierre) throw errorCierre;

    revalidatePath("/rrhh/entregas");
    return { ok: true as const, ajustes };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}

/** Descarta un recuento sin tocar el almacen. */
export async function anularRecuento(recuentoId: string) {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false as const, error: "No autenticado" };
    const db = supabase as unknown as Awaited<ReturnType<typeof createClient>>;

    const { data: actual } = await db
      .from("material_recuentos")
      .select("estado")
      .eq("id", recuentoId)
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (!actual) return { ok: false as const, error: "Ese recuento no existe" };
    if ((actual as { estado: string }).estado === "confirmado") {
      return { ok: false as const, error: "Un recuento confirmado ya ha ajustado el almacén" };
    }

    const { error } = await db
      .from("material_recuentos")
      .update({ estado: "anulado" })
      .eq("id", recuentoId)
      .eq("empresa_id", empresaId);
    if (error) throw error;

    revalidatePath("/rrhh/entregas");
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: mensajeError(err) };
  }
}
