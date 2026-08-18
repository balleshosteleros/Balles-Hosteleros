"use client";

/**
 * Detalle de una lista: sus canciones, y (para quien gestiona) añadir o quitar.
 *
 * Se abre en diálogo y no en página aparte porque durante el servicio nadie
 * quiere perder de vista lo que está sonando para revisar una lista.
 */

import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  Play,
  Plus,
  Trash2,
  Upload,
  Loader2,
  Search,
  Music2,
  CornerUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useMusica } from "@/features/sala/musica/contexts/musica-context";
import { subirCanciones } from "@/features/sala/musica/lib/subir-canciones";
import {
  anadirCancionesALista,
  quitarCancionDeLista,
  borrarCancion,
} from "@/features/sala/musica/actions/musica-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import type { ListaMusica, Cancion } from "@/features/sala/musica/types";

/** Segundos → "m:ss". Devuelve "" si no se pudo leer la duración del archivo. */
function formatearDuracion(seg: number): string {
  if (!seg || seg <= 0) return "";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function DetalleLista({
  lista,
  open,
  onOpenChange,
}: {
  lista: ListaMusica;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { biblioteca, puedeGestionar, recargar, reproducirLista } = useMusica();
  const { confirm, dialog: dialogoConfirmacion } = useConfirmDelete();
  const [busqueda, setBusqueda] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const idsEnLista = useMemo(
    () => new Set(lista.canciones.map((c) => c.id)),
    [lista.canciones],
  );

  // Candidatas: lo que hay en biblioteca y todavía no está en esta lista.
  const disponibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return biblioteca
      .filter((c) => !idsEnLista.has(c.id))
      .filter(
        (c) =>
          !q ||
          c.titulo.toLowerCase().includes(q) ||
          (c.artista ?? "").toLowerCase().includes(q),
      );
  }, [biblioteca, idsEnLista, busqueda]);

  async function onAnadir(cancionId: string) {
    const res = await anadirCancionesALista(lista.id, [cancionId]);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo añadir");
      return;
    }
    await recargar();
  }

  async function onQuitar(cancionId: string) {
    const res = await quitarCancionDeLista(lista.id, cancionId);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo quitar");
      return;
    }
    await recargar();
  }

  /**
   * Borra la canción de verdad: desaparece de TODAS las listas y su archivo se
   * elimina del almacenamiento. Se confirma porque no tiene vuelta atrás —
   * habría que volver a subir el archivo.
   */
  async function onEliminar(c: Cancion) {
    const ok = await confirm({
      title: "Eliminar canción",
      description: `«${c.titulo}» se borrará de todas las listas y se eliminará el archivo. Tendrías que volver a subirlo.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;

    const res = await borrarCancion(c.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo eliminar");
      return;
    }
    toast.success("Canción eliminada");
    await recargar();
  }

  async function onArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (archivos.length === 0) return;

    setSubiendo(true);
    // Con `lista.id`, lo subido entra directamente en esta lista.
    const r = await subirCanciones(archivos, lista.id);
    setSubiendo(false);

    if (r.subidas > 0) {
      toast.success(
        r.subidas === 1 ? "1 canción añadida" : `${r.subidas} canciones añadidas`,
      );
    }
    for (const err of r.errores.slice(0, 3)) toast.error(err);
    await recargar();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lista.nombre}
            {lista.etiqueta && (
              <Badge variant="secondary" className="text-[10px]">
                {lista.etiqueta}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {lista.canciones.length === 1
              ? "1 canción"
              : `${lista.canciones.length} canciones`}
            {!lista.disponibleAhora && lista.motivoBloqueo
              ? ` · ${lista.motivoBloqueo}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void reproducirLista(lista)}
              disabled={!lista.disponibleAhora || lista.canciones.length === 0}
            >
              <Play className="h-4 w-4 mr-1.5" />
              Reproducir
            </Button>

            {puedeGestionar && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={subiendo}
              >
                {subiendo ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1.5" />
                )}
                {subiendo ? "Subiendo…" : "Subir a esta lista"}
              </Button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={onArchivos}
          />

          {/* Canciones de la lista */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              En esta lista
            </h4>
            {lista.canciones.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Todavía no hay canciones.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {lista.canciones.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => void reproducirLista(lista, i)}
                      disabled={!lista.disponibleAhora}
                      className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                      title={lista.disponibleAhora ? "Reproducir desde aquí" : lista.motivoBloqueo ?? ""}
                    >
                      <p className="truncate text-sm text-foreground">{c.titulo}</p>
                      {c.artista && (
                        <p className="truncate text-xs text-muted-foreground">
                          {c.artista}
                        </p>
                      )}
                    </button>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatearDuracion(c.duracionSeg)}
                    </span>
                    {/*
                      Dos acciones distintas y fáciles de confundir, por eso van
                      separadas y con nombre propio:

                      · QUITAR (flecha) → sale de esta lista pero sigue en la
                        biblioteca, lista para otras listas. No libera espacio.
                      · ELIMINAR (papelera) → borra el archivo de verdad, de
                        todas las listas, y libera el espacio que ocupaba.

                      Antes solo existía la papelera y hacía lo primero: parecía
                      que borraba y en realidad el archivo seguía consumiendo
                      cuota sin que nadie lo viera.
                    */}
                    {puedeGestionar && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => void onQuitar(c.id)}
                          title="Quitar de esta lista (la canción sigue en la biblioteca)"
                          aria-label="Quitar de esta lista"
                        >
                          <CornerUpRight className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => void onEliminar(c)}
                          title="Eliminar la canción del todo y liberar espacio"
                          aria-label="Eliminar canción"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Añadir desde la biblioteca */}
          {puedeGestionar && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Añadir desde la biblioteca
              </h4>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar canción"
                  className="h-9 pl-8"
                />
              </div>

              {disponibles.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  {biblioteca.length === 0 ? (
                    <span className="flex flex-col items-center gap-1">
                      <Music2 className="h-5 w-5" />
                      Sube canciones para empezar.
                    </span>
                  ) : (
                    "No queda ninguna canción por añadir."
                  )}
                </p>
              ) : (
                <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                  {disponibles.slice(0, 50).map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{c.titulo}</p>
                        {c.artista && (
                          <p className="truncate text-xs text-muted-foreground">
                            {c.artista}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatearDuracion(c.duracionSeg)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => void onAnadir(c.id)}
                        title="Añadir a la lista"
                        aria-label="Añadir a la lista"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {disponibles.length > 50 && (
                <p className="text-[11px] text-muted-foreground">
                  Mostrando 50 de {disponibles.length}. Usa el buscador para
                  encontrar una concreta.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      {dialogoConfirmacion}
    </Dialog>
  );
}
