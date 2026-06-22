/**
 * Mapa clave de icono → componente Lucide (PRP-065).
 *
 * Separado de `catalogo.ts` (datos puros) para no arrastrar componentes React a
 * Server Actions. Lo usan los componentes cliente (bandeja, cola, registro).
 */
import {
  Info,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  BellRing,
  FileCheck2,
  Megaphone,
  CalendarClock,
  ListChecks,
  ClipboardList,
  Bell,
  type LucideIcon,
} from "lucide-react";

const ICONOS: Record<string, LucideIcon> = {
  info: Info,
  alerta: AlertTriangle,
  error: AlertOctagon,
  exito: CheckCircle2,
  recordatorio: BellRing,
  liquidacion: FileCheck2,
  aviso_manual: Megaphone,
  vencimiento: CalendarClock,
  cronograma: ListChecks,
  comunicado: Megaphone,
  encuesta: ClipboardList,
};

/** Resuelve el componente de icono por su clave del catálogo. */
export function getIconoTipo(clave: string): LucideIcon {
  return ICONOS[clave] ?? Bell;
}
