/**
 * Pasos del flujo de contratación que un cambio de estado MANUAL desde la ficha
 * del empleado no ejecuta.
 *
 * Contratar desde Reclutamiento lanza toda la cadena (alta a gestoría, contrato
 * a firmar, snapshot de condiciones, email de acceso…). Poner a alguien en
 * Activo a mano solo cambia una columna, así que estos pasos quedan pendientes y
 * hay que avisar de ellos: se guardan en el historial y se enseñan al confirmar.
 *
 * Vive en `data/` y no en la server action porque un archivo "use server" solo
 * puede exportar funciones async, y el cliente necesita leer estos textos.
 */
export const PASOS_OMITIDOS_ALTA = [
  { clave: "gestoria", texto: "No se ha comunicado el alta a la gestoría" },
  { clave: "contrato", texto: "No se ha generado ni enviado a firmar el contrato" },
  { clave: "condiciones", texto: "No se han registrado las condiciones (salario, jornada, convenio)" },
  { clave: "acceso", texto: "No se ha enviado el correo de acceso al sistema" },
  { clave: "horario", texto: "El horario recortado en la baja no se restaura solo" },
] as const;

export type PasoOmitido = (typeof PASOS_OMITIDOS_ALTA)[number]["clave"];

/** clave → texto legible. */
export const TEXTO_PASO_OMITIDO = new Map<string, string>(
  PASOS_OMITIDOS_ALTA.map((p) => [p.clave, p.texto]),
);
