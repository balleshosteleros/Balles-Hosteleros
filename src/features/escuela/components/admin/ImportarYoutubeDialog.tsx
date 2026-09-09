"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  importarDesdeYoutube,
  previsualizarYoutube,
} from "../../actions/importar-youtube-actions";
import type { VideoYoutube } from "../../services/youtube-lista";

/**
 * Traer un módulo entero desde YouTube.
 *
 * Primero se enseña QUÉ se va a traer y solo después se crea: así no aparecen
 * treinta lecciones inesperadas dentro de un curso.
 */
export function ImportarYoutubeDialog({
  abierto,
  cursoId,
  cursoTitulo,
  onCerrar,
  onImportado,
}: {
  abierto: boolean;
  cursoId: string;
  cursoTitulo: string;
  onCerrar: () => void;
  onImportado: () => void;
}) {
  const [url, setUrl] = useState("");
  const [modulo, setModulo] = useState("");
  const [videos, setVideos] = useState<VideoYoutube[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState("");

  useEffect(() => {
    if (abierto) return;
    setUrl("");
    setModulo("");
    setVideos(null);
    setError("");
    setResultado("");
  }, [abierto]);

  async function mirar() {
    setCargando(true);
    setError("");
    setResultado("");
    const res = await previsualizarYoutube(url);
    setCargando(false);
    if (!res.ok) {
      setVideos(null);
      setError(res.error ?? "No se ha podido leer la lista.");
      return;
    }
    setVideos(res.videos);
  }

  async function traer() {
    setCargando(true);
    setError("");
    const res = await importarDesdeYoutube({ cursoId, url, tituloModulo: modulo });
    setCargando(false);
    if (!res.ok) {
      setError(res.error ?? "No se ha podido traer.");
      return;
    }
    setResultado(
      res.creadas
        ? `Se han creado ${res.creadas} ${res.creadas === 1 ? "lección" : "lecciones"}${
            res.repetidas ? ` (${res.repetidas} ya estaban)` : ""
          }.`
        : "Todos esos vídeos ya estaban en el curso.",
    );
    setVideos(null);
    onImportado();
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MonitorPlay className="h-5 w-5 text-red-600" />
            Traer vídeos de YouTube
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Las lecciones se crean en «{cursoTitulo}» con el título de cada vídeo. El vídeo se
            sigue viendo desde YouTube: no se descarga nada.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="url-youtube">Lista de reproducción o canal</Label>
            <Input
              id="url-youtube"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setVideos(null);
              }}
              placeholder="https://www.youtube.com/playlist?list=…"
            />
            <p className="text-xs text-muted-foreground">
              Vale una lista «no listada»: no sale en las búsquedas, pero se abre con el enlace.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="modulo-youtube">Módulo donde van</Label>
            <Input
              id="modulo-youtube"
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
              placeholder="Módulo 1 · Fundamentos"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {resultado ? <p className="text-sm text-emerald-600">{resultado}</p> : null}

          {videos ? (
            <div className="rounded-lg border">
              <p className="border-b px-3 py-2 text-sm font-medium">
                {videos.length} {videos.length === 1 ? "vídeo" : "vídeos"}
              </p>
              <ul className="max-h-56 divide-y overflow-y-auto text-sm">
                {videos.map((v, i) => (
                  <li key={v.videoId} className="flex gap-2 px-3 py-2">
                    <span className="w-5 shrink-0 text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1">{v.titulo || v.videoId}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
          {videos ? (
            <Button onClick={traer} disabled={cargando}>
              {cargando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Traer
            </Button>
          ) : (
            <Button onClick={mirar} disabled={cargando || !url.trim()}>
              {cargando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Ver qué hay
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
