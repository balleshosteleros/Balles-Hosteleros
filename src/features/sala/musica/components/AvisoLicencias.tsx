"use client";

/**
 * Pautas de música legal, visibles ANTES de subir nada.
 *
 * Va aquí dentro y no en un manual aparte porque un documento que nadie abre no
 * evita ningún problema. El sitio donde importa es justo al lado del botón de
 * subir, en el momento en que alguien va a añadir música.
 *
 * Se dirige a CUALQUIER empresa que use el software, no solo a la nuestra: cada
 * cliente que llegue verá estas mismas pautas antes de subir su primer archivo.
 *
 * Se puede plegar (y recuerda que se plegó) para que quien ya lo tiene claro no
 * lo tenga delante cada día, pero vuelve a mostrarse entero mientras no haya
 * ninguna canción subida — que es cuando de verdad hace falta leerlo.
 */

import { useState, useEffect } from "react";
import { ShieldCheck, ChevronDown, ChevronRight, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const CLAVE_PLEGADO = "bh_musica_aviso_plegado";

export function AvisoLicencias({ hayCanciones }: { hayCanciones: boolean }) {
  const [plegado, setPlegado] = useState(false);

  useEffect(() => {
    try {
      setPlegado(localStorage.getItem(CLAVE_PLEGADO) === "1");
    } catch {
      /* sin localStorage: se muestra abierto, que es el lado seguro */
    }
  }, []);

  // Mientras no haya nada subido, el aviso se muestra entero aunque se plegara:
  // es justo el momento en el que alguien va a subir su primera música.
  const abierto = !plegado || !hayCanciones;

  function alternar() {
    const nuevo = !plegado;
    setPlegado(nuevo);
    try {
      localStorage.setItem(CLAVE_PLEGADO, nuevo ? "1" : "0");
    } catch {
      /* sin localStorage: el estado dura solo esta sesión */
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20">
      <CardContent className="p-4">
        <button
          type="button"
          onClick={alternar}
          className="flex w-full items-center gap-2 text-left"
          aria-expanded={abierto}
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="flex-1 text-sm font-semibold text-foreground">
            Antes de subir música, lee esto
          </span>
          {abierto ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        {abierto && (
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <p>
              Poner música en un local abierto al público exige dos cosas
              distintas. Tenerlas claras evita disgustos.
            </p>

            <div className="space-y-2">
              <div className="rounded-md border bg-background/60 p-3">
                <p className="font-medium text-foreground">
                  1. Licencia del local (SGAE y AGEDI/AIE)
                </p>
                <p className="mt-0.5">
                  Se paga por tener música en el local, venga de donde venga. La
                  gestiona cada empresa con esas entidades y ningún software la
                  sustituye. Son dos entidades separadas: pagar una no cubre la
                  otra.
                </p>
              </div>

              <div className="rounded-md border bg-background/60 p-3">
                <p className="font-medium text-foreground">
                  2. Derecho a usar estos archivos
                </p>
                <p className="mt-0.5">
                  Es el permiso sobre las canciones concretas que subes aquí.
                  Depende de dónde las hayas obtenido.
                </p>
              </div>
            </div>

            <div>
              <p className="font-medium text-foreground">Sirve para subir aquí</p>
              <ul className="mt-1 space-y-1">
                {[
                  "Música comprada en formato descargable (la compras una vez y es tuya).",
                  "Música libre de derechos por suscripción, mientras la suscripción siga activa.",
                  "Servicios de música para negocios, que además suelen incluir la licencia.",
                  "Grabaciones propias o de artistas que os han dado permiso por escrito.",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-medium text-foreground">No sirve</p>
              <ul className="mt-1 space-y-1">
                {[
                  "Música descargada de YouTube o de webs de descarga.",
                  "Archivos sacados de una cuenta personal de streaming.",
                  "Copias de discos que no habéis comprado.",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="border-t pt-3 text-xs">
              Consejo: nombra los archivos como «Artista - Título.mp3» y el
              software rellenará solo el artista y el título al subirlos.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
