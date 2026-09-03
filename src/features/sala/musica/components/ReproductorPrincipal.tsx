"use client";

/**
 * Reproductor grande de Sala → Música.
 *
 * Muestra qué suena, da los controles básicos y el listado de la lista en
 * curso. No hay barra de progreso arrastrable ni ecualizador: en un servicio
 * nadie los usa.
 *
 * El listado sí se usa, y mucho. Antes las canciones solo se veían abriendo el
 * diálogo de gestión de la lista, que tapa el reproductor y no señala cuál está
 * sonando: para saltarse un tema había que ir dando a "siguiente" a ciegas.
 */

import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Square, Volume2, VolumeX, Speaker, Store, ListMusic, Volume1 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatearDuracion } from "@/features/sala/musica/lib/formato";

export function ReproductorPrincipal() {
  const {
    locales,
    localId,
    setLocalId,
    listaActual,
    cancionActual,
    indiceActual,
    irACancion,
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

  // Quién tiene el altavoz cuando se intenta tomar el relevo, y si suena ahora.
  const [relevo, setRelevo] = useState<{
    equipo: string;
    usuario?: string;
    sonando: boolean;
  } | null>(null);
  const [verListado, setVerListado] = useState(false);

  const hayMusica = Boolean(listaActual && cancionActual);
  const variosLocales = locales.length > 1;
  const canciones = listaActual?.canciones ?? [];

  /*
    Con listas largas (las hay de 100 temas), abrir el listado por la primera
    canción obligaría a buscar a mano por dónde va. Se desplaza hasta la que
    suena, y la sigue cuando cambia sola.
  */
  const filaActivaRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (!verListado) return;
    filaActivaRef.current?.scrollIntoView({ block: "nearest" });
  }, [verListado, indiceActual]);

  async function onCambiarAltavoz(valor: boolean) {
    const res = await activarModoAltavoz(valor);
    // Ya hay otro equipo sonando en este local: se pregunta antes de relevarlo,
    // porque quitarle la música a un local en pleno servicio no puede pasar por
    // accidente.
    if (!res.ok && res.ocupadoPor) {
      setRelevo({
        equipo: res.ocupadoPor,
        usuario: res.ocupadoPorUsuario,
        sonando: Boolean(res.sonando),
      });
    }
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

            <Button
              variant={verListado ? "secondary" : "outline"}
              size="icon"
              className="h-9 w-9"
              onClick={() => setVerListado((v) => !v)}
              disabled={!hayMusica}
              title={verListado ? "Ocultar las canciones" : "Ver las canciones de la lista"}
              aria-label={verListado ? "Ocultar las canciones" : "Ver las canciones de la lista"}
              aria-expanded={verListado}
            >
              <ListMusic className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/*
          Listado de la lista en curso. Pinchar una canción salta a ella: es la
          forma natural de buscar un tema concreto, en vez de pulsar "siguiente"
          veinte veces.
        */}
        {hayMusica && verListado && (
          <div className="rounded-md border">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {listaActual!.nombre}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {indiceActual + 1} de {canciones.length}
              </p>
            </div>
            <ul className="max-h-72 divide-y overflow-y-auto">
              {canciones.map((c, i) => {
                const sonando = i === indiceActual;
                return (
                  <li key={c.id} ref={sonando ? filaActivaRef : null}>
                    <button
                      type="button"
                      onClick={() => void irACancion(i)}
                      aria-current={sonando ? "true" : undefined}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60 ${
                        sonando ? "bg-muted" : ""
                      }`}
                    >
                      {/*
                        La canción en curso lleva un icono en lugar del número:
                        de un vistazo, desde lejos y sin leer, se ve por dónde va
                        la lista. Si está en pausa, el icono lo dice.
                      */}
                      <span className="flex w-5 shrink-0 justify-center text-xs tabular-nums text-muted-foreground">
                        {sonando ? (
                          reproduciendo ? (
                            <Volume1 className="h-4 w-4 text-primary" />
                          ) : (
                            <Pause className="h-3.5 w-3.5 text-primary" />
                          )
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm ${
                            sonando ? "font-semibold text-foreground" : "text-foreground"
                          }`}
                        >
                          {c.titulo}
                        </span>
                        {c.artista && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {c.artista}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatearDuracion(c.duracionSeg)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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
            Dónde suena la música.

            El texto anterior era "Este equipo es el de los altavoces" y no se
            entendía: describía una configuración en vez de decir qué pasa al
            activarlo. Ahora se lee como lo que hace —"Sonar en este ordenador"—
            y la frase de debajo explica siempre la consecuencia, esté encendido
            o apagado.

            El interruptor no se puede quitar: es lo que decide POR QUÉ altavoces
            sale la música. Sin él, o no suena en ningún sitio, o suena a la vez
            en todos los ordenadores abiertos con unos segundos de desfase.
          */}
          <div className="flex items-center gap-2 shrink-0">
            <Speaker className={`h-4 w-4 ${esAltavoz ? "text-emerald-600" : "text-muted-foreground"}`} />
            <Label htmlFor="modo-altavoz" className="text-xs text-muted-foreground cursor-pointer">
              Sonar en este ordenador
            </Label>
            <Switch
              id="modo-altavoz"
              checked={esAltavoz}
              onCheckedChange={(v) => void onCambiarAltavoz(v)}
            />
          </div>
        </div>

        {/*
          Explicación del interruptor.

          Antes solo se decía DÓNDE sale la música, y la pregunta que hacía todo
          el mundo era otra: por qué existe el interruptor, si lo lógico sería
          que sonara y ya está. Ahora el texto responde eso — en el local suena
          una sola cosa por los altavoces buenos — porque si no se entiende, la
          reacción natural es encenderlo en todos los equipos y acabar con la
          misma canción sonando cuatro veces desfasada.
        */}
        <p className="text-xs text-muted-foreground">
          {esAltavoz
            ? "La música del local sale por este ordenador. Tus compañeros pueden cambiarla desde sus equipos, pero solo suena aquí: así no se solapan varias a la vez."
            : altavozNombre
              ? `La música del local sale por otro ordenador (${altavozNombre}). Desde aquí puedes cambiar lo que suena allí, pero este equipo no reproduce sonido.`
              : "En el local suena una sola música, por un único ordenador: el que esté conectado a los altavoces. Actívalo en ese, y desde los demás podréis cambiar lo que suena sin que se solape."}
        </p>
      </CardContent>

      {/*
        Relevo del altavoz. Se pregunta siempre que otro equipo siga vivo:
        dejar sin música un local en pleno servicio no puede pasar por descuido.
      */}
      <AlertDialog open={relevo !== null} onOpenChange={(v) => !v && setRelevo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {relevo?.sonando
                ? "La música está sonando ahora en el local"
                : "Otro equipo tiene la música de este local"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {/*
                Se nombra a la persona y se dice la consecuencia real. El texto
                anterior ("ese equipo dejará de sonar") sonaba inofensivo: quien
                lo leía desde la oficina no caía en que lo que se apaga son los
                altavoces de la sala, en pleno servicio.
              */}
              {relevo?.usuario
                ? `La tiene puesta ${relevo.usuario} (${relevo.equipo}).`
                : `La tiene puesta otro equipo del local (${relevo?.equipo}).`}{" "}
              {relevo?.sonando
                ? "Si continúas, el local se queda sin música y pasará a sonar por los altavoces de este ordenador."
                : "Si continúas, la música pasará a sonar por los altavoces de este ordenador."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRelevo(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRelevo(null);
                void activarModoAltavoz(true, true);
              }}
            >
              {/*
                El botón dice lo que ocurre, no lo que se pulsa: leído solo,
                "Sonar aquí" parecía añadir sonido, no quitárselo a la sala.
              */}
              {relevo?.sonando ? "Quitársela al local" : "Pasarla a este equipo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
