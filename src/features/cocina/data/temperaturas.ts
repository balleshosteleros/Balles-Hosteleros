export type TipoEquipo = "NEVERA" | "CONGELADOR" | "CÁMARA" | "BOTELLERO" | "OTRO";
export type EstadoEquipo = "ACTIVO" | "INACTIVO" | "EN REPARACIÓN";
export type EstadoRegistro = "OK" | "ALERTA";
export type AreaTemp = "SALA" | "COCINA";

export interface EquipoFrio {
  id: string;
  nombre: string;
  tipo: TipoEquipo;
  area: AreaTemp;
  ubicacion: string;
  rangoMin: number;
  rangoMax: number;
  estado: EstadoEquipo;
  observaciones: string;
}

export interface RegistroTemperatura {
  id: string;
  equipoId: string;
  fecha: string;
  hora: string;
  temperatura: number;
  estado: EstadoRegistro;
  empleado: string;
  medidasTomadas: string;
  observaciones: string;
}

export const SAMPLE_EQUIPOS_SALA: EquipoFrio[] = [
  { id: "es1", nombre: "Nevera barra 1", tipo: "NEVERA", area: "SALA", ubicacion: "Barra principal", rangoMin: 1, rangoMax: 5, estado: "ACTIVO", observaciones: "" },
  { id: "es2", nombre: "Nevera barra 2", tipo: "NEVERA", area: "SALA", ubicacion: "Barra secundaria", rangoMin: 1, rangoMax: 5, estado: "ACTIVO", observaciones: "" },
  { id: "es3", nombre: "Botellero", tipo: "BOTELLERO", area: "SALA", ubicacion: "Barra principal", rangoMin: 2, rangoMax: 8, estado: "ACTIVO", observaciones: "Vinos y refrescos" },
  { id: "es4", nombre: "Vitrina fría", tipo: "NEVERA", area: "SALA", ubicacion: "Expositor", rangoMin: 0, rangoMax: 4, estado: "ACTIVO", observaciones: "Postres y tapas" },
];

export const SAMPLE_EQUIPOS_COCINA: EquipoFrio[] = [
  { id: "ec1", nombre: "Cámara frigorífica", tipo: "CÁMARA", area: "COCINA", ubicacion: "Zona almacén", rangoMin: 0, rangoMax: 4, estado: "ACTIVO", observaciones: "" },
  { id: "ec2", nombre: "Congelador cocina 1", tipo: "CONGELADOR", area: "COCINA", ubicacion: "Junto a fogones", rangoMin: -22, rangoMax: -16, estado: "ACTIVO", observaciones: "" },
  { id: "ec3", nombre: "Congelador postres", tipo: "CONGELADOR", area: "COCINA", ubicacion: "Zona pastelería", rangoMin: -20, rangoMax: -16, estado: "ACTIVO", observaciones: "Helados y semifríos" },
  { id: "ec4", nombre: "Nevera mise en place", tipo: "NEVERA", area: "COCINA", ubicacion: "Línea caliente", rangoMin: 0, rangoMax: 5, estado: "ACTIVO", observaciones: "" },
  { id: "ec5", nombre: "Nevera verduras", tipo: "NEVERA", area: "COCINA", ubicacion: "Zona almacén", rangoMin: 1, rangoMax: 6, estado: "EN REPARACIÓN", observaciones: "Pendiente revisión técnico" },
];

const hoy = new Date().toISOString().split("T")[0];
const ayer = new Date(Date.now() - 86400000).toISOString().split("T")[0];

export const SAMPLE_REGISTROS_SALA: RegistroTemperatura[] = [
  { id: "rs1", equipoId: "es1", fecha: hoy, hora: "09:00", temperatura: 3.2, estado: "OK", empleado: "Ana López", medidasTomadas: "", observaciones: "" },
  { id: "rs2", equipoId: "es2", fecha: hoy, hora: "09:05", temperatura: 7.1, estado: "ALERTA", empleado: "Ana López", medidasTomadas: "Se revisó la puerta, estaba mal cerrada. Se ajustó y se volverá a medir en 1h.", observaciones: "Puerta entreabierta" },
  { id: "rs3", equipoId: "es3", fecha: hoy, hora: "09:10", temperatura: 5.5, estado: "OK", empleado: "Ana López", medidasTomadas: "", observaciones: "" },
  { id: "rs4", equipoId: "es1", fecha: ayer, hora: "09:00", temperatura: 2.8, estado: "OK", empleado: "Carlos Ruiz", medidasTomadas: "", observaciones: "" },
  { id: "rs5", equipoId: "es2", fecha: ayer, hora: "09:05", temperatura: 4.1, estado: "OK", empleado: "Carlos Ruiz", medidasTomadas: "", observaciones: "" },
];

export const SAMPLE_REGISTROS_COCINA: RegistroTemperatura[] = [
  { id: "rc1", equipoId: "ec1", fecha: hoy, hora: "07:00", temperatura: 2.5, estado: "OK", empleado: "Miguel Ángel", medidasTomadas: "", observaciones: "" },
  { id: "rc2", equipoId: "ec2", fecha: hoy, hora: "07:05", temperatura: -18.3, estado: "OK", empleado: "Miguel Ángel", medidasTomadas: "", observaciones: "" },
  { id: "rc3", equipoId: "ec3", fecha: hoy, hora: "07:10", temperatura: -12.0, estado: "ALERTA", empleado: "Miguel Ángel", medidasTomadas: "Se avisó al responsable. Se trasladó género al congelador cocina 1. Se llamó al técnico.", observaciones: "Motor hacía ruido" },
  { id: "rc4", equipoId: "ec4", fecha: hoy, hora: "07:15", temperatura: 3.8, estado: "OK", empleado: "Miguel Ángel", medidasTomadas: "", observaciones: "" },
  { id: "rc5", equipoId: "ec1", fecha: ayer, hora: "07:00", temperatura: 3.0, estado: "OK", empleado: "Laura Díaz", medidasTomadas: "", observaciones: "" },
  { id: "rc6", equipoId: "ec2", fecha: ayer, hora: "07:05", temperatura: -19.0, estado: "OK", empleado: "Laura Díaz", medidasTomadas: "", observaciones: "" },
];

export function evaluarEstado(temp: number, min: number, max: number): EstadoRegistro {
  return temp >= min && temp <= max ? "OK" : "ALERTA";
}
