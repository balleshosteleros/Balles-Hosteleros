"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { toast } from "sonner";
import {
  getNotifInterruptores,
  setNotifInterruptor,
} from "@/features/notificaciones/actions/notif-interruptores-actions";
import { NOTIFICACIONES_AUTOMATICAS } from "@/features/notificaciones/lib/catalogo-automaticas";

/**
 * Ajustes → Herramientas → Notificaciones.
 *
 * Enciende y apaga cada aviso automático del software. Se guarda al pulsar el
 * interruptor (sin botón Guardar): es un único dato y así se ve el efecto al
 * momento. Sin fila guardada = encendida.
 */
export function NotifAutomaticasPanel() {
  const [estado, setEstado] = useState<Record<string, boolean> | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    getNotifInterruptores().then(setEstado);
  }, []);

  if (!estado) {
    return (
      <div className="flex justify-center py-6">
        <LoadingSpinner />
      </div>
    );
  }

  const activo = (tipo: string) => estado[tipo] ?? true;

  const alternar = async (tipo: string, valor: boolean) => {
    const previo = estado;
    setEstado({ ...estado, [tipo]: valor });
    setGuardando(tipo);
    const res = await setNotifInterruptor(tipo, valor);
    setGuardando(null);
    if (!res.ok) {
      setEstado(previo);
      toast.error("No se pudo guardar el cambio.");
      return;
    }
    toast.success(valor ? "Notificación activada." : "Notificación desactivada.");
  };

  const apagadas = Object.values(estado).filter((v) => v === false).length;

  return (
    <div className="space-y-5 py-2">
      <p className="text-sm text-muted-foreground">
        Avisos que el software envía solo. Al apagar uno deja de enviarse a todo
        el mundo en esta empresa, tanto en la campana como al móvil.
        {apagadas > 0 && (
          <> Ahora mismo hay {apagadas} desactivada{apagadas === 1 ? "" : "s"}.</>
        )}
      </p>

      {NOTIFICACIONES_AUTOMATICAS.map((grupo) => (
        <div key={grupo.clave} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {grupo.titulo}
          </h4>
          <div className="divide-y rounded-lg border bg-muted/20">
            {grupo.items.map((n) => (
              <div
                key={n.tipo}
                className="flex items-start justify-between gap-4 p-3"
              >
                <div className="space-y-0.5">
                  <Label className="text-sm">{n.label}</Label>
                  <p className="text-xs text-muted-foreground">
                    {n.cuando} · Lo recibe: {n.destinatario.toLowerCase()}
                  </p>
                </div>
                <Switch
                  checked={activo(n.tipo)}
                  disabled={guardando === n.tipo}
                  onCheckedChange={(v) => alternar(n.tipo, v)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
