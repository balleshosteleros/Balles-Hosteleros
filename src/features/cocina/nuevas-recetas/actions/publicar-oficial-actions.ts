"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import type { ActionResult } from "../types";

/**
 * Publica oficialmente una receta:
 * 1. Crea registro en `fichas_tecnicas` con los datos del borrador
 * 2. Copia los ingredientes a `ingredientes_ficha` (con prioridad)
 * 3. Crea productos de compra en `productos` para los ingredientes sin producto_id
 * 4. Vincula la receta con la ficha oficial y marca estado_general = aprobada
 */
export async function publicarOficial(
  recetaId: string,
): Promise<ActionResult<{ ficha_tecnica_id: string; productos_creados: number }>> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    // 1. Leer receta + ingredientes + compras
    const [recetaRes, ingRes, compraRes] = await Promise.all([
      supabase.from("nuevas_recetas").select("*").eq("id", recetaId).single(),
      supabase.from("nueva_receta_ingrediente").select("*").eq("receta_id", recetaId),
      supabase.from("nueva_receta_compra").select("*").eq("receta_id", recetaId),
    ]);

    if (recetaRes.error || !recetaRes.data) throw recetaRes.error ?? new Error("Receta no encontrada");
    const receta = recetaRes.data;
    const ingredientes = ingRes.data ?? [];
    const compras = compraRes.data ?? [];

    // 2. Crear ficha técnica oficial (o actualizar si ya había)
    let fichaId = receta.ficha_tecnica_id as string | null;

    if (fichaId) {
      // Actualizar
      await supabase
        .from("fichas_tecnicas")
        .update({
          nombre: receta.nombre,
          descripcion: receta.ft_descripcion,
          elaboracion: receta.ft_elaboracion,
          partida: receta.ft_partida,
          porciones: receta.ft_porciones,
          tiempo_preparacion: receta.ft_tiempo_preparacion,
          alergenos: receta.ft_alergenos ?? [],
          etiquetas: receta.ft_etiquetas_finales ?? [],
          pvp: receta.ft_pvp_propuesto ?? 0,
          coste_total: receta.ft_coste_estimado ?? 0,
          estado: "Activa",
          origen_receta_id: receta.id,
        })
        .eq("id", fichaId);
    } else {
      const { data: ficha, error: fErr } = await supabase
        .from("fichas_tecnicas")
        .insert({
          empresa_id: empresaId,
          nombre: receta.nombre,
          descripcion: receta.ft_descripcion,
          elaboracion: receta.ft_elaboracion,
          partida: receta.ft_partida,
          porciones: receta.ft_porciones ?? 1,
          tiempo_preparacion: receta.ft_tiempo_preparacion,
          alergenos: receta.ft_alergenos ?? [],
          etiquetas: receta.ft_etiquetas_finales ?? [],
          pvp: receta.ft_pvp_propuesto ?? 0,
          coste_total: receta.ft_coste_estimado ?? 0,
          estado: "Activa",
          origen_receta_id: receta.id,
          created_by: userId,
        })
        .select("id")
        .single();
      if (fErr) throw fErr;
      fichaId = ficha.id as string;
    }

    // 3a. PRIMERO: resolver ingredientes propuestos → crear productos de compra si faltan
    //     (así luego al copiar a ingredientes_ficha ya tienen producto_id)
    let productosCreados = 0;
    for (const ing of ingredientes) {
      if (ing.producto_id) continue;
      const nombre = (ing.nombre_libre as string | null)?.trim();
      if (!nombre) continue;

      // Ya existe con ese nombre?
      const { data: existing } = await supabase
        .from("productos")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("nombre", nombre)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("nueva_receta_ingrediente")
          .update({ producto_id: existing.id })
          .eq("id", ing.id);
        ing.producto_id = existing.id;
        continue;
      }

      const { data: nuevo, error: pErr } = await supabase
        .from("productos")
        .insert({
          empresa_id: empresaId,
          nombre,
          tipo: "Compra",
          categoria: "Sin categoría",
          unidad: (ing.unidad as string) ?? "g",
          estado: "Activo",
          created_by: userId,
        })
        .select("id")
        .single();
      if (pErr) {
        console.warn("[publicar-oficial] no pudo crear producto ingrediente:", pErr.message);
        continue;
      }
      await supabase
        .from("nueva_receta_ingrediente")
        .update({ producto_id: nuevo.id })
        .eq("id", ing.id);
      ing.producto_id = nuevo.id;
      productosCreados++;
    }

    // 3b. Copiar ingredientes a la ficha (borramos los anteriores si actualizando)
    await supabase.from("ingredientes_ficha").delete().eq("ficha_id", fichaId);

    if (ingredientes.length > 0) {
      const rows = ingredientes.map((ing, idx) => ({
        ficha_id: fichaId,
        producto_id: ing.producto_id,
        nombre: (ing.nombre_libre as string) || "Ingrediente",
        cantidad: ing.cantidad ?? 0,
        unidad: ing.unidad ?? "g",
        prioridad: ing.prioridad,
        orden: idx,
      }));
      const { error: ingErr } = await supabase.from("ingredientes_ficha").insert(rows);
      if (ingErr) throw ingErr;
    }

    // 4. Resolver compras propuestas (nueva_receta_compra sin producto_id)
    for (const compra of compras) {
      if (compra.producto_id) continue;
      if (!compra.producto_nombre_propuesto) continue;

      const { data: existing } = await supabase
        .from("productos")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("nombre", compra.producto_nombre_propuesto as string)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("nueva_receta_compra")
          .update({ producto_id: existing.id })
          .eq("id", compra.id);
        continue;
      }

      const { data: nuevo, error: pErr } = await supabase
        .from("productos")
        .insert({
          empresa_id: empresaId,
          nombre: compra.producto_nombre_propuesto as string,
          tipo: "Compra",
          categoria: "Sin categoría",
          unidad: (compra.unidad as string) ?? "kg",
          estado: "Activo",
          created_by: userId,
        })
        .select("id")
        .single();
      if (pErr) {
        console.warn("[publicar-oficial] no pudo crear producto compra:", pErr.message);
        continue;
      }
      await supabase
        .from("nueva_receta_compra")
        .update({ producto_id: nuevo.id })
        .eq("id", compra.id);
      productosCreados++;
    }

    // 5. Vincular y marcar aprobada
    await supabase
      .from("nuevas_recetas")
      .update({
        ficha_tecnica_id: fichaId,
        estado_general: "aprobada",
      })
      .eq("id", recetaId);

    return {
      ok: true,
      data: { ficha_tecnica_id: fichaId, productos_creados: productosCreados },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    console.error("[publicar-oficial]", msg);
    return { ok: false, error: msg };
  }
}

/**
 * Añade la receta aprobada a Carta Digital.
 * Crea un item en carta_digital_items apuntando a la ficha técnica.
 */
export async function anadirACartaDigital(recetaId: string): Promise<ActionResult> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa" };

    const { data: receta } = await supabase
      .from("nuevas_recetas")
      .select("nombre, ft_descripcion, ft_pvp_propuesto, ficha_tecnica_id")
      .eq("id", recetaId)
      .single();
    if (!receta?.ficha_tecnica_id) {
      return { ok: false, error: "Debes publicar oficial antes de añadir a carta" };
    }

    // Buscar primera categoría de la empresa
    const { data: cat } = await supabase
      .from("carta_digital_categorias")
      .select("id")
      .eq("empresa_id", empresaId)
      .order("orden", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("carta_digital_items").insert({
      empresa_id: empresaId,
      categoria_id: cat?.id ?? null,
      nombre: receta.nombre,
      descripcion: receta.ft_descripcion,
      precio: receta.ft_pvp_propuesto ?? 0,
      ficha_tecnica_id: receta.ficha_tecnica_id,
      visible: true,
    });
    if (error) throw error;

    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
