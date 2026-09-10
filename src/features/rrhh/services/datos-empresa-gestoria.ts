/**
 * Lo que la gestoría necesita saber, además de los datos de la persona, para dar
 * de alta a un trabajador. Son DOS cosas distintas y no se mezclan:
 *
 *   • DATOS FISCALES → de la sociedad que firma el contrato: quién es y con qué
 *     CIF. Salen de Ajustes → Empresa (`empresas.datos_generales`).
 *
 *   • CENTRO DE TRABAJO → del LOCAL donde va a trabajar: dónde está, qué es, en
 *     qué cuenta de cotización entra y bajo qué convenio. Salen de `locales`,
 *     porque son del centro y no de la sociedad: dos locales de la misma
 *     empresa tienen CCC distinto, y si están en provincias distintas también
 *     convenio distinto, porque el de hostelería es provincial.
 *
 * Fuente única para las dos vistas del mismo dato: las tarjetas del correo a la
 * gestoría y los botones de Gestoría → Contrataciones. Funciones puras, sin
 * dependencias de servidor: el correo las llama con lo que lee de BD y la
 * pantalla con lo que ya tiene en memoria.
 */

import type { DatosGenerales } from "@/features/ajustes/data/ajustes";

export interface CampoGestoria {
  label: string;
  value: string;
}

/** Local, con lo justo para componer la ficha del centro de trabajo. */
export interface LocalParaGestoria {
  nombre?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  codigo_postal?: string | null;
  ccc?: string | null;
  tipo_establecimiento?: string | null;
  clase_restaurante?: string | null;
  convenio?: string | null;
}

/** Junta las partes no vacías con un separador, sin dejar comas huérfanas. */
function une(partes: (string | null | undefined)[], sep = ", "): string {
  return partes
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(sep);
}

/** Un campo sin rellenar sale con «—»: la gestoría debe ver que falta. */
function conHuecos(filas: CampoGestoria[]): CampoGestoria[] {
  return filas.map((f) => ({ ...f, value: f.value.trim() || "—" }));
}

/**
 * Datos FISCALES de la sociedad: la empresa que contrata.
 *
 * @param d      Datos generales de la empresa (Ajustes → Empresa).
 * @param nombre Nombre de la empresa en el sistema, por si no hay comercial.
 */
export function camposFiscalesEmpresa(
  d: Partial<DatosGenerales> | null | undefined,
  nombre?: string,
): CampoGestoria[] {
  const g = d ?? {};
  return conHuecos([
    { label: "Nombre comercial", value: (g.nombreComercial || "").trim() || (nombre ?? "") },
    { label: "Empresa titular", value: (g.razonSocial || "").trim() },
    { label: "CIF", value: (g.cif || "").trim() },
    {
      label: "Domicilio fiscal",
      value: une([g.direccionFiscal, une([g.codigoPostal, g.ciudad], " ")]),
    },
    { label: "Epígrafe IAE", value: (g.epigrafeIae || "").trim() },
  ]);
}

/**
 * Datos del CENTRO DE TRABAJO: el local donde entra el trabajador.
 *
 * Sin local (una vacante antigua que no lo pedía, o un empleado sin asignar) no
 * se inventa nada: se devuelve la ficha con todo a «—» para que se vea el hueco.
 */
export function camposCentroTrabajo(
  local: LocalParaGestoria | null | undefined,
): CampoGestoria[] {
  const l = local ?? {};
  return conHuecos([
    { label: "Centro de trabajo", value: (l.nombre || "").trim() },
    {
      label: "Dirección",
      value: une([l.direccion, une([l.codigo_postal, l.ciudad], " ")]),
    },
    { label: "Municipio y provincia", value: une([l.ciudad, l.provincia]) },
    { label: "CCC aplicable", value: (l.ccc || "").trim() },
    { label: "Tipo de establecimiento", value: (l.tipo_establecimiento || "").trim() },
    { label: "Clase del restaurante", value: (l.clase_restaurante || "").trim() },
    { label: "Convenio aplicable", value: (l.convenio || "").trim() },
  ]);
}

/** Etiquetas de los campos que están sin rellenar. Vacío = ficha completa. */
export function faltantesGestoria(campos: CampoGestoria[]): string[] {
  return campos.filter((f) => f.value === "—").map((f) => f.label);
}
