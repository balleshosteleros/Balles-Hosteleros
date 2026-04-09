export type ClasificacionCliente = "REGULAR" | "VIP" | "FRECUENTE" | "NUEVO" | "INACTIVO";

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  clasificacion: ClasificacionCliente;
  visitas: number;
  ultimaVisita: string;
  observaciones: string;
  preferencias: string;
  notasInternas: string;
}

export const SAMPLE_CLIENTES: Cliente[] = [
  { id: "c1", nombre: "María García", telefono: "612345678", email: "maria@email.com", clasificacion: "FRECUENTE", visitas: 24, ultimaVisita: "2026-04-05", observaciones: "Prefiere mesa junto a la ventana", preferencias: "Vino tinto, sin gluten", notasInternas: "" },
  { id: "c2", nombre: "Carlos López", telefono: "698765432", email: "carlos@email.com", clasificacion: "VIP", visitas: 52, ultimaVisita: "2026-04-06", observaciones: "Cliente habitual desde 2023", preferencias: "Siempre terraza", notasInternas: "Contacto de prensa local" },
  { id: "c3", nombre: "Ana Martínez", telefono: "655443322", email: "ana@email.com", clasificacion: "REGULAR", visitas: 8, ultimaVisita: "2026-03-20", observaciones: "Alergia a frutos secos", preferencias: "", notasInternas: "" },
  { id: "c4", nombre: "Pedro Ruiz", telefono: "633221100", email: "pedro@email.com", clasificacion: "FRECUENTE", visitas: 15, ultimaVisita: "2026-04-01", observaciones: "", preferencias: "Zona privada para eventos", notasInternas: "Organiza cenas de empresa" },
  { id: "c5", nombre: "Laura Fernández", telefono: "677889900", email: "", clasificacion: "NUEVO", visitas: 1, ultimaVisita: "2026-04-07", observaciones: "", preferencias: "", notasInternas: "" },
  { id: "c6", nombre: "Javier Sánchez", telefono: "644556677", email: "javier@email.com", clasificacion: "INACTIVO", visitas: 3, ultimaVisita: "2025-11-15", observaciones: "", preferencias: "", notasInternas: "No viene desde noviembre" },
];
