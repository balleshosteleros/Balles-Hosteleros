/**
 * Texto por defecto del «Reconocimiento médico» y sus placeholders. Módulo PLANO
 * (sin `server-only`) para que lo usen tanto el generador de PDF (servidor) como
 * el editor de Plantillas → Documentos (cliente).
 *
 * El documento informa al trabajador de su DERECHO a la vigilancia de la salud
 * (reconocimiento médico) y de que su realización es VOLUNTARIA. El trabajador
 * firma dejando constancia de que ha sido informado y de su decisión.
 *
 * Placeholders admitidos: {nombre}, {dni}, {puesto}, {empresa}, {ciudad},
 * {fecha} y {dni_clausula} (inserta ", con DNI/NIE X," o nada si no hay DNI).
 */

export const RECONOCIMIENTO_MEDICO_DEFAULT = `Habiendo sido informado/a del derecho a la vigilancia de la salud que ostento como empleado/a de la empresa {empresa}, para prevenir los riesgos derivados de la actividad laboral y la posibilidad de someterme a un examen de salud específico, para tal fin y por el que se determinan las medidas de protección necesarias para evitar o minimizar los presuntos riesgos, manifiesto que:

He sido informado/a de que dicho reconocimiento médico es decisión del trabajador si hacerlo o no, sin tener ninguna obligación por su parte, pero sí de la nuestra como empresa, informarle por si quisiera hacérselo, brindándole dicha facilidad para el trámite.

En cumplimiento de la Ley Orgánica 15/1999, de 13 de Diciembre, de Protección de Datos de Carácter personal (LOPD), los ficheros o datos sobre trabajadores, clientes, proveedores, etc., cuya custodia corresponda al empresario y a los que tenga acceso la empresa en razón de la prestación de los servicios contratados, son confidenciales.

Y para que conste y surta los efectos oportunos, se firma el presente documento en {ciudad}, a {fecha}.

Trabajador/a: {nombre}{dni_clausula}
Empresa: {empresa}`;

/** Sustituye los placeholders del cuerpo del reconocimiento médico. */
export function sustituirReconocimientoMedico(
  plantilla: string,
  vars: { nombre: string; dni: string | null; empresa: string; puesto: string | null; ciudad: string | null; fecha: string },
): string {
  const dniClausula = vars.dni ? `, con DNI/NIE ${vars.dni},` : "";
  return plantilla
    .replace(/\{nombre\}/g, vars.nombre)
    .replace(/\{dni_clausula\}/g, dniClausula)
    .replace(/\{dni\}/g, vars.dni ?? "—")
    .replace(/\{empresa\}/g, vars.empresa)
    .replace(/\{puesto\}/g, vars.puesto ?? "—")
    .replace(/\{ciudad\}/g, vars.ciudad ?? "—")
    .replace(/\{fecha\}/g, vars.fecha);
}
