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
  getEstructuraWebEditable,
  getPortalesEmpresa,
  saveEstructuraWebEditable,
  savePortalesEmpresa,
} from "@/features/ajustes/actions/portales-actions";

export function PortalesEmpresaPanel() {
  const [portales, setPortales] = useState<PortalesEmpresa | null>(null);
  const [estructura, setEstructura] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([getPortalesEmpresa(), getEstructuraWebEditable()]).then(
      ([resPortales, resEstructura]) => {
        if (!vivo) return;
        setPortales(resPortales.ok ? resPortales.data : {});
        setEstructura(resEstructura.ok ? resEstructura.data : false);
      },
    );
    return () => {
      vivo = false;
    };
  }, []);

  async function alternarEstructura(valor: boolean) {
    if (guardando) return;
    const anterior = estructura;
    setEstructura(valor);
    setGuardando(true);
    const res = await saveEstructuraWebEditable(valor);
    setGuardando(false);
    if (!res.ok) {
      setEstructura(anterior);
      toast.error("No se pudo guardar");
      return;
    }
    toast.success("Guardado");
  }

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

      {/* Hasta dónde llega el restaurante en su propio editor. Lo de fábrica es
          el contenido: la plantilla es la misma para todos, y abrir la mano con
          la estructura es la vía rápida a webs rotas. */}
      <div className="border-t pt-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Editor de la web
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label className="text-xs font-bold">
              Dejar que el restaurante cambie la estructura de su web
            </Label>
            <p className="text-xs text-muted-foreground">
              {estructura
                ? "Puede añadir, borrar y reordenar secciones, además de escribir el contenido."
                : "Solo escribe el contenido: textos, fotos y enlaces. Las secciones y su orden no se tocan."}
            </p>
          </div>
          <Switch
            checked={estructura}
            disabled={guardando}
            onCheckedChange={(v) => void alternarEstructura(v)}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Los colores y las tipografías no se editan nunca desde aquí: salen de
          Ajustes → Imagen de marca, para que la web se parezca al local.
        </p>
      </div>
    </div>
  );
}
