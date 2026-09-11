import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatosGenerales } from "@/features/ajustes/data/ajustes";

/**
 * QUIÉN ES LA EMPRESA en un documento laboral, en un solo sitio.
 *
 * Todo papel que firma un trabajador —contrato, sanción, baja, acta de entrega—
 * tiene que identificar al empleador por su **razón social, su NIF y su
 * domicilio fiscal**, no por el rótulo del local. «BACANAL» es el nombre
 * comercial; quien contrata y quien sanciona es «BACANAL SYSTEM S.L.».
 *
 * La fuente es **Ajustes → Empresa** (`empresas.datos_generales`), que es donde
 * se rellenan esos datos. Las columnas sueltas (`razon_social`, `nif`,
 * `direccion`) quedan como respaldo: son el mismo dato guardado por duplicado y
 * en algunas empresas están a medias.
 */
export interface IdentidadEmpresa {
  /** Nombre comercial: el rótulo. Para cabeceras, correos y avisos. */
  nombre: string;
  /** Sociedad que firma. Es el nombre que debe salir en el documento. */
  razonSocial: string;
  /** NIF/CIF de la sociedad. */
  cif: string | null;
  /** Domicilio fiscal completo, en una línea. */
  domicilio: string | null;
  /** Ciudad del domicilio fiscal: la que encabeza «En Fuenlabrada, a …». */
  ciudad: string | null;
  telefono: string | null;
  logoUrl: string | null;
  /** Isotipo si lo hay; si no, el logo. Es lo que va en las cabeceras. */
  marcaUrl: string | null;
  /** Zona horaria de la empresa: las horas de los documentos van en SU reloj. */
  zonaHoraria: string;
}

const ZONA_POR_DEFECTO = "Europe/Madrid";

function une(partes: (string | null | undefined)[], sep = ", "): string {
  return partes.map((p) => (p ?? "").trim()).filter(Boolean).join(sep);
}

function limpio(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

/** Ficha de identidad de la empresa para cualquier documento que la nombre. */
export async function getIdentidadEmpresa(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<IdentidadEmpresa> {
  const { data } = await supabase
    .from("empresas")
    .select("nombre, razon_social, nif, direccion, datos_generales, config_operativa, logo_url, isotipo_url")
    .eq("id", empresaId)
    .maybeSingle();

  const g = ((data?.datos_generales as Partial<DatosGenerales> | null) ?? {}) as Partial<DatosGenerales>;
  const nombre = limpio(g.nombreComercial) || limpio(data?.nombre) || "La empresa";
  const razonSocial = limpio(g.razonSocial) || limpio(data?.razon_social) || nombre;
  const cif = limpio(g.cif) || limpio(data?.nif);
  const domicilio =
    une([
      limpio(g.direccionFiscal),
      une([limpio(g.codigoPostal), limpio(g.ciudad)], " "),
      limpio(g.provincia) ? `(${limpio(g.provincia)})` : null,
    ]) || limpio(data?.direccion);

  const zonaHoraria =
    limpio((data?.config_operativa as Record<string, unknown> | null)?.zonaHoraria) || ZONA_POR_DEFECTO;

  return {
    nombre,
    razonSocial,
    cif,
    domicilio,
    ciudad: limpio(g.ciudad),
    telefono: limpio(g.telefonoPrincipal),
    logoUrl: limpio(data?.logo_url),
    marcaUrl: limpio(data?.isotipo_url) || limpio(data?.logo_url),
    zonaHoraria,
  };
}

/**
 * La empresa en una línea: «BACANAL SYSTEM S.L. · NIF B09654955 · C/ Leganés,
 * 51, 28945 Fuenlabrada (Madrid)». Lo que falte, no se inventa: se omite.
 */
export function identificacionEnUnaLinea(e: IdentidadEmpresa): string {
  return une([e.razonSocial, e.cif ? `NIF ${e.cif}` : null, e.domicilio], " · ");
}
