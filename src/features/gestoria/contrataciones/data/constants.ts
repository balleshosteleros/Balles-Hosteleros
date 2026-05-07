export const MOTIVOS_BAJA = [
  "Voluntaria",
  "Despido",
  "Fin de contrato",
  "No supera periodo de prueba",
  "Otro",
] as const;

export type MotivoBaja = (typeof MOTIVOS_BAJA)[number];

export const TIPOS_MODIFICACION = [
  "Horario",
  "Salario",
  "Puesto",
  "Jornada",
  "Otro",
] as const;

export type TipoModificacion = (typeof TIPOS_MODIFICACION)[number];

export const PUESTO_OTRO_VALUE = "__otro__";

export const DIAS_SEMANA = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
] as const;

export type DiaKey = (typeof DIAS_SEMANA)[number]["key"];
