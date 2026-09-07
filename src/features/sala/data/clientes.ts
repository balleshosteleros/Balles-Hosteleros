/** NUEVO 0-1 visitas · REGULAR 2-4 · VIP 5+. Ver `clasificacion-cliente.ts`. */
import type { EstadoPermiso } from "@/features/marketing/lib/permiso-publicidad";

export type ClasificacionCliente = "REGULAR" | "VIP" | "NUEVO";

export interface Cliente {
  id: string;
  /**
   * Puede venir vacío. Los contactos que entran por WhatsApp traen el nombre
   * del perfil, que a veces es un emoji o una inicial y no es un nombre: se
   * guarda vacío y en pantalla se lee "Sin nombre". Se les identifica por el
   * teléfono.
   */
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
  /** Consentimiento para comunicaciones comerciales (RGPD). */
  /**
   * Permiso de publicidad, uno por canal. Tres estados, no dos: "sin preguntar"
   * (la mayoría de la base, que entró migrada) no es lo mismo que "baja", que es
   * una negativa expresa y no admite volver a escribir.
   */
  permisoEmail?: EstadoPermiso;
  permisoSms?: EstadoPermiso;
  permisoWhatsapp?: EstadoPermiso;
  /**
   * Canal por el que la persona nos dejó sus datos la PRIMERA vez: WEB,
   * GOOGLE, WHATSAPP, EMAIL (una landing de newsletter), TELEFONO, WALKIN…
   *
   * NO es el origen de sus reservas: un cliente puede escribirnos por WhatsApp
   * y no reservar nunca, o dejar el correo en una landing sin pisar el
   * restaurante. Se lee con `origenLabel()`, igual que en reservas, para que el
   * mismo canal no se llame de dos formas en dos pantallas.
   *
   * `null` = no se sabe por dónde entró. No es un canal.
   */
  origen?: string | null;
  /**
   * Nombre del perfil de WhatsApp, tal cual, con sus emojis.
   *
   * No es el nombre del cliente: es como aparece esa persona en el móvil del
   * restaurante, y es lo único que permite casar un chat con esta ficha. De él
   * se saca `nombre` cuando debajo hay un nombre de verdad
   * (`shared/lib/nombre-desde-perfil.ts`); cuando no, la ficha se queda sin
   * nombre y esto es lo único que hay.
   */
  nombreWhatsapp?: string | null;
}

export const SAMPLE_CLIENTES: Cliente[] = [
  { id: "c1", nombre: "María", apellidos: "García", telefono: "612345678", email: "maria@email.com", clasificacion: "VIP", visitas: 24, ultimaVisita: "2026-04-05", observaciones: "Prefiere mesa junto a la ventana", notasInternas: "" },
  { id: "c2", nombre: "Carlos", apellidos: "López", telefono: "698765432", email: "carlos@email.com", clasificacion: "VIP", visitas: 52, ultimaVisita: "2026-04-06", observaciones: "Cliente habitual desde 2023", notasInternas: "Contacto de prensa local" },
  { id: "c3", nombre: "Ana", apellidos: "Martínez", telefono: "655443322", email: "ana@email.com", clasificacion: "VIP", visitas: 8, ultimaVisita: "2026-03-20", observaciones: "Alergia a frutos secos", notasInternas: "" },
  { id: "c4", nombre: "Pedro", apellidos: "Ruiz", telefono: "633221100", email: "pedro@email.com", clasificacion: "VIP", visitas: 15, ultimaVisita: "2026-04-01", observaciones: "", notasInternas: "Organiza cenas de empresa" },
  { id: "c5", nombre: "Laura", apellidos: "Fernández", telefono: "677889900", email: "", clasificacion: "NUEVO", visitas: 1, ultimaVisita: "2026-04-07", observaciones: "", notasInternas: "" },
  { id: "c6", nombre: "Javier", apellidos: "Sánchez", telefono: "644556677", email: "javier@email.com", clasificacion: "REGULAR", visitas: 3, ultimaVisita: "2025-11-15", observaciones: "", notasInternas: "No viene desde noviembre" },
];
