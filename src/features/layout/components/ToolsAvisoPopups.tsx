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
import { HERRAMIENTA, toolTextColor } from "@/features/layout/data/herramientas";

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
  const meta = HERRAMIENTA[openKey];
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
            <Icon className={`h-5 w-5 ${toolTextColor(meta.colorKey)}`} />
            {cfg.popupTitulo.trim() || meta.nombre}
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
