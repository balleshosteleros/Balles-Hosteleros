import "server-only";

/**
 * Condiciones del puesto → empleado (snapshot versionado).
 *
 * Fuente única para:
 *  - leer las condiciones de la plantilla del puesto (`puesto_salarios`), y
 *  - escribirlas como fila VIGENTE en `empleado_condiciones`, cerrando la fila
 *    anterior (histórico). Editar el puesto después NO afecta a lo ya escrito.
 *
 * `empleado_condiciones` es un HISTÓRICO: cada empleado tiene N filas y como
 * mucho UNA vigente (`vigente_hasta IS NULL`, garantizado por índice único).
 */

// Cliente admin de Supabase (createAdminClient()). Se tipa laxo a propósito para
// no acoplar este helper al tipado generado.
type Admin = {
  from: (t: string) => any;
};

export interface CondicionesPuesto {
  nivel: number;
  nomina_neta: number;
  efectivo_extra: number;
  salario_neto: number;
  jornada_contrato: string | null;
  horas_semanales: number | null;
  dias_libres: number | null;
  vacaciones: string | null;
  horario_semanal: unknown;
}

/**
 * Lee las condiciones de la plantilla del puesto. Toma el nivel más bajo definido
 * (order nivel asc limit 1). Devuelve null si el puesto no tiene condiciones.
 */
export async function leerCondicionesPuesto(
  admin: Admin,
  puestoId: string,
): Promise<CondicionesPuesto | null> {
  const { data } = await admin
    .from("puesto_salarios")
    .select(
      "nivel, nomina_neta, efectivo_extra, salario_neto, jornada_contrato, horas_semanales, dias_libres, vacaciones, horario_semanal",
    )
    .eq("puesto_id", puestoId)
    .order("nivel", { ascending: true })
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  return {
    nivel: (row.nivel as number | null) ?? 1,
    nomina_neta: row.nomina_neta,
    efectivo_extra: row.efectivo_extra,
    salario_neto: row.salario_neto,
    jornada_contrato: row.jornada_contrato,
    horas_semanales: row.horas_semanales,
    dias_libres: row.dias_libres,
    vacaciones: row.vacaciones,
    horario_semanal: row.horario_semanal,
  };
}

/** Una plantilla tiene condiciones útiles si al menos define salario o jornada. */
export function tieneCondicionesUtiles(cond: CondicionesPuesto | null): boolean {
  return !!cond && !(cond.salario_neto == null && cond.jornada_contrato == null);
}

export interface EscribirCondicionesInput {
  empresaId: string;
  empleadoId: string;
  puestoId: string;
  puestoNombre: string;
  primerDia: string; // ISO date (YYYY-MM-DD)
  tipoContrato: string | null;
  cond: CondicionesPuesto | null;
  /** 'alta' (contratación) | 'promocion' (cambio de puesto). */
  motivo: "alta" | "promocion";
}

/**
 * Escribe las condiciones como fila VIGENTE del empleado. Cierra primero cualquier
 * fila vigente anterior (vigente_hasta = primerDia) para conservar el histórico, y
 * luego inserta la nueva. Idempotente por diseño: si ya existe una fila vigente
 * idéntica del mismo día se reemplaza limpiamente.
 */
export async function escribirCondicionesVigentes(
  admin: Admin,
  input: EscribirCondicionesInput,
): Promise<void> {
  const { empresaId, empleadoId, puestoId, puestoNombre, primerDia, tipoContrato, cond, motivo } = input;

  // 1) Cerrar la fila vigente anterior (si la hay). El nuevo periodo empieza en
  //    primerDia, así que el anterior termina ese mismo día.
  await admin
    .from("empleado_condiciones")
    .update({ vigente_hasta: primerDia, updated_at: new Date().toISOString() })
    .eq("empleado_id", empleadoId)
    .is("vigente_hasta", null);

  // 2) Insertar la nueva fila vigente.
  await admin.from("empleado_condiciones").insert({
    empleado_id: empleadoId,
    empresa_id: empresaId,
    puesto_id: puestoId,
    puesto_nombre: puestoNombre,
    nivel: cond?.nivel ?? 1,
    nomina_neta: cond?.nomina_neta ?? 0,
    efectivo_extra: cond?.efectivo_extra ?? 0,
    salario_neto: cond?.salario_neto ?? 0,
    jornada_contrato: cond?.jornada_contrato ?? null,
    horas_semanales: cond?.horas_semanales ?? null,
    dias_libres: cond?.dias_libres ?? null,
    vacaciones: cond?.vacaciones ?? null,
    horario_semanal: cond?.horario_semanal ?? [],
    primer_dia: primerDia,
    tipo_contrato: tipoContrato,
    vigente_desde: primerDia,
    vigente_hasta: null,
    motivo,
    updated_at: new Date().toISOString(),
  });
}
