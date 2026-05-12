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
  Library,
} from "lucide-react";
import Link from "next/link";
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
import { useScreenRecorder, formatDuration, type RecordOptions } from "../hooks/useScreenRecorder";

export function RecordingDrawer() {
  const { isDrawerOpen, setDrawerOpen, state } = useRecordingStore();
  
  return (
    <Sheet open={isDrawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md [&>button]:hidden">
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
                <h3 className="font-semibold text-sm">ReelForge Recorder</h3>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Grabación de pantalla</p>
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
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<RecordOptions>({
    includeSystemAudio: true,
    includeMic: true,
    includeCamera: false,
    quality: "1080p",
  });
  const [copied, setCopied] = useState(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const {
    state,
    elapsed,
    error,
    result,
    previewUrl,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    reset,
  } = useScreenRecorder(options);

  useEffect(() => {
    if (previewUrl && videoPreviewRef.current) {
      videoPreviewRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  function toggleOption(key: keyof RecordOptions) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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
              label="Audio del sistema"
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
              label="Cámara web"
              description="Burbuja de cámara (PiP)"
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

        <div className="pt-2 border-t space-y-3">
          <SheetClose asChild>
            <Link href="/mi-panel/grabaciones" className="block">
              <Button variant="ghost" className="w-full gap-2 text-primary hover:text-primary hover:bg-primary/5 font-semibold">
                <Library className="h-4 w-4" />
                Ver todas las grabaciones
              </Button>
            </Link>
          </SheetClose>

          <Button variant="ghost" className="w-full gap-2 text-muted-foreground" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Grabar otro video
          </Button>
        </div>
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
}: any) {
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
