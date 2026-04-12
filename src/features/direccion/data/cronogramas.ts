export type DayOfWeek = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

export interface Turno {
  inicio: string; // ej: "10:00" o "Libre"
  fin: string;    // ej: "18:00"
}

export interface EmpleadoTurno {
  id: string;
  nombre: string;
  puesto: string;
  turnos: Record<DayOfWeek, string>; // Guardaremos ej: "10:00 - 18:00" o "L" para libre
}

export interface Cronograma {
  id: string;
  titulo: string;
  departamento: string;
  empleados: EmpleadoTurno[];
}

export const mockCronogramas: Cronograma[] = [
  {
    id: "cron-sala-1",
    titulo: "Semana Actual",
    departamento: "Sala",
    empleados: [
      {
        id: "emp-1",
        nombre: "Ana García",
        puesto: "Jefa de Sala",
        turnos: {
          lunes: "12:00 - 20:00",
          martes: "Libre",
          miercoles: "10:00 - 18:00",
          jueves: "10:00 - 18:00",
          viernes: "12:00 - 24:00",
          sabado: "12:00 - 24:00",
          domingo: "Libre",
        },
      },
      {
        id: "emp-2",
        nombre: "Carlos López",
        puesto: "Camarero",
        turnos: {
          lunes: "Libre",
          martes: "Libre",
          miercoles: "12:00 - 20:00",
          jueves: "12:00 - 20:00",
          viernes: "18:00 - 02:00",
          sabado: "18:00 - 02:00",
          domingo: "10:00 - 18:00",
        },
      },
    ],
  },
  {
    id: "cron-cocina-1",
    titulo: "Semana Actual",
    departamento: "Cocina",
    empleados: [
      {
        id: "emp-3",
        nombre: "Miguel Torres",
        puesto: "Jefe de Cocina",
        turnos: {
          lunes: "Libre",
          martes: "Libre",
          miercoles: "09:00 - 17:00",
          jueves: "09:00 - 17:00",
          viernes: "09:00 - 17:00",
          sabado: "09:00 - 17:00",
          domingo: "09:00 - 17:00",
        },
      },
    ],
  },
];
