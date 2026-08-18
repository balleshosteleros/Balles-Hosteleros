"use client";

/**
 * Reproductor grande de Sala → Música.
 *
 * Muestra qué suena y da los controles básicos. Nada más: no hay barra de
 * progreso arrastrable, ni ecualizador, ni cola editable, porque en un servicio
 * nadie los usa — lo único que se hace de verdad es poner una lista, subir o
 * bajar el volumen y saltar una canción que no encaja.
 */

import { useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Square, Volume2, VolumeX, Speaker, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMusica } from "@/features/sala/musica/contexts/musica-context";

export function ReproductorPrincipal() {
  const {
    locales,
    localId,
    setLocalId,
    listaActual,
    cancionActual,
    reproduciendo,
    volumen,
    esAltavoz,
    altavozNombre,
    activarModoAltavoz,
    alternarPlay,
    siguiente,
    anterior,
    parar,
    cambiarVolumen,
  } = useMusica();

  // Equipo que ya hace de altavoz cuando se intenta tomar el relevo.
  const [relevoDe, setRelevoDe] = useState<string | null>(null);

  const hayMusica = Boolean(listaActual && cancionActual);
  const variosLocales = locales.length > 1;

  async function onCambiarAltavoz(valor: boolean) {
    const res = await activarModoAltavoz(valor);
    // Ya hay otro equipo sonando en este local: se pregunta antes de relevarlo,
    // porque quitarle la música a un local en pleno servicio no puede pasar por
    // accidente.
    if (!res.ok && res.ocupadoPor) setRelevoDe(res.ocupadoPor);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/*
          Selector de local. Cada local tiene su propia música sonando, aunque
          usen la misma lista. Con un solo local no se enseña: sería una decisión
          sin alternativa ocupando sitio.
        */}
        {variosLocales && (
          <div className="flex items-center gap-2 border-b pb-3">
            <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Label htmlFor="local-musica" className="text-xs text-muted-foreground">
              Local
            </Label>
            <Select value={localId ?? ""} onValueChange={setLocalId}>
              <SelectTrigger id="local-musica" className="h-8 w-auto min-w-[180px]">
                <SelectValue placeholder="Elige un local" />
              </SelectTrigger>
              <SelectContent>
                {locales.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Qué está sonando */}
          <div className="min-w-0 flex-1">
            {hayMusica ? (
              <>
                <p className="truncate text-base font-semibold text-foreground">
                  {cancionActual!.titulo}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {cancionActual!.artista || "Sin artista"}
                  {listaActual && (
                    <>
                      {" · "}
                      <span className="font-medium">{listaActual.nombre}</span>
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-muted-foreground">
                  No hay música sonando
                </p>
                <p className="text-sm text-muted-foreground">
                  Elige una lista y pulsa reproducir.
                </p>
              </>
            )}
          </div>

          {/* Controles */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => void anterior()}
              disabled={!hayMusica}
              title="Canción anterior"
              aria-label="Canción anterior"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              className="h-11 w-11 rounded-full"
              onClick={() => void alternarPlay()}
              disabled={!hayMusica}
              title={reproduciendo ? "Pausar" : "Reproducir"}
              aria-label={reproduciendo ? "Pausar" : "Reproducir"}
            >
              {reproduciendo ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => void siguiente()}
              disabled={!hayMusica}
              title="Canción siguiente"
              aria-label="Canción siguiente"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 ml-1"
              onClick={() => void parar()}
              disabled={!hayMusica}
              title="Parar"
              aria-label="Parar"
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Volumen */}
          <div className="flex items-center gap-2 max-w-xs flex-1">
            {volumen === 0 ? (
              <VolumeX className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <Slider
              value={[volumen]}
              onValueChange={(v) => void cambiarVolumen(v[0] ?? 0)}
              max={100}
              step={1}
              aria-label="Volumen"
            />
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
              {volumen}%
            </span>
          </div>

          {/*
            Modo altavoz. Solo el equipo conectado a los altavoces debe tenerlo
            activado; el resto son mandos a distancia. Sin esto, la misma canción
            sonaría a la vez en todos los ordenadores abiertos.
          */}
          <div className="flex items-center gap-2 shrink-0">
            <Speaker className={`h-4 w-4 ${esAltavoz ? "text-emerald-600" : "text-muted-foreground"}`} />
            <Label htmlFor="modo-altavoz" className="text-xs text-muted-foreground cursor-pointer">
              Este equipo es el de los altavoces
            </Label>
            <Switch
              id="modo-altavoz"
              checked={esAltavoz}
              onCheckedChange={(v) => void onCambiarAltavoz(v)}
            />
            {esAltavoz && (
              <Badge variant="secondary" className="text-[10px]">
                Sonando aquí
              </Badge>
            )}
          </div>
        </div>

        {!esAltavoz && (
          <p className="text-xs text-muted-foreground">
            {altavozNombre
              ? "La música suena en el equipo conectado a los altavoces de este local. Desde aquí controlas lo que se escucha allí."
              : "Ningún equipo está marcado como altavoz de este local todavía. Activa el interruptor en el ordenador conectado a los altavoces."}
          </p>
        )}
      </CardContent>

      {/*
        Relevo del altavoz. Se pregunta siempre que otro equipo siga vivo:
        dejar sin música un local en pleno servicio no puede pasar por descuido.
      */}
      <AlertDialog open={relevoDe !== null} onOpenChange={(v) => !v && setRelevoDe(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ya hay un equipo sonando en este local</AlertDialogTitle>
            <AlertDialogDescription>
              La música de este local está saliendo por otro ordenador. Si
              continúas, ese equipo dejará de sonar y la música pasará a este.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRelevoDe(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRelevoDe(null);
                void activarModoAltavoz(true, true);
              }}
            >
              Sonar aquí
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
