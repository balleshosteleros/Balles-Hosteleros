/** NUEVO 0-1 visitas · REGULAR 2-4 · VIP 5+. Ver `clasificacion-cliente.ts`. */
export type ClasificacionCliente = "REGULAR" | "VIP" | "NUEVO";

export interface Cliente {
  id: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  email: string;
  /**
   * Valor GUARDADO en la ficha, que puede estar desfasado. Para pintar usa
   * SIEMPRE `clasificacionEfectiva()`: la que manda es la calculada por las
   * visitas reales, no este campo.
   */
  clasificacion: ClasificacionCliente;
  visitas: number;
  ultimaVisita: string;
  observaciones: string;
  notasInternas: string;
  /** Se pide al reservar por web. Vacío si el cliente no lo dio. */
  fechaNacimiento?: string;
  /** Prefijo internacional; el número va en `telefono`. */
  telefonoPrefijo?: string;
  /** Consentimiento para comunicaciones comerciales (RGPD). */
  aceptaMarketing?: boolean;
}

export const SAMPLE_CLIENTES: Cliente[] = [
  { id: "c1", nombre: "María", apellidos: "García", telefono: "612345678", email: "maria@email.com", clasificacion: "VIP", visitas: 24, ultimaVisita: "2026-04-05", observaciones: "Prefiere mesa junto a la ventana", notasInternas: "" },
  { id: "c2", nombre: "Carlos", apellidos: "López", telefono: "698765432", email: "carlos@email.com", clasificacion: "VIP", visitas: 52, ultimaVisita: "2026-04-06", observaciones: "Cliente habitual desde 2023", notasInternas: "Contacto de prensa local" },
  { id: "c3", nombre: "Ana", apellidos: "Martínez", telefono: "655443322", email: "ana@email.com", clasificacion: "VIP", visitas: 8, ultimaVisita: "2026-03-20", observaciones: "Alergia a frutos secos", notasInternas: "" },
  { id: "c4", nombre: "Pedro", apellidos: "Ruiz", telefono: "633221100", email: "pedro@email.com", clasificacion: "VIP", visitas: 15, ultimaVisita: "2026-04-01", observaciones: "", notasInternas: "Organiza cenas de empresa" },
  { id: "c5", nombre: "Laura", apellidos: "Fernández", telefono: "677889900", email: "", clasificacion: "NUEVO", visitas: 1, ultimaVisita: "2026-04-07", observaciones: "", notasInternas: "" },
  { id: "c6", nombre: "Javier", apellidos: "Sánchez", telefono: "644556677", email: "javier@email.com", clasificacion: "REGULAR", visitas: 3, ultimaVisita: "2025-11-15", observaciones: "", notasInternas: "No viene desde noviembre" },
];
