"use client";

import { useState, useRef, useEffect } from "react";
import {
  Monitor,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Circle,
  Pause,
  Play,
  Square,
  Download,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Volume2,
  VolumeX,
  Copy,
  Check,
  X,
  FileVideo,
  ExternalLink,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRecordingStore } from "../store/recording-store";
import { useRecorder, formatDuration } from "../contexts/recorder-context";

export function RecordingDrawer() {
  const { isDrawerOpen, setDrawerOpen, state } = useRecordingStore();
  const { reset } = useRecorder();

  function handleOpenChange(open: boolean) {
    if (!open && (state === "done" || state === "error")) {
      reset();
    }
    setDrawerOpen(open);
  }

  return (
    <Sheet open={isDrawerOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 [&>button]:hidden">
        <SheetTitle className="sr-only">Grabadora de Pantalla</SheetTitle>

        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-2 rounded-lg relative",
                state === "recording" ? "bg-red-100 text-red-600 animate-pulse" : "bg-red-50 text-red-600"
              )}>
                <Monitor className="h-5 w-5" />
                <div className={cn(
                  "absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-white",
                  state === "recording" ? "bg-red-500" : "bg-red-500"
                )} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Grabación de pantalla</h3>
              </div>
            </div>

            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <RecordingContent />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RecordingContent() {
  const { state } = useRecordingStore();
  const [title, setTitle] = useState("");
  const [copied, setCopied] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const {
    options,
    toggleOption,
    error,
    result,
    previewUrl,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    reset,
  } = useRecorder();

  const { elapsed } = useRecordingStore();

  useEffect(() => {
    if (previewUrl && videoPreviewRef.current) {
      videoPreviewRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  async function handleCopyLink() {
    if (!result) return;
    const shareUrl = result.url.startsWith("blob:")
      ? result.url
      : `${window.location.origin}${result.url}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleStart() {
    const recordTitle = title.trim() || `Grabación ${new Date().toLocaleString("es-ES")}`;
    startRecording(recordTitle);
  }

  if (state === "idle") {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="space-y-2">
          <Label htmlFor="rec-title">Nombre de la grabación</Label>
          <Input
            id="rec-title"
            placeholder={`Grabación ${new Date().toLocaleDateString("es-ES")}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Configuración</p>
          <div className="grid grid-cols-1 gap-3">
            <OptionToggle
              icon={Volume2}
              iconOff={VolumeX}
              label="Sonido"
              description="Captura el sonido de tu PC"
              enabled={options.includeSystemAudio}
              onToggle={() => toggleOption("includeSystemAudio")}
            />
            <OptionToggle
              icon={Mic}
              iconOff={MicOff}
              label="Micrófono"
              description="Tu voz mientras grabas"
              enabled={options.includeMic}
              onToggle={() => toggleOption("includeMic")}
            />
            <OptionToggle
              icon={Camera}
              iconOff={CameraOff}
              label="Cámara"
              description="Burbuja de cámara"
              enabled={options.includeCamera}
              onToggle={() => toggleOption("includeCamera")}
            />
          </div>
        </div>

        <Button
          onClick={handleStart}
          className="w-full gap-3 h-12 text-base font-semibold shadow-lg shadow-red-200 bg-red-600 hover:bg-red-700"
        >
          <Circle className="h-5 w-5 fill-white animate-pulse text-white" />
          Iniciar Grabación
        </Button>

        <RecordingsList />
      </div>
    );
  }

  if (state === "requesting") {
    return (
      <div className="py-20 text-center space-y-4 animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
          <Monitor className="h-10 w-10 text-primary animate-bounce" />
        </div>
        <h3 className="text-xl font-bold">Esperando permiso</h3>
        <p className="text-sm text-muted-foreground px-4">
          Selecciona la pantalla o ventana que quieres capturar en el diálogo del navegador.
        </p>
      </div>
    );
  }

  if (state === "recording" || state === "paused") {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Card className="border-red-100 bg-red-50/50 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                {state === "recording" ? (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-ping absolute" />
                    <div className="w-3 h-3 bg-red-500 rounded-full relative" />
                    <Badge className="bg-red-100 text-red-600 border-red-200 hover:bg-red-100">
                      EN VIVO
                    </Badge>
                  </>
                ) : (
                  <Badge className="bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-100">
                    PAUSADO
                  </Badge>
                )}
              </div>
              <span className="font-mono text-3xl font-bold tabular-nums text-slate-800">
                {formatDuration(elapsed)}
              </span>
            </div>

            <p className="text-sm font-semibold text-slate-700 truncate mb-6">
              {title.trim() || "Grabación en curso..."}
            </p>

            <div className="grid grid-cols-2 gap-3">
              {state === "recording" ? (
                <Button
                  variant="outline"
                  className="gap-2 bg-white border-slate-200"
                  onClick={pauseRecording}
                >
                  <Pause className="h-4 w-4" />
                  Pausar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="gap-2 bg-white border-slate-200"
                  onClick={resumeRecording}
                >
                  <Play className="h-4 w-4" />
                  Continuar
                </Button>
              )}
              <Button
                variant="destructive"
                className="gap-2 shadow-lg shadow-red-200"
                onClick={stopRecording}
              >
                <Square className="h-4 w-4" />
                Detener
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "uploading") {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
        <h3 className="text-xl font-bold">Procesando Video</h3>
        <p className="text-sm text-muted-foreground">
          Guardando tu grabación de {formatDuration(elapsed)}...
        </p>
      </div>
    );
  }

  if (state === "done" && result) {
    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold">¡Listo!</h3>
          <p className="text-sm text-muted-foreground">Grabación completada con éxito</p>
        </div>

        {previewUrl && (
          <div className="rounded-xl overflow-hidden border bg-black aspect-video shadow-xl">
            <video
              ref={videoPreviewRef}
              controls
              className="w-full h-full"
              src={previewUrl}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <a href={result.url} download className="w-full">
            <Button variant="outline" className="w-full gap-2">
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          </a>
          <Button
            variant={copied ? "secondary" : "outline"}
            className="w-full gap-2"
            onClick={handleCopyLink}
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Link"}
          </Button>
        </div>

        <div className="pt-2 border-t">
          <Button variant="ghost" className="w-full gap-2 text-muted-foreground" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Grabar otro video
          </Button>
        </div>

        <RecordingsList />
      </div>
    );
  }

  if (state === "done" && !result) {
    return (
      <div className="space-y-6">
        <div className="py-8 text-center space-y-3">
          <h3 className="text-lg font-bold">Grabación anterior cerrada</h3>
          <p className="text-sm text-muted-foreground">
            Sigue disponible abajo en tus grabaciones guardadas.
          </p>
          <Button variant="outline" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Nueva grabación
          </Button>
        </div>
        <RecordingsList />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="py-16 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h3 className="text-xl font-bold">Error</h3>
        <p className="text-sm text-red-500">{error || "No se pudo iniciar la grabación"}</p>
        <Button variant="outline" onClick={reset}>Reintentar</Button>
      </div>
    );
  }

  return null;
}

function OptionToggle({
  icon: Icon,
  iconOff: IconOff,
  label,
  description,
  enabled,
  onToggle,
}: {
  icon: typeof Camera;
  iconOff: typeof CameraOff;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
        enabled
          ? "border-red-500 bg-red-50/50 ring-1 ring-red-500/20"
          : "border-border bg-background hover:bg-muted/50"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
        enabled ? "bg-red-600 text-white shadow-md shadow-red-200" : "bg-muted text-muted-foreground"
      )}>
        {enabled ? <Icon className="h-5 w-5" /> : <IconOff className="h-5 w-5" />}
      </div>
      <div>
        <p className={cn("text-sm font-semibold", !enabled && "text-muted-foreground")}>{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

interface SavedRecording {
  id: string;
  title: string;
  url: string;
  duration: number;
  file_size: number;
  created_at: string;
}

function RecordingsList() {
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/recordings")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (alive && Array.isArray(data)) setRecordings(data);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta grabación?")) return;
    const res = await fetch("/api/recordings", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });
    if (res.ok) setRecordings((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-3 pt-4 border-t">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Mis grabaciones</p>
        <span className="text-[11px] text-muted-foreground">{recordings.length}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : recordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <FileVideo className="h-6 w-6 text-muted-foreground/40 mb-1" />
          <p className="text-xs text-muted-foreground">Aún no hay grabaciones</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
          {recordings.map((rec) => (
            <div
              key={rec.id}
              className="flex items-center gap-2 p-2 rounded-md border border-border/60 hover:bg-muted/40 transition-colors"
            >
              <div className="w-8 h-8 rounded bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                <FileVideo className="h-4 w-4" />
              </div>
              <a
                href={rec.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 group"
                title={rec.title}
              >
                <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                  {rec.title}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(rec.created_at).toLocaleDateString("es-ES")} · {formatDuration(rec.duration)}
                </p>
              </a>
              <a
                href={rec.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary"
                title="Abrir"
                aria-label="Abrir"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={rec.url}
                download={`${rec.title}.webm`}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary"
                title="Descargar"
                aria-label="Descargar"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(rec.id)}
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Eliminar"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
