"use server";

/**
 * Crea la web prototipo de la empresa activa.
 *
 * No pide datos al usuario: los lee del software (Ajustes, Carta, Empleo,
 * Reseñas, fotos ya subidas) y monta los bloques. El usuario solo elige qué
 * módulos quiere.
 */

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/supabase/get-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generarBloquesPrototipo,
  generarBrandingPrototipo,
  generarSeoPrototipo,
  moduloDisponible,
  MODULOS_WEB,
  type DatosEmpresaWeb,
  type ModuloWeb,
} from "../services/prototipo-web";

type Result<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

const BUCKET_ASSETS = "paginas-web-assets";

/**
 * Reúne todo lo que el generador necesita leyendo el software.
 * Exportado para que la pantalla previa pueda decir qué módulos están
 * disponibles ANTES de crear nada.
 */
async function reunirDatosEmpresa(empresaId: string): Promise<DatosEmpresaWeb | null> {
  const admin = createAdminClient();

  const { data: emp } = await admin
    .from("empresas")
    .select(
      "nombre, slug, empleo_slug, carta_slug, carta_publicada, logo_url, isotipo_url, color, color_secundario, datos_generales",
    )
    .eq("id", empresaId)
    .maybeSingle();
  if (!emp) return null;

  const dg = ((emp.datos_generales as Record<string, string | undefined> | null) ?? {});
  const tieneAlgunaRed = Boolean(
    (dg.instagram ?? "").trim() || (dg.facebook ?? "").trim() || (dg.tiktok ?? "").trim(),
  );

  // Reseñas reales ya sincronizadas de Google. Solo las buenas y CON texto:
  // una reseña de 5 estrellas sin comentario no dice nada en una web.
  const { data: resenas } = await admin
    .from("resenas")
    .select("nombre_comensal, comentario, rating")
    .eq("empresa_id", empresaId)
    .gte("rating", 4)
    .not("comentario", "is", null)
    .order("fecha_reseña", { ascending: false })
    .limit(20);

  const testimonios = ((resenas ?? []) as Array<{
    nombre_comensal: string | null;
    comentario: string | null;
    rating: number | null;
  }>)
    .filter((r) => (r.comentario ?? "").trim().length > 20)
    .slice(0, 6)
    .map((r) => ({
      nombre: r.nombre_comensal ?? "Cliente",
      texto: (r.comentario ?? "").trim(),
      ...(r.rating ? { estrellas: r.rating } : {}),
    }));

  // Fotos ya subidas al bucket de esta empresa. Se recorre un nivel de
  // subcarpetas porque las migraciones dejan las imágenes agrupadas
  // (p. ej. "<empresa>/migracion-ghl/foto.jpg"), no sueltas en la raíz.
  const fotos: Array<{ url: string; alt: string }> = [];
  const esImagen = (n: string) => /\.(jpe?g|png|webp|avif)$/i.test(n);
  const añadir = (ruta: string) => {
    const { data: pub } = admin.storage.from(BUCKET_ASSETS).getPublicUrl(ruta);
    fotos.push({ url: pub.publicUrl, alt: emp.nombre as string });
  };

  const { data: raiz } = await admin.storage
    .from(BUCKET_ASSETS)
    .list(empresaId, { limit: 100, sortBy: { column: "name", order: "asc" } });

  for (const f of raiz ?? []) {
    if (esImagen(f.name)) {
      añadir(`${empresaId}/${f.name}`);
      continue;
    }
    // Sin extensión = carpeta: miramos dentro.
    if (f.name.includes(".")) continue;
    const { data: dentro } = await admin.storage
      .from(BUCKET_ASSETS)
      .list(`${empresaId}/${f.name}`, { limit: 100, sortBy: { column: "name", order: "asc" } });
    for (const g of dentro ?? []) {
      if (esImagen(g.name)) añadir(`${empresaId}/${f.name}/${g.name}`);
    }
  }

  const horarioGeneral = (dg.horarioGeneral ?? "").trim();

  return {
    nombre: (emp.nombre as string) ?? "Restaurante",
    slug: (emp.slug as string | null) ?? null,
    empleoSlug: (emp.empleo_slug as string | null) ?? null,
    cartaSlug: (emp.carta_slug as string | null) ?? null,
    cartaPublicada: Boolean(emp.carta_publicada),
    logoUrl: (emp.logo_url as string | null) ?? (emp.isotipo_url as string | null) ?? null,
    color: (emp.color as string | null) ?? null,
    colorSecundario: (emp.color_secundario as string | null) ?? null,
    direccion: (dg.direccionLocal ?? dg.direccionFiscal ?? "").trim() || null,
    telefono: (dg.telefonoPrincipal ?? "").trim() || null,
    email: (dg.correoReservas ?? dg.correoGerencia ?? "").trim() || null,
    ciudad: (dg.ciudad ?? "").trim() || null,
    tieneAlgunaRed,
    testimonios,
    fotos,
    fotoPortada: fotos[0]?.url ?? null,
    horarios: horarioGeneral ? horarioGeneral.split("\n").filter(Boolean) : [],
  };
}

export interface ModuloEstado {
  clave: ModuloWeb;
  label: string;
  descripcion: string;
  pordefecto: boolean;
  disponible: boolean;
  /** Por qué no está disponible, para explicarlo en la UI. */
  motivo: string | null;
}

const MOTIVOS: Record<string, string> = {
  carta: "La empresa no tiene carta digital configurada.",
  reservas: "La empresa no tiene identificador (slug).",
  empleo: "La empresa no tiene portal de empleo configurado.",
  inspecciones: "La empresa no tiene identificador (slug).",
  redes: "No hay ninguna red social en Ajustes → Datos generales.",
  testimonios: "Todavía no hay reseñas de Google sincronizadas.",
  galeria: "No hay fotos subidas para esta empresa.",
  mapa: "La empresa no tiene dirección en Ajustes.",
};

/** Estado de cada módulo para pintar la pantalla de creación. */
export async function estadoModulosPrototipo(): Promise<Result<ModuloEstado[]>> {
  try {
    const { empresaId } = await getAppContext();
    if (!empresaId) return { ok: false, error: "Sin empresa." };

    const datos = await reunirDatosEmpresa(empresaId);
    if (!datos) return { ok: false, error: "No se pudo leer la empresa." };

    return {
      ok: true,
      data: MODULOS_WEB.map((m) => {
        const disponible = moduloDisponible(m.clave, datos);
        return {
          clave: m.clave,
          label: m.label,
          descripcion: m.descripcion,
          pordefecto: m.pordefecto,
          disponible,
          motivo: disponible ? null : (MOTIVOS[m.clave] ?? "Faltan datos en el software."),
        };
      }),
    };
  } catch (err) {
    console.error("[pagina-web][estadoModulosPrototipo]", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function crearWebPrototipo(
  modulos: ModuloWeb[],
  nombrePagina = "Web principal",
): Promise<Result<{ paginaId: string }>> {
  try {
    const { supabase, empresaId, userId } = await getAppContext();
    if (!empresaId || !userId) return { ok: false, error: "Sin empresa." };

    const datos = await reunirDatosEmpresa(empresaId);
    if (!datos) return { ok: false, error: "No se pudo leer la empresa." };

    const bloques = generarBloquesPrototipo(modulos, datos);
    if (!bloques.length) {
      return { ok: false, error: "Selecciona al menos un módulo." };
    }

    // Slug único dentro de la empresa: si ya hay una "principal", numeramos.
    const { data: existentes } = await supabase
      .from("paginas_web")
      .select("slug_interno")
      .eq("empresa_id", empresaId);
    const usados = new Set(
      ((existentes ?? []) as Array<{ slug_interno: string }>).map((p) => p.slug_interno),
    );
    let slug = "principal";
    let n = 2;
    while (usados.has(slug)) slug = `principal-${n++}`;

    const { data, error } = await supabase
      .from("paginas_web")
      .insert({
        empresa_id: empresaId,
        tipo: "WEB_PRINCIPAL",
        nombre: nombrePagina,
        slug_interno: slug,
        bloques,
        branding: generarBrandingPrototipo(datos),
        seo: generarSeoPrototipo(datos),
        estado: "BORRADOR",
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[pagina-web][crearWebPrototipo]", error.message);
      return { ok: false, error: "No se pudo crear la web." };
    }

    revalidatePath("/marketing/pagina-web");
    return { ok: true, data: { paginaId: data.id as string } };
  } catch (err) {
    console.error("[pagina-web][crearWebPrototipo] fatal:", err);
    return { ok: false, error: "Error inesperado." };
  }
}
