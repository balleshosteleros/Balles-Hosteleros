export type EstadoEmpleado = "trabajando" | "fuera" | "descanso" | "ausente" | "vacaciones";

export interface Empleado {
  id: string;
  nombre: string;
  apellidos: string;
  avatar?: string;
  estado: EstadoEmpleado;
  horarioTipo: string;
  horarioSemanal: string;
  horasHoy: string;
  departamento: string;
  telefono: string;
  fichajes: number;
  emailEmpresa: string;
  emailPersonal: string;
  validadorFichajes: string;
}

export const DEPARTAMENTOS = [
  "DIRECCIÓN", "GERENTE", "JEFE DE SALA", "CAMAREROS", "COCINA",
  "CACHIMBEROS", "ARTISTAS", "MANTENIMIENTO", "RRPP", "ADMINISTRATIVO",
];

export const ESTADOS_LABEL: Record<EstadoEmpleado, string> = {
  trabajando: "Trabajando",
  fuera: "Fuera",
  descanso: "Descanso",
  ausente: "Ausente",
  vacaciones: "Vacaciones",
};

export const ESTADOS_COLOR: Record<EstadoEmpleado, string> = {
  trabajando: "bg-emerald-500",
  fuera: "bg-muted-foreground/40",
  descanso: "bg-amber-400",
  ausente: "bg-destructive",
  vacaciones: "bg-sky-400",
};

const HABANA_EMPLEADOS: Empleado[] = [
  { id: "h1", nombre: "Carlos", apellidos: "Martínez López", estado: "fuera", horarioTipo: "05h", horarioSemanal: "29h semana", horasHoy: "0h 00min", departamento: "CACHIMBEROS", telefono: "612 345 678", fichajes: 0, emailEmpresa: "carlos.martinez@habana.es", emailPersonal: "carlosml@gmail.com", validadorFichajes: "Laura Sánchez" },
  { id: "h2", nombre: "María", apellidos: "García Fernández", estado: "trabajando", horarioTipo: "Sin horario", horarioSemanal: "33h semana", horasHoy: "4h 32min", departamento: "JEFE DE SALA", telefono: "623 456 789", fichajes: 2, emailEmpresa: "maria.garcia@habana.es", emailPersonal: "mariagarcia@hotmail.com", validadorFichajes: "Pedro Ruiz" },
  { id: "h3", nombre: "Alejandro", apellidos: "Ruiz Torres", estado: "fuera", horarioTipo: "DJ", horarioSemanal: "10h 02min semana", horasHoy: "0h 00min", departamento: "ARTISTAS", telefono: "634 567 890", fichajes: 0, emailEmpresa: "alejandro.ruiz@habana.es", emailPersonal: "aleruiz@gmail.com", validadorFichajes: "Laura Sánchez" },
  { id: "h4", nombre: "Laura", apellidos: "Sánchez Moreno", estado: "trabajando", horarioTipo: "08h", horarioSemanal: "40h semana", horasHoy: "6h 15min", departamento: "DIRECCIÓN", telefono: "645 678 901", fichajes: 3, emailEmpresa: "laura.sanchez@habana.es", emailPersonal: "laurasm@gmail.com", validadorFichajes: "—" },
  { id: "h5", nombre: "Pedro", apellidos: "Ruiz Navarro", estado: "descanso", horarioTipo: "06h", horarioSemanal: "36h semana", horasHoy: "3h 10min", departamento: "GERENTE", telefono: "656 789 012", fichajes: 1, emailEmpresa: "pedro.ruiz@habana.es", emailPersonal: "pedroruiz@yahoo.es", validadorFichajes: "Laura Sánchez" },
  { id: "h6", nombre: "Ana", apellidos: "López Díaz", estado: "fuera", horarioTipo: "05h", horarioSemanal: "25h semana", horasHoy: "0h 00min", departamento: "CAMAREROS", telefono: "667 890 123", fichajes: 0, emailEmpresa: "ana.lopez@habana.es", emailPersonal: "analopez@gmail.com", validadorFichajes: "María García" },
  { id: "h7", nombre: "Javier", apellidos: "Fernández Castro", estado: "vacaciones", horarioTipo: "08h", horarioSemanal: "40h semana", horasHoy: "0h 00min", departamento: "MANTENIMIENTO", telefono: "678 901 234", fichajes: 0, emailEmpresa: "javier.fernandez@habana.es", emailPersonal: "javierfc@gmail.com", validadorFichajes: "Pedro Ruiz" },
  { id: "h8", nombre: "Sofía", apellidos: "Martín Herrero", estado: "trabajando", horarioTipo: "06h", horarioSemanal: "30h semana", horasHoy: "5h 45min", departamento: "RRPP", telefono: "689 012 345", fichajes: 2, emailEmpresa: "sofia.martin@habana.es", emailPersonal: "sofiamh@hotmail.com", validadorFichajes: "Laura Sánchez" },
  { id: "h9", nombre: "Diego", apellidos: "Romero Blanco", estado: "ausente", horarioTipo: "Sin horario", horarioSemanal: "20h semana", horasHoy: "0h 00min", departamento: "CACHIMBEROS", telefono: "—", fichajes: 0, emailEmpresa: "diego.romero@habana.es", emailPersonal: "—", validadorFichajes: "María García" },
  { id: "h10", nombre: "Elena", apellidos: "Vega Prieto", estado: "fuera", horarioTipo: "04h", horarioSemanal: "16h semana", horasHoy: "0h 00min", departamento: "CAMAREROS", telefono: "601 234 567", fichajes: 0, emailEmpresa: "elena.vega@habana.es", emailPersonal: "elenavp@gmail.com", validadorFichajes: "María García" },
];

const BACANAL_EMPLEADOS: Empleado[] = [
  { id: "b1", nombre: "Andrés", apellidos: "Jiménez Ramos", estado: "trabajando", horarioTipo: "08h", horarioSemanal: "40h semana", horasHoy: "7h 20min", departamento: "DIRECCIÓN", telefono: "611 111 222", fichajes: 3, emailEmpresa: "andres.jimenez@bacanal.es", emailPersonal: "andresj@gmail.com", validadorFichajes: "—" },
  { id: "b2", nombre: "Lucía", apellidos: "Pérez Ortega", estado: "fuera", horarioTipo: "06h", horarioSemanal: "30h semana", horasHoy: "0h 00min", departamento: "JEFE DE SALA", telefono: "622 222 333", fichajes: 0, emailEmpresa: "lucia.perez@bacanal.es", emailPersonal: "luciap@hotmail.com", validadorFichajes: "Andrés Jiménez" },
  { id: "b3", nombre: "Miguel", apellidos: "Santos Gil", estado: "trabajando", horarioTipo: "05h", horarioSemanal: "25h semana", horasHoy: "4h 10min", departamento: "CAMAREROS", telefono: "633 333 444", fichajes: 2, emailEmpresa: "miguel.santos@bacanal.es", emailPersonal: "miguels@gmail.com", validadorFichajes: "Lucía Pérez" },
  { id: "b4", nombre: "Carmen", apellidos: "Morales Reyes", estado: "descanso", horarioTipo: "DJ", horarioSemanal: "12h semana", horasHoy: "2h 00min", departamento: "ARTISTAS", telefono: "644 444 555", fichajes: 1, emailEmpresa: "carmen.morales@bacanal.es", emailPersonal: "carmenm@yahoo.es", validadorFichajes: "Andrés Jiménez" },
  { id: "b5", nombre: "Raúl", apellidos: "Herrera Muñoz", estado: "fuera", horarioTipo: "Sin horario", horarioSemanal: "35h semana", horasHoy: "0h 00min", departamento: "COCINA", telefono: "655 555 666", fichajes: 0, emailEmpresa: "raul.herrera@bacanal.es", emailPersonal: "raulh@gmail.com", validadorFichajes: "Lucía Pérez" },
  { id: "b6", nombre: "Isabel", apellidos: "Domínguez Lara", estado: "trabajando", horarioTipo: "07h", horarioSemanal: "35h semana", horasHoy: "5h 50min", departamento: "ADMINISTRATIVO", telefono: "666 666 777", fichajes: 2, emailEmpresa: "isabel.dominguez@bacanal.es", emailPersonal: "isabeldom@gmail.com", validadorFichajes: "Andrés Jiménez" },
  { id: "b7", nombre: "Pablo", apellidos: "Crespo Vargas", estado: "ausente", horarioTipo: "05h", horarioSemanal: "28h semana", horasHoy: "0h 00min", departamento: "CACHIMBEROS", telefono: "677 777 888", fichajes: 0, emailEmpresa: "pablo.crespo@bacanal.es", emailPersonal: "—", validadorFichajes: "Lucía Pérez" },
  { id: "b8", nombre: "Marta", apellidos: "Iglesias Peña", estado: "vacaciones", horarioTipo: "06h", horarioSemanal: "30h semana", horasHoy: "0h 00min", departamento: "RRPP", telefono: "688 888 999", fichajes: 0, emailEmpresa: "marta.iglesias@bacanal.es", emailPersonal: "martaip@gmail.com", validadorFichajes: "Andrés Jiménez" },
];

export function getEmpleadosPorEmpresa(empresaId: string): Empleado[] {
  if (empresaId === "habana") return HABANA_EMPLEADOS;
  if (empresaId === "bacanal") return BACANAL_EMPLEADOS;
  return [];
}
