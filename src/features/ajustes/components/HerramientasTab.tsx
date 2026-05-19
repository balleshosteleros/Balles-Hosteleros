"use client";

import {
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
  type LucideIcon,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TelefonoConfigPanel } from "@/features/ajustes/components/TelefonoConfigPanel";

type Herramienta = {
  id: string;
  nombre: string;
  descripcion: string;
  Icon: LucideIcon;
  iconClassName: string;
};

const HERRAMIENTAS: Herramienta[] = [
  {
    id: "email",
    nombre: "Correo",
    descripcion: "Bandeja de entrada Gmail integrada en el portal.",
    Icon: Mail,
    iconClassName: "text-red-500",
  },
  {
    id: "calendario",
    nombre: "Calendario",
    descripcion: "Calendario de Google sincronizado.",
    Icon: CalendarIcon,
    iconClassName: "text-blue-600",
  },
  {
    id: "reuniones",
    nombre: "Reuniones Meet",
    descripcion: "Videollamadas y reuniones de Google Meet.",
    Icon: Video,
    iconClassName: "text-emerald-600",
  },
  {
    id: "grabacion",
    nombre: "Grabación de pantalla",
    descripcion: "Captura y comparte grabaciones de pantalla.",
    Icon: Monitor,
    iconClassName: "text-red-500",
  },
  {
    id: "tareas",
    nombre: "Tareas",
    descripcion: "Gestor de tareas personales y de equipo.",
    Icon: CheckSquare2,
    iconClassName: "text-violet-600",
  },
  {
    id: "chat",
    nombre: "Comunicación interna",
    descripcion: "Chat interno entre miembros de la empresa.",
    Icon: MessageCircle,
    iconClassName: "text-green-500",
  },
  {
    id: "telefono",
    nombre: "Teléfono",
    descripcion: "Llamadas VoIP integradas.",
    Icon: Phone,
    iconClassName: "text-sky-600",
  },
  {
    id: "agenda",
    nombre: "Agenda de contactos",
    descripcion: "Directorio de contactos compartido.",
    Icon: Notebook,
    iconClassName: "text-yellow-500",
  },
  {
    id: "videovigilancia",
    nombre: "Videovigilancia",
    descripcion: "Acceso a las cámaras del local.",
    Icon: Cctv,
    iconClassName: "text-slate-700",
  },
  {
    id: "aplicaciones",
    nombre: "Aplicaciones",
    descripcion: "Accesos directos a aplicaciones externas.",
    Icon: Rocket,
    iconClassName: "text-amber-600",
  },
];

export function HerramientasTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Herramientas</h2>
        <p className="text-sm text-muted-foreground">
          Configura ajustes globales de permisos y visualización para las
          herramientas del portal. Estos ajustes afectarán a todos los usuarios
          de la empresa.
        </p>
      </div>

      <Accordion type="multiple" className="rounded-lg border bg-card">
        {HERRAMIENTAS.map(({ id, nombre, descripcion, Icon, iconClassName }) => (
          <AccordionItem
            key={id}
            value={id}
            className="border-b last:border-b-0 px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3 text-left">
                <Icon className={`h-5 w-5 shrink-0 ${iconClassName}`} />
                <div>
                  <div className="text-sm font-medium text-foreground">{nombre}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {descripcion}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {id === "telefono" ? (
                <TelefonoConfigPanel />
              ) : (
                <div className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                  Sin ajustes globales configurados todavía.
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
