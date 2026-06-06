"use client";

import { useEffect, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import type { ToolNotifKey } from "@/features/ajustes/data/ajustes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

const TOOL_META: Record<ToolNotifKey, { label: string; Icon: LucideIcon; color: string }> = {
  email: { label: "Correo", Icon: Mail, color: "text-red-500" },
  calendario: { label: "Calendario", Icon: CalendarIcon, color: "text-blue-600" },
  reuniones: { label: "Reuniones Meet", Icon: Video, color: "text-emerald-600" },
  grabacion: { label: "Grabación de pantalla", Icon: Monitor, color: "text-red-500" },
  tareas: { label: "Tareas", Icon: CheckSquare2, color: "text-violet-600" },
  chat: { label: "Comunicación interna", Icon: MessageCircle, color: "text-green-500" },
  telefono: { label: "Teléfono", Icon: Phone, color: "text-sky-600" },
  agenda: { label: "Agenda de contactos", Icon: Notebook, color: "text-yellow-500" },
  videovigilancia: { label: "Videovigilancia", Icon: Cctv, color: "text-slate-700" },
  aplicaciones: { label: "Aplicaciones", Icon: Rocket, color: "text-amber-600" },
};

const SEEN_KEY = (key: ToolNotifKey, empresaId: string) =>
  `bh_aviso_seen_${key}_${empresaId}`;

/**
 * Muestra los avisos emergentes de los iconos de la barra de herramientas.
 * Cada aviso se muestra UNA sola vez por usuario (localStorage) y por versión:
 * si el responsable vuelve a "Publicar" (bump de popupVersion) reaparece una
 * vez más. Si hay varios pendientes, se muestran de uno en uno.
 */
export function ToolsAvisoPopups() {
  const { ajustes, empresaActual } = useEmpresa();
  const notif = ajustes.notificaciones;
  const empresaId = empresaActual.id;
  const [tick, setTick] = useState(0); // fuerza recálculo tras cerrar uno

  const pendiente = (Object.keys(notif) as ToolNotifKey[]).find((k) => {
    const c = notif[k];
    if (!c.popupActivo || c.popupVersion <= 0) return false;
    if (!c.popupTitulo.trim() && !c.popupMensaje.trim()) return false;
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(SEEN_KEY(k, empresaId)) ?? "0");
    } catch {
      /* ignore */
    }
    return seen < c.popupVersion;
  });

  // `tick` participa en el render para reevaluar `pendiente` al cerrar.
  void tick;

  const [openKey, setOpenKey] = useState<ToolNotifKey | null>(null);
  useEffect(() => {
    setOpenKey(pendiente ?? null);
  }, [pendiente, empresaId]);

  if (!openKey) return null;
  const cfg = notif[openKey];
  const meta = TOOL_META[openKey];
  const { Icon } = meta;

  const cerrar = () => {
    try {
      localStorage.setItem(SEEN_KEY(openKey, empresaId), String(cfg.popupVersion));
    } catch {
      /* ignore */
    }
    setOpenKey(null);
    setTick((t) => t + 1);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) cerrar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${meta.color}`} />
            {cfg.popupTitulo.trim() || meta.label}
          </DialogTitle>
          {cfg.popupMensaje.trim() && (
            <DialogDescription className="whitespace-pre-line pt-1">
              {cfg.popupMensaje}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button onClick={cerrar}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
