/**
 * Seed canónico de ETIQUETAS DE SALA (Reservas + Clientes).
 *
 * Dos scopes:
 *  - scope='reserva' → la etiqueta se asigna a UNA reserva y no se propaga
 *    al cliente. Ej: "Cumpleaños" (de esta visita concreta), "Cliente
 *    contactado".
 *  - scope='cliente' → la etiqueta se asigna al cliente y se autoaplica a
 *    TODAS sus reservas futuras. Ej: "VIP", "Alérgico a frutos secos", "Oro".
 *
 * Las categorías y etiquetas con `sistema=true` provienen del seed y no se
 * pueden borrar desde la UI (sólo desactivar). El cliente puede crear las
 * suyas propias (sistema=false) y modificarlas libremente.
 *
 * Propagación: `syncSalaEtiquetasAEmpresa()` en `sync.ts` (aditivo — solo
 * inserta lo que falta por nombre, NUNCA sobreescribe personalizaciones).
 */

import { ALERGENOS_UE_14 } from "@/features/logistica/data/productos";

export type EtiquetaScope = "reserva" | "cliente";

export interface EtiquetaSeed {
  nombre: string;
  emoji?: string;
  color?: string;
}

export interface CategoriaEtiquetaSeed {
  nombre: string;
  scope: EtiquetaScope;
  orden: number;
  etiquetas: EtiquetaSeed[];
}

// ─────────────────────────────────────────────────────────────────────────
// RESERVAS — etiquetas exclusivas de cada reserva concreta
// ─────────────────────────────────────────────────────────────────────────
const RESERVA_CATEGORIAS: CategoriaEtiquetaSeed[] = [
  {
    nombre: "Evento",
    scope: "reserva",
    orden: 1,
    etiquetas: [
      { nombre: "Cumpleaños",  emoji: "🎂", color: "#ec4899" },
      { nombre: "Celebración", emoji: "🎉", color: "#f59e0b" },
      { nombre: "Aniversario", emoji: "💑", color: "#e11d48" },
      { nombre: "Boda",        emoji: "💍", color: "#a855f7" },
      { nombre: "Bautizo",     emoji: "👶", color: "#38bdf8" },
      { nombre: "Comunión",    emoji: "⛪", color: "#8b5cf6" },
      { nombre: "Empresa",     emoji: "🏢", color: "#0ea5e9" },
    ],
  },
  {
    nombre: "Petición especial",
    scope: "reserva",
    orden: 2,
    etiquetas: [
      { nombre: "Silla de ruedas", emoji: "♿", color: "#3b82f6" },
      { nombre: "Carrito de bebé", emoji: "🍼", color: "#f97316" },
      { nombre: "Trona",           emoji: "🪑", color: "#84cc16" },
    ],
  },
  {
    nombre: "Servicios Gastronómicos",
    scope: "reserva",
    orden: 3,
    etiquetas: [
      { nombre: "Desayuno",  emoji: "🥐", color: "#fbbf24" },
      { nombre: "Brunch",    emoji: "🥞", color: "#f59e0b" },
      { nombre: "Almuerzo",  emoji: "🍽", color: "#ef4444" },
      { nombre: "Comida",    emoji: "🍴", color: "#dc2626" },
      { nombre: "Tardeo",    emoji: "🍷", color: "#7c3aed" },
      { nombre: "Merienda",  emoji: "🍰", color: "#ec4899" },
      { nombre: "Cena",      emoji: "🍝", color: "#9333ea" },
      { nombre: "Copas",     emoji: "🍹", color: "#06b6d4" },
      { nombre: "Aperitivo", emoji: "🥂", color: "#f59e0b" },
    ],
  },
  {
    nombre: "Servicio Hotelero",
    scope: "reserva",
    orden: 4,
    etiquetas: [
      { nombre: "Huésped",        emoji: "🛏", color: "#0ea5e9" },
      { nombre: "Cliente externo", emoji: "👤", color: "#64748b" },
      { nombre: "Turista",        emoji: "✈", color: "#14b8a6" },
      { nombre: "Local",          emoji: "📍", color: "#16a34a" },
    ],
  },
  {
    nombre: "Otras",
    scope: "reserva",
    orden: 5,
    etiquetas: [
      { nombre: "Llegada impuntual",   emoji: "⏰", color: "#f97316" },
      { nombre: "Menú concertado",     emoji: "✅", color: "#10b981" },
      { nombre: "Cliente contactado",  emoji: "☎",  color: "#3b82f6" },
      { nombre: "Atención",            emoji: "⚠",  color: "#eab308" },
      { nombre: "Trato especial",      emoji: "❤",  color: "#e11d48" },
      { nombre: "Colaboración",        emoji: "🤝", color: "#06b6d4" },
      { nombre: "Invitación",          emoji: "✉",  color: "#a855f7" },
      { nombre: "Evento",              emoji: "🎫", color: "#f59e0b" },
      { nombre: "Grupo",               emoji: "👥", color: "#8b5cf6" },
      { nombre: "Entrada",             emoji: "🎟", color: "#ec4899" },
      { nombre: "Servicio de botella", emoji: "🍾", color: "#7c3aed" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// CLIENTES — etiquetas persistentes del cliente
// ─────────────────────────────────────────────────────────────────────────
const CLIENTE_CATEGORIAS: CategoriaEtiquetaSeed[] = [
  {
    nombre: "Etiquetas del sistema",
    scope: "cliente",
    orden: 1,
    etiquetas: [
      { nombre: "VIP",     color: "#3b82f6" },
      { nombre: "No paga", color: "#ef4444" },
      { nombre: "Aux",     color: "#a855f7" },
      { nombre: "Blist",   color: "#64748b" },
      { nombre: "Partner", color: "#eab308" },
    ],
  },
  {
    nombre: "Nivel de fidelización",
    scope: "cliente",
    orden: 2,
    etiquetas: [
      { nombre: "Oro",    emoji: "🥇", color: "#eab308" },
      { nombre: "Plata",  emoji: "🥈", color: "#94a3b8" },
      { nombre: "Bronce", emoji: "🥉", color: "#b45309" },
    ],
  },
  {
    nombre: "Alergias e intolerancias",
    scope: "cliente",
    orden: 3,
    // Reusa el catálogo único UE-14 del proyecto (regla en memoria).
    etiquetas: ALERGENOS_UE_14.map((a) => ({
      nombre: a,
      emoji: "⚠",
      color: "#dc2626",
    })),
  },
];

export const SALA_ETIQUETAS_SEED: CategoriaEtiquetaSeed[] = [
  ...RESERVA_CATEGORIAS,
  ...CLIENTE_CATEGORIAS,
];

export function normalizeEtiquetaNombre(nombre: string): string {
  return nombre.trim().toLowerCase();
}
