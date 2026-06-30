/**
 * Texto por defecto del «Contrato privado de trabajo» (contrato interno) y sus
 * placeholders. Módulo PLANO (sin `server-only`) para que lo usen tanto el
 * generador de PDF (servidor) como el editor de Plantillas → Documentos (cliente).
 *
 * Placeholders admitidos: {nombre}, {dni}, {puesto}, {empresa}, {ciudad},
 * {fecha} y {dni_clausula} (inserta ", con DNI/NIE X," o nada si no hay DNI).
 */

export const CONTRATO_INTERNO_DEFAULT = `EXPONEN

1. Que la empresa dispone de un Manual Operativo, el cual recoge las normas, protocolos, procedimientos y estándares que rigen el funcionamiento de todos los departamentos.

2. Que dicho manual constituye una guía clara y detallada sobre cómo deben llevarse a cabo las tareas, el comportamiento profesional esperado y los procedimientos internos, con el objetivo de garantizar la calidad, la eficiencia y el cumplimiento de los valores de la empresa.

3. Que, con independencia del tipo de contrato, puesto ocupado o condiciones salariales, todas las personas que trabajan en la empresa están sujetas a lo establecido en el Manual Operativo.

ACUERDAN

PRIMERO. La persona firmante declara haber recibido, leído y comprendido el Manual Operativo de la empresa, y se compromete expresamente a cumplir con todo lo que en él se establece.

SEGUNDO. Ambas partes acuerdan que el Manual Operativo tiene carácter vinculante, y que su contenido será la referencia principal en cuanto a normas, protocolos y procedimientos durante toda la relación laboral.

TERCERO. Este documento complementa, pero no sustituye, el contrato laboral firmado entre ambas partes. Se entiende como un compromiso adicional de respeto a la estructura y funcionamiento de la empresa.

CUARTO. La empresa se compromete igualmente a cumplir con lo establecido en dicho Manual Operativo, y a aplicarlo de forma coherente y justa en todos los niveles y puestos de trabajo.

QUINTO. En caso de modificación del Manual Operativo, la empresa se compromete a informar de forma clara a todo el personal, y a recabar nuevamente la aceptación de los cambios si estos fueran significativos.

Y en prueba de conformidad, la persona firmante firma el presente documento, declarando su compromiso con lo aquí expuesto.

Trabajador/a: {nombre}{dni_clausula}
Empresa: {empresa}`;

/** Sustituye los placeholders del cuerpo del contrato interno. */
export function sustituirContratoInterno(
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
