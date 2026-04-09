export type EstadoMesa = "LIBRE" | "OCUPADA" | "RESERVADA" | "BLOQUEADA";
export type EstadoReserva = "CONFIRMADA" | "PENDIENTE" | "RECONFIRMADA" | "LISTA_ESPERA" | "WALK_IN" | "LLEGADA" | "NO SHOW" | "COMPLETADA" | "CANCELADA";
export type ZonaSala = "SALA" | "BARRA" | "TERRAZA_INTERIOR" | "TERRAZA_EXTERIOR" | "PRIVADO";
export type TurnoReserva = "COMIDA" | "CENA" | "DIA_COMPLETO";
export type TipoMesa = "MESA" | "BARRA" | "RESERVADO" | "TABURETE";

export const ZONAS_LABELS: Record<ZonaSala, string> = {
  SALA: "Sala",
  BARRA: "Barra",
  TERRAZA_INTERIOR: "Terraza Interior",
  TERRAZA_EXTERIOR: "Terraza Exterior",
  PRIVADO: "Privado",
};

export const ESTADO_RESERVA_LABELS: Record<EstadoReserva, string> = {
  CONFIRMADA: "Confirmada",
  PENDIENTE: "Pendiente",
  RECONFIRMADA: "Reconfirmada",
  LISTA_ESPERA: "Lista espera",
  WALK_IN: "Walk In",
  LLEGADA: "Llegada",
  "NO SHOW": "No Show",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

export const ESTADO_MESA_LABELS: Record<EstadoMesa, string> = {
  LIBRE: "Libre",
  OCUPADA: "Ocupada",
  RESERVADA: "Reservada",
  BLOQUEADA: "Bloqueada",
};

export interface Mesa {
  id: string;
  codigo: string;
  numero: number;
  zona: ZonaSala;
  capacidad: number;
  estado: EstadoMesa;
  tipo: TipoMesa;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  combinable: boolean;
  activa: boolean;
}

export interface Reserva {
  id: string;
  cliente: string;
  apellidos: string;
  telefono: string;
  email: string;
  fecha: string;
  hora: string;
  turno: TurnoReserva;
  comensales: number;
  zona: ZonaSala | "";
  mesaId: string;
  estado: EstadoReserva;
  observaciones: string;
  empleadoId?: string;
}

export interface ListaEspera {
  id: string;
  cliente: string;
  telefono: string;
  comensales: number;
  zona: ZonaSala | "";
  hora: string;
  fecha: string;
  observaciones: string;
  estado: "ESPERANDO" | "ASIGNADO" | "CANCELADO";
}

// --- SAMPLE DATA ---
const hoy = "2026-04-07";

export const SAMPLE_MESAS: Mesa[] = [
  // SALA
  { id: "s1", codigo: "A1", numero: 1, zona: "SALA", capacidad: 6, tipo: "MESA", estado: "LIBRE", x: 72, y: 6, ancho: 5, alto: 6, combinable: true, activa: true },
  { id: "s2", codigo: "A2", numero: 2, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "RESERVADA", x: 72, y: 15, ancho: 5, alto: 5, combinable: true, activa: true },
  { id: "s3", codigo: "A3", numero: 3, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "LIBRE", x: 72, y: 23, ancho: 5, alto: 5, combinable: true, activa: true },
  { id: "s4", codigo: "A4", numero: 4, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "OCUPADA", x: 72, y: 31, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "s5", codigo: "A5", numero: 5, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "LIBRE", x: 72, y: 39, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "s6", codigo: "A6", numero: 6, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "LIBRE", x: 72, y: 47, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "s7", codigo: "C1", numero: 7, zona: "SALA", capacidad: 4, tipo: "MESA", estado: "RESERVADA", x: 80, y: 6, ancho: 5, alto: 6, combinable: true, activa: true },
  { id: "s8", codigo: "C2", numero: 8, zona: "SALA", capacidad: 2, tipo: "MESA", estado: "LIBRE", x: 80, y: 15, ancho: 5, alto: 5, combinable: true, activa: true },
  { id: "s9", codigo: "C3", numero: 9, zona: "SALA", capacidad: 4, tipo: "MESA", estado: "OCUPADA", x: 80, y: 23, ancho: 5, alto: 6, combinable: false, activa: true },
  { id: "s10", codigo: "C4", numero: 10, zona: "SALA", capacidad: 3, tipo: "MESA", estado: "LIBRE", x: 88, y: 6, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "s11", codigo: "C5", numero: 11, zona: "SALA", capacidad: 3, tipo: "MESA", estado: "LIBRE", x: 88, y: 14, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "s12", codigo: "C6", numero: 12, zona: "SALA", capacidad: 6, tipo: "MESA", estado: "LIBRE", x: 88, y: 22, ancho: 6, alto: 6, combinable: false, activa: true },
  // VIP
  { id: "v1", codigo: "VIP1", numero: 13, zona: "SALA", capacidad: 5, tipo: "RESERVADO", estado: "WALK_IN" as any, x: 64, y: 18, ancho: 6, alto: 7, combinable: false, activa: true },
  // TERRAZA INTERIOR
  { id: "ti1", codigo: "TI1", numero: 14, zona: "TERRAZA_INTERIOR", capacidad: 7, tipo: "MESA", estado: "RESERVADA", x: 48, y: 8, ancho: 5, alto: 7, combinable: true, activa: true },
  { id: "ti2", codigo: "TI2", numero: 15, zona: "TERRAZA_INTERIOR", capacidad: 7, tipo: "MESA", estado: "RESERVADA", x: 55, y: 8, ancho: 5, alto: 7, combinable: true, activa: true },
  { id: "ti3", codigo: "TI3", numero: 16, zona: "TERRAZA_INTERIOR", capacidad: 6, tipo: "MESA", estado: "OCUPADA", x: 48, y: 20, ancho: 5, alto: 6, combinable: false, activa: true },
  { id: "ti4", codigo: "TI4", numero: 17, zona: "TERRAZA_INTERIOR", capacidad: 3, tipo: "MESA", estado: "LIBRE", x: 55, y: 20, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "ti5", codigo: "TI5", numero: 18, zona: "TERRAZA_INTERIOR", capacidad: 3, tipo: "MESA", estado: "LIBRE", x: 55, y: 28, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "ti6", codigo: "TI6", numero: 19, zona: "TERRAZA_INTERIOR", capacidad: 4, tipo: "MESA", estado: "OCUPADA", x: 48, y: 38, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "ti7", codigo: "TI7", numero: 20, zona: "TERRAZA_INTERIOR", capacidad: 3, tipo: "MESA", estado: "LIBRE", x: 55, y: 38, ancho: 5, alto: 5, combinable: false, activa: true },
  // TERRAZA EXTERIOR
  { id: "te1", codigo: "TE1", numero: 21, zona: "TERRAZA_EXTERIOR", capacidad: 5, tipo: "MESA", estado: "LIBRE", x: 32, y: 8, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te2", codigo: "TE2", numero: 22, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 32, y: 18, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te3", codigo: "TE3", numero: 23, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 32, y: 28, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te4", codigo: "TE4", numero: 24, zona: "TERRAZA_EXTERIOR", capacidad: 5, tipo: "MESA", estado: "LIBRE", x: 32, y: 38, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te5", codigo: "TE5", numero: 25, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 22, y: 8, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te6", codigo: "TE6", numero: 26, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 22, y: 18, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te7", codigo: "TE7", numero: 27, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 12, y: 8, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te8", codigo: "TE8", numero: 28, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 12, y: 18, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te9", codigo: "TE9", numero: 29, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 22, y: 28, ancho: 5, alto: 5, combinable: false, activa: true },
  { id: "te10", codigo: "TE10", numero: 30, zona: "TERRAZA_EXTERIOR", capacidad: 4, tipo: "MESA", estado: "LIBRE", x: 22, y: 38, ancho: 5, alto: 5, combinable: false, activa: true },
  // BARRA
  { id: "b1", codigo: "B1", numero: 31, zona: "BARRA", capacidad: 2, tipo: "BARRA", estado: "LIBRE", x: 82, y: 52, ancho: 4, alto: 5, combinable: false, activa: true },
  { id: "b2", codigo: "B2", numero: 32, zona: "BARRA", capacidad: 2, tipo: "BARRA", estado: "OCUPADA", x: 87, y: 52, ancho: 4, alto: 5, combinable: false, activa: true },
  { id: "b3", codigo: "B3", numero: 33, zona: "BARRA", capacidad: 2, tipo: "BARRA", estado: "LIBRE", x: 82, y: 60, ancho: 4, alto: 5, combinable: false, activa: true },
  { id: "b4", codigo: "B4", numero: 34, zona: "BARRA", capacidad: 2, tipo: "BARRA", estado: "LIBRE", x: 87, y: 60, ancho: 4, alto: 5, combinable: false, activa: true },
  { id: "b5", codigo: "R1", numero: 35, zona: "BARRA", capacidad: 4, tipo: "BARRA", estado: "LIBRE", x: 64, y: 30, ancho: 5, alto: 5, combinable: false, activa: true },
  // PRIVADO
  { id: "p1", codigo: "R1T", numero: 36, zona: "PRIVADO", capacidad: 4, tipo: "RESERVADO", estado: "LIBRE", x: 58, y: 72, ancho: 7, alto: 7, combinable: false, activa: true },
  { id: "p2", codigo: "R2T", numero: 37, zona: "PRIVADO", capacidad: 4, tipo: "RESERVADO", estado: "LIBRE", x: 68, y: 72, ancho: 7, alto: 7, combinable: false, activa: true },
];

export const SAMPLE_RESERVAS: Reserva[] = [
  { id: "r1", cliente: "María", apellidos: "García López", telefono: "612345678", email: "maria@email.com", fecha: hoy, hora: "14:00", turno: "COMIDA", comensales: 4, zona: "SALA", mesaId: "s2", estado: "CONFIRMADA", observaciones: "Cumpleaños" },
  { id: "r2", cliente: "Carlos", apellidos: "López Ruiz", telefono: "698765432", email: "carlos@email.com", fecha: hoy, hora: "21:00", turno: "CENA", comensales: 2, zona: "TERRAZA_EXTERIOR", mesaId: "te1", estado: "PENDIENTE", observaciones: "" },
  { id: "r3", cliente: "Ana", apellidos: "Martínez Sanz", telefono: "655443322", email: "ana@email.com", fecha: "2026-04-08", hora: "14:30", turno: "COMIDA", comensales: 6, zona: "SALA", mesaId: "s12", estado: "CONFIRMADA", observaciones: "Alergia frutos secos" },
  { id: "r4", cliente: "Pedro", apellidos: "Ruiz Fernández", telefono: "633221100", email: "pedro@email.com", fecha: hoy, hora: "21:30", turno: "CENA", comensales: 8, zona: "PRIVADO", mesaId: "p1", estado: "CONFIRMADA", observaciones: "Cena de empresa" },
  { id: "r5", cliente: "Laura", apellidos: "Fernández Gil", telefono: "677889900", email: "", fecha: hoy, hora: "14:00", turno: "COMIDA", comensales: 2, zona: "", mesaId: "", estado: "PENDIENTE", observaciones: "" },
  { id: "r6", cliente: "Lorena", apellidos: "Melchor", telefono: "611223344", email: "", fecha: hoy, hora: "23:30", turno: "CENA", comensales: 7, zona: "TERRAZA_INTERIOR", mesaId: "ti1", estado: "CONFIRMADA", observaciones: "" },
  { id: "r7", cliente: "Lorena", apellidos: "Melchor", telefono: "611223344", email: "", fecha: hoy, hora: "23:30", turno: "CENA", comensales: 7, zona: "TERRAZA_INTERIOR", mesaId: "ti2", estado: "CONFIRMADA", observaciones: "" },
  { id: "r8", cliente: "Alejandra", apellidos: "Camargo", telefono: "622334455", email: "", fecha: hoy, hora: "20:15", turno: "CENA", comensales: 2, zona: "SALA", mesaId: "v1", estado: "WALK_IN", observaciones: "" },
  { id: "r9", cliente: "Jonas", apellidos: "Mamba", telefono: "644556677", email: "", fecha: hoy, hora: "00:30", turno: "CENA", comensales: 4, zona: "SALA", mesaId: "s10", estado: "WALK_IN", observaciones: "" },
  { id: "r10", cliente: "Carlos", apellidos: "Gil García", telefono: "655667788", email: "", fecha: hoy, hora: "00:30", turno: "CENA", comensales: 4, zona: "SALA", mesaId: "s9", estado: "WALK_IN", observaciones: "" },
  { id: "r11", cliente: "", apellidos: "", telefono: "", email: "", fecha: hoy, hora: "20:00", turno: "CENA", comensales: 2, zona: "SALA", mesaId: "s4", estado: "WALK_IN", observaciones: "" },
  { id: "r12", cliente: "", apellidos: "", telefono: "", email: "", fecha: hoy, hora: "20:00", turno: "CENA", comensales: 4, zona: "SALA", mesaId: "s7", estado: "WALK_IN", observaciones: "" },
  { id: "r13", cliente: "", apellidos: "", telefono: "", email: "", fecha: hoy, hora: "20:00", turno: "CENA", comensales: 3, zona: "TERRAZA_INTERIOR", mesaId: "ti6", estado: "WALK_IN", observaciones: "" },
];

export const SAMPLE_LISTA_ESPERA: ListaEspera[] = [
  { id: "le1", cliente: "Raúl Gómez", telefono: "611222333", comensales: 4, zona: "SALA", hora: "21:00", fecha: hoy, observaciones: "Prefiere interior", estado: "ESPERANDO" },
  { id: "le2", cliente: "Marta Díaz", telefono: "622333444", comensales: 2, zona: "", hora: "21:30", fecha: hoy, observaciones: "", estado: "ESPERANDO" },
];
