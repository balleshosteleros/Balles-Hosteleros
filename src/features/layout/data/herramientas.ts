// ─────────────────────────────────────────────────────────────────────────
// FUENTE ÚNICA DE VERDAD de las herramientas de la barra superior.
//
// Aquí (y SOLO aquí) se define cada herramienta con su icono, su nombre, su
// descripción y su COLOR. Todo lo que pinte una herramienta —la barra de
// herramientas (app-layout), la pantalla de Ajustes→Herramientas y los avisos
// emergentes (ToolsAvisoPopups)— lee de este catálogo. Si se cambia un color
// aquí, cambia en todos lados a la vez.
//
// El color se declara una sola vez como `colorKey` (ej. "red"). De ahí se
// derivan tanto el color del icono (texto) como el del badge (fondo), de modo
// que icono y círculo de aviso SIEMPRE coinciden.
// ─────────────────────────────────────────────────────────────────────────

import {
  Bell,
  Mail,
  Calendar as CalendarIcon,
  Video,
  Monitor,
  CheckSquare2,
  MessageCircle,
  Phone,
  Notebook,
  Cctv,
  Rocket,
  Lock,
  type LucideIcon,
} from "lucide-react";

// Paleta canónica de colores de herramientas. Cada clave mapea a la clase de
// texto (icono) y a la de fondo (badge). Añadir un color = añadir una entrada.
export const TOOL_COLORS = {
  red: { text: "text-red-500", bg: "bg-red-500" },
  orange: { text: "text-orange-500", bg: "bg-orange-500" },
  blue: { text: "text-blue-600", bg: "bg-blue-600" },
  emerald: { text: "text-emerald-600", bg: "bg-emerald-600" },
  violet: { text: "text-violet-600", bg: "bg-violet-600" },
  green: { text: "text-green-500", bg: "bg-green-500" },
  sky: { text: "text-sky-600", bg: "bg-sky-600" },
  yellow: { text: "text-yellow-500", bg: "bg-yellow-500" },
  slate: { text: "text-slate-700", bg: "bg-slate-700" },
  amber: { text: "text-amber-600", bg: "bg-amber-600" },
} as const;

export type ToolColorKey = keyof typeof TOOL_COLORS;

export const toolTextColor = (k: ToolColorKey) => TOOL_COLORS[k].text;
export const toolBadgeBg = (k: ToolColorKey) => TOOL_COLORS[k].bg;

// Clave de cada herramienta de la barra. "notificaciones" (la campana) es la
// primera: joya de la corona. El resto coincide con ToolNotifKey de ajustes.ts.
export type HerramientaId =
  | "notificaciones"
  | "email"
  | "calendario"
  | "reuniones"
  | "grabacion"
  | "tareas"
  | "chat"
  | "telefono"
  | "agenda"
  | "videovigilancia"
  | "aplicaciones"
  | "accesos";

export interface HerramientaDef {
  id: HerramientaId;
  nombre: string;
  descripcion: string;
  Icon: LucideIcon;
  colorKey: ToolColorKey;
}

// Orden = orden en la barra de herramientas (de izquierda a derecha).
export const HERRAMIENTAS: HerramientaDef[] = [
  {
    id: "notificaciones",
    nombre: "Notificaciones",
    descripcion: "Avisos del sistema dirigidos al empleado (campana y bandeja).",
    Icon: Bell,
    colorKey: "red",
  },
  {
    id: "email",
    nombre: "Correo",
    descripcion: "Bandeja de entrada Gmail integrada en el portal.",
    Icon: Mail,
    colorKey: "orange",
  },
  {
    id: "calendario",
    nombre: "Calendario",
    descripcion: "Calendario de Google sincronizado.",
    Icon: CalendarIcon,
    colorKey: "blue",
  },
  {
    id: "reuniones",
    nombre: "Reuniones Meet",
    descripcion: "Videollamadas y reuniones de Google Meet.",
    Icon: Video,
    colorKey: "emerald",
  },
  {
    id: "grabacion",
    nombre: "Grabación de pantalla",
    descripcion: "Captura y comparte grabaciones de pantalla.",
    Icon: Monitor,
    // En reposo es gris pizarra; al estar grabando el icono se pone rojo vivo
    // (excepción gestionada en RecordingTrigger, no es un color de catálogo).
    colorKey: "slate",
  },
  {
    id: "tareas",
    nombre: "Tareas",
    descripcion: "Gestor de tareas personales y de equipo.",
    Icon: CheckSquare2,
    colorKey: "violet",
  },
  {
    id: "chat",
    nombre: "Comunicación interna",
    descripcion: "Chat interno entre miembros de la empresa.",
    Icon: MessageCircle,
    colorKey: "green",
  },
  {
    id: "telefono",
    nombre: "Teléfono",
    descripcion: "Llamadas VoIP integradas.",
    Icon: Phone,
    colorKey: "sky",
  },
  {
    id: "agenda",
    nombre: "Agenda de contactos",
    descripcion: "Directorio de contactos compartido.",
    Icon: Notebook,
    colorKey: "yellow",
  },
  {
    id: "videovigilancia",
    nombre: "Videovigilancia",
    descripcion: "Acceso a las cámaras del local.",
    Icon: Cctv,
    colorKey: "slate",
  },
  {
    id: "aplicaciones",
    nombre: "Aplicaciones",
    descripcion: "Accesos directos a aplicaciones externas (abrir web y usuario).",
    Icon: Rocket,
    colorKey: "amber",
  },
  {
    id: "accesos",
    nombre: "Accesos y contraseñas",
    descripcion: "Bóveda segura de contraseñas, PINs y claves. Revelado con verificación de identidad.",
    Icon: Lock,
    colorKey: "red",
  },
];

// Acceso por id, para los consumidores que pintan un icono concreto.
export const HERRAMIENTA: Record<HerramientaId, HerramientaDef> = Object.fromEntries(
  HERRAMIENTAS.map((h) => [h.id, h]),
) as Record<HerramientaId, HerramientaDef>;
