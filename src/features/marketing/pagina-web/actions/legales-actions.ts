"use server";

/**
 * Server actions de páginas legales (privacidad, aviso legal, cookies).
 *
 * Las páginas legales NO se redactan a mano: se generan desde
 * `empresas.datos_generales` para que cualquier empresa nueva tenga sus tres
 * documentos correctos sin trabajo manual, y para que un cambio de domicilio o
 * de CIF en Ajustes se propague a todas las webs regenerando.
 *
 * Protocolo MEMORY.md: try/catch + logs en toda escritura.
 */
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { sanitizarHtml } from "../services/sanitize-html";
import {
  generarTextosLegales,
  TIPOS_PAGINA_LEGAL,
  type TipoPaginaLegal,
} from "../services/textos-legales";
import type { Bloque } from "../types";
import { friendlyError } from "@/shared/lib/friendly-errors";

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export interface ResumenPaginaLegal {
  tipo: TipoPaginaLegal;
  paginaId: string;
  nombre: string;
  slug: string;
  creada: boolean;
}

export interface ResultadoGenerarLegales {
  paginas: ResumenPaginaLegal[];
  /** Datos obligatorios que faltan en Ajustes. No bloquean el guardado. */
  avisos: string[];
}

function revalidar() {
  revalidatePath("/marketing/pagina-web");
}

function bloqueId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Vista previa de los textos sin escribir nada en base de datos.
 * La usa la UI para enseñar qué se va a generar y qué datos faltan.
 */
export async function previsualizarTextosLegales(): Promise<
  ActionResult<{ avisos: string[]; paginas: Array<{ tipo: TipoPaginaLegal; nombre: string; html: string }> }>
> {
  try {
    const { supabase, empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const { data: empresa, error } = await supabase
      .from("empresas")
      .select("datos_generales")
      .eq("id", empresaId)
      .maybeSingle();

    if (error) {
      console.error("[pagina-web][previsualizarTextosLegales]", error.message);
      return { ok: false, error: "No se pudieron leer los datos de la empresa." };
    }

    const { paginas, avisos } = generarTextosLegales(
      (empresa?.datos_generales ?? null) as Record<string, unknown> | null,
    );

    return {
      ok: true,
      data: {
        avisos,
        paginas: paginas.map((p) => ({ tipo: p.tipo, nombre: p.nombre, html: p.html })),
      },
    };
  } catch (err) {
    console.error("[pagina-web][previsualizarTextosLegales] fatal:", err);
    return { ok: false, error: friendlyError(err, "previsualizarTextosLegales") };
  }
}

/**
 * Crea (o actualiza) las páginas legales de la empresa activa.
 *
 * Es idempotente: si la página ya existe para ese `slug_interno`, se reescribe
 * su contenido en lugar de duplicarla. Las páginas se dejan siempre en BORRADOR
 * —publicar es un acto explícito del usuario, igual que en el resto del CMS.
 */
export async function generarPaginasLegales(
  tipos: TipoPaginaLegal[] = TIPOS_PAGINA_LEGAL,
): Promise<ActionResult<ResultadoGenerarLegales>> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const seleccion = tipos.filter((t) => TIPOS_PAGINA_LEGAL.includes(t));
    if (seleccion.length === 0) return { ok: false, error: "No se indicó ninguna página legal." };

    const { data: empresa, error: errEmpresa } = await supabase
      .from("empresas")
      .select("datos_generales")
      .eq("id", empresaId)
      .maybeSingle();

    if (errEmpresa) {
      console.error("[pagina-web][generarPaginasLegales] empresa:", errEmpresa.message);
      return { ok: false, error: "No se pudieron leer los datos de la empresa." };
    }

    const { paginas, avisos } = generarTextosLegales(
      (empresa?.datos_generales ?? null) as Record<string, unknown> | null,
      seleccion,
    );

    const resumen: ResumenPaginaLegal[] = [];

    for (const pagina of paginas) {
      const bloques: Bloque[] = [
        {
          id: bloqueId(),
          tipo: "texto_libre",
          orden: 0,
          visible: true,
          datos: { html_seguro: sanitizarHtml(pagina.html) },
        },
      ];

      const seo = {
        title: pagina.titulo,
        description: `${pagina.titulo} del sitio web.`,
        robots: "noindex, follow",
      };

      const { data: existente, error: errBuscar } = await supabase
        .from("paginas_web")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("slug_interno", pagina.slug)
        .maybeSingle();

      if (errBuscar) {
        console.error("[pagina-web][generarPaginasLegales] buscar:", errBuscar.message);
        return { ok: false, error: "No se pudo comprobar si la página ya existía." };
      }

      if (existente) {
        const { error: errUpdate } = await supabase
          .from("paginas_web")
          .update({
            bloques,
            seo,
            nombre: pagina.nombre,
            legal_tipo: pagina.tipo,
            legal_generada_at: new Date().toISOString(),
          })
          .eq("id", (existente as { id: string }).id)
          .eq("empresa_id", empresaId);

        if (errUpdate) {
          console.error("[pagina-web][generarPaginasLegales] update:", errUpdate.message);
          return { ok: false, error: `No se pudo actualizar «${pagina.nombre}».` };
        }

        resumen.push({
          tipo: pagina.tipo,
          paginaId: (existente as { id: string }).id,
          nombre: pagina.nombre,
          slug: pagina.slug,
          creada: false,
        });
        continue;
      }

      const { data: creada, error: errInsert } = await supabase
        .from("paginas_web")
        .insert({
          empresa_id: empresaId,
          tipo: "ONE_PAGE",
          nombre: pagina.nombre,
          slug_interno: pagina.slug,
          bloques,
          seo,
          estado: "BORRADOR",
          created_by: userId,
          legal_tipo: pagina.tipo,
          legal_generada_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (errInsert) {
        console.error("[pagina-web][generarPaginasLegales] insert:", errInsert.message);
        return { ok: false, error: `No se pudo crear «${pagina.nombre}».` };
      }

      resumen.push({
        tipo: pagina.tipo,
        paginaId: (creada as { id: string }).id,
        nombre: pagina.nombre,
        slug: pagina.slug,
        creada: true,
      });
    }

    revalidar();
    return { ok: true, data: { paginas: resumen, avisos } };
  } catch (err) {
    console.error("[pagina-web][generarPaginasLegales] fatal:", err);
    return { ok: false, error: friendlyError(err, "generarPaginasLegales") };
  }
}
