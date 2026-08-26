/**
 * NORMA: un puesto NO puede existir con datos incompletos.
 *
 * Al contratar, las condiciones del puesto se copian al empleado
 * (`empleado_condiciones`) y de ahí viajan al contrato y a la gestoría. Un
 * puesto a medias metía al empleado en el sistema con esos mismos huecos:
 * salario 0, sin horas, sin días libres, sin convenio. Por eso la validación
 * está aquí y no en el formulario: es la MISMA función la que usan la pantalla
 * (para avisar antes de guardar) y las acciones de servidor (para que no entre
 * nada incompleto por ninguna otra vía).
 *
 * Vale para crear y para editar: un puesto ya creado tampoco se puede vaciar.
 *
 * Sin dependencias de servidor a propósito: se importa desde cliente y servidor.
 */

/** Campos que debe traer un puesto para considerarse completo. */
export interface PuestoCompletoInput {
  nombre: string;
  departamentoId: string;
  descripcion: string;
  convenioColectivo: string;
  validadorDepartamentoId: string | null;
  /** Cronograma de tareas vinculado (rol). */
  cronogramaRol: string | null;
  salarioBruto: number;
  jornadaContrato: string;
  horasSemanales: number;
  diasLibres: number;
  vacaciones: string;
  observaciones: string;
  objetivos: string[];
  /**
   * true al crear un puesto nuevo. El cronograma 1:1 del puesto se crea solo en
   * ese momento (`createPuesto`), así que todavía no existe para poder elegirlo:
   * no se exige. Al editar sí, porque ya está creado.
   */
  esNuevo?: boolean;
}

/** Campos del formulario (`esNuevo` es contexto de la llamada, no un campo). */
export type CampoPuesto = Exclude<keyof PuestoCompletoInput, "esNuevo">;

/** Etiqueta visible de cada campo, tal cual aparece en el formulario. */
const ETIQUETAS: Record<CampoPuesto, string> = {
  nombre: "Puesto",
  departamentoId: "Departamento",
  descripcion: "Descripción",
  convenioColectivo: "Convenio colectivo",
  validadorDepartamentoId: "Valida este departamento",
  cronogramaRol: "Cronograma",
  salarioBruto: "Salario bruto mensual",
  jornadaContrato: "Jornada",
  horasSemanales: "Horas/semana",
  diasLibres: "Días libres",
  vacaciones: "Vacaciones",
  observaciones: "Observaciones",
  objetivos: "Objetivos",
};

export interface ResultadoValidacionPuesto {
  ok: boolean;
  /** Campos vacíos, en el orden en que aparecen en el formulario. */
  faltan: CampoPuesto[];
  /** Mensaje listo para enseñar al usuario. Vacío si no falta nada. */
  mensaje: string;
}

const vacio = (v: string | null | undefined) => !v || !v.trim();

/**
 * Comprueba que el puesto trae TODOS sus datos. Los números deben ser mayores
 * que cero: un salario de 0 € o 0 horas semanales no es un dato, es un hueco.
 * Los días libres sí admiten 0 (hay jornadas sin día libre fijo), pero no null.
 */
export function validarPuestoCompleto(
  input: PuestoCompletoInput,
): ResultadoValidacionPuesto {
  const faltan: CampoPuesto[] = [];

  if (vacio(input.nombre)) faltan.push("nombre");
  if (vacio(input.departamentoId)) faltan.push("departamentoId");
  if (vacio(input.descripcion)) faltan.push("descripcion");
  if (!(input.salarioBruto > 0)) faltan.push("salarioBruto");
  if (vacio(input.jornadaContrato)) faltan.push("jornadaContrato");
  if (!(input.horasSemanales > 0)) faltan.push("horasSemanales");
  if (input.diasLibres === null || input.diasLibres === undefined || Number.isNaN(input.diasLibres)) {
    faltan.push("diasLibres");
  }
  if (vacio(input.vacaciones)) faltan.push("vacaciones");
  if (!input.esNuevo && vacio(input.cronogramaRol)) faltan.push("cronogramaRol");
  if (vacio(input.observaciones)) faltan.push("observaciones");
  if (input.objetivos.filter((o) => o.trim()).length === 0) faltan.push("objetivos");
  if (vacio(input.convenioColectivo)) faltan.push("convenioColectivo");
  if (vacio(input.validadorDepartamentoId)) faltan.push("validadorDepartamentoId");

  if (faltan.length === 0) return { ok: true, faltan: [], mensaje: "" };

  const nombres = faltan.map((c) => ETIQUETAS[c]);
  const lista =
    nombres.length === 1
      ? nombres[0]
      : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;

  return {
    ok: false,
    faltan,
    mensaje: `Faltan datos del puesto: ${lista}. Un puesto incompleto da de alta empleados con datos incompletos.`,
  };
}

/** Etiqueta visible de un campo (para pintar el aviso junto al campo). */
export function etiquetaCampoPuesto(campo: CampoPuesto): string {
  return ETIQUETAS[campo];
}
