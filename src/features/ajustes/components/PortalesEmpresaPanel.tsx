"use client";

/**
 * Ajustes → Departamentos → MARKETING → Página web.
 * Qué portales públicos tiene contratados ESTA empresa.
 *
 * Va aquí, junto a la dirección web, porque es lo que la web enseña: lo que se
 * apague deja de salir en su menú y su dirección pública deja de responder.
 * No todas las empresas venden lo mismo —una coctelería puede no querer portal
 * de empleo, y la gestora del grupo no es un restaurante al que reservar mesa—,
 * y hasta ahora eso se adivinaba mirando los datos en lugar de preguntarlo.
 *
 * Marcarlo no basta para que el enlace aparezca: sigue haciendo falta que haya
 * algo que enseñar (vacantes publicadas, salas, la carta publicada). Es un
 * techo, no un atajo.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { PORTALES, type PortalesEmpresa, type PortalPublico } from "@/features/empresa/lib/portales";
import {
  getPortalesEmpresa,
  savePortalesEmpresa,
} from "@/features/ajustes/actions/portales-actions";

export function PortalesEmpresaPanel() {
  const [portales, setPortales] = useState<PortalesEmpresa | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    getPortalesEmpresa().then((res) => {
      if (!vivo) return;
      setPortales(res.ok ? res.data : {});
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function alternar(clave: PortalPublico, valor: boolean) {
    if (!portales || guardando) return;
    const siguiente = { ...portales, [clave]: valor };

    // Se pinta ya y se guarda detrás: si el guardado falla se deshace, para que
    // la pantalla nunca enseñe un portal apagado que sigue respondiendo.
    setPortales(siguiente);
    setGuardando(true);
    const res = await savePortalesEmpresa(siguiente);
    setGuardando(false);
    if (!res.ok) {
      setPortales(portales);
      toast.error("No se pudo guardar");
      return;
    }
    toast.success("Guardado");
  }

  if (portales == null) {
    return (
      <div className="flex justify-center py-4">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Portales públicos de esta empresa
      </p>

      <div className="space-y-3">
        {PORTALES.map((portal) => {
          // Lo que no está escrito cuenta como contratado: toda empresa se monta
          // con sus portales en marcha.
          const activo = portales[portal.clave] !== false;
          return (
            <div key={portal.clave} className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold">{portal.label}</Label>
                <p className="text-xs text-muted-foreground">
                  {activo
                    ? portal.ayuda
                    : `No sale en su web ni responde su dirección. ${portal.ayuda}`}
                </p>
              </div>
              <Switch
                checked={activo}
                disabled={guardando}
                onCheckedChange={(v) => void alternar(portal.clave, v)}
              />
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Lo que se apaga desaparece de la web y su dirección pública deja de
        responder. Marcarlo no basta para que salga: hace falta además que haya
        algo que enseñar.
      </p>
    </div>
  );
}
