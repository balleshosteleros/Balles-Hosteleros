"use client";

/**
 * Mini reproductor de la barra superior.
 *
 * Aparece SOLO cuando hay música sonando, ocupando el hueco libre a la izquierda
 * de la cabecera, junto al resto de herramientas. Es deliberadamente mínimo —
 * anterior, play/pausa, siguiente, título y lista — porque compite por espacio
 * con el nombre del módulo y no debe empujarlo.
 *
 * La X lo cierra solo visualmente: la música SIGUE sonando (cerrarlo para parar
 * la música sería una trampa: el botón que parece "quitar de en medio" apagaría
 * los altavoces del local a media cena). Vuelve solo en cuanto se lanza una
 * reproducción nueva desde Sala → Música.
 */

import { Play, Pause, SkipBack, SkipForward, X, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMusicaOpcional } from "@/features/sala/musica/contexts/musica-context";

export function MiniReproductor() {
  const musica = useMusicaOpcional();

  // Sin proveedor (pantallas públicas) o sin reproducción activa: no ocupa nada.
  if (!musica || !musica.miniVisible) return null;

  const { cancionActual, listaActual, reproduciendo } = musica;
  if (!cancionActual) return null;

  return (
    <div className="hidden lg:flex items-center gap-0.5 rounded-full border bg-muted/40 py-1 pl-1.5 pr-1 max-w-[320px] shrink-0">
      <Music2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => void musica.anterior()}
        title="Canción anterior"
        aria-label="Canción anterior"
      >
        <SkipBack className="!h-3.5 !w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => void musica.alternarPlay()}
        title={reproduciendo ? "Pausar" : "Reproducir"}
        aria-label={reproduciendo ? "Pausar" : "Reproducir"}
      >
        {reproduciendo ? (
          <Pause className="!h-3.5 !w-3.5" />
        ) : (
          <Play className="!h-3.5 !w-3.5" />
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => void musica.siguiente()}
        title="Canción siguiente"
        aria-label="Canción siguiente"
      >
        <SkipForward className="!h-3.5 !w-3.5" />
      </Button>

      {/*
        `min-w-0` es imprescindible: sin él, un título largo estira el contenedor
        flex e invade el nombre del módulo en vez de recortarse con puntos
        suspensivos.
      */}
      <div className="min-w-0 px-1.5 leading-tight">
        <p className="truncate text-[11px] font-medium text-foreground">
          {cancionActual.titulo}
        </p>
        {listaActual && (
          <p className="truncate text-[10px] text-muted-foreground">
            {listaActual.nombre}
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={musica.cerrarMini}
        title="Ocultar el mini reproductor (la música sigue sonando)"
        aria-label="Ocultar el mini reproductor"
      >
        <X className="!h-3 !w-3" />
      </Button>
    </div>
  );
}
