"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useScreenRecorder,
  formatDuration,
  type RecordOptions,
} from "../hooks/useScreenRecorder";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { suggestRecordingTitle } from "../actions/ai-actions";
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
  Share2,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function ScreenRecorder() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
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

  // Show preview once recording stops
  useEffect(() => {
    if (previewUrl && videoPreviewRef.current) {
      videoPreviewRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  async function handleAITitle() {
    setIsGeneratingTitle(true);
    try {
      const suggested = await suggestRecordingTitle(title);
      setTitle(suggested);
    } finally {
      setIsGeneratingTitle(false);
    }
  }

  function toggleOption(key: keyof RecordOptions) {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleCopyLink() {
    if (!result) return;
    const shareUrl = `${window.location.origin}/share/${result.videoId}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleStart() {
    const recordTitle = title.trim() || `Grabación ${new Date().toLocaleString("es-ES")}`;
    startRecording(recordTitle);
  }

  // ─── IDLE: Setup screen ───────────────────────────────────────────────────
  if (state === "idle") {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="rec-title">Nombre de la grabación (opcional)</Label>
          <div className="relative">
            <Input
              id="rec-title"
              className="pr-12"
              placeholder={`Grabación ${new Date().toLocaleDateString("es-ES")}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              type="button"
              onClick={handleAITitle}
              disabled={isGeneratingTitle}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-accent text-violet-500 disabled:opacity-50 transition-colors"
              title="Sugerir título con IA"
            >
              {isGeneratingTitle ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Options */}
        <div>
          <p className="text-sm font-medium mb-3">Opciones de grabación</p>
          <div className="grid grid-cols-2 gap-3">
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
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                "hover:bg-accent"
              )}
              onClick={() =>
                setOptions((p) => ({
                  ...p,
                  quality: p.quality === "1080p" ? "720p" : "1080p",
                }))
              }
            >
              <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
                <Monitor className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Calidad</p>
                <p className="text-xs text-muted-foreground">
                  Ahora: <strong>{options.quality}</strong> — clic para cambiar
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Start button */}
        <div className="pt-2">
          <Button
            onClick={handleStart}
            size="xl"
            variant="gradient"
            className="w-full gap-3 text-base"
          >
            <Circle className="h-5 w-5 fill-white" />
            Iniciar grabación de pantalla
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Se abrirá el selector de pantalla del navegador. Elige qué compartir.
          </p>
        </div>
      </div>
    );
  }

  // ─── REQUESTING: waiting for permission ───────────────────────────────────
  if (state === "requesting") {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4 animate-fade-in">
        <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto">
          <Monitor className="h-8 w-8 text-white animate-pulse" />
        </div>
        <h3 className="text-xl font-semibold">Esperando permiso...</h3>
        <p className="text-muted-foreground">
          Selecciona qué pantalla, ventana o pestaña quieres compartir en el
          diálogo del navegador.
        </p>
      </div>
    );
  }

  // ─── RECORDING / PAUSED ───────────────────────────────────────────────────
  if (state === "recording" || state === "paused") {
    return (
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        {/* Live indicator */}
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {state === "recording" ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <Badge variant="destructive" className="font-mono text-sm">
                      REC
                    </Badge>
                  </div>
                ) : (
                  <Badge variant="warning" className="font-mono text-sm">
                    PAUSA
                  </Badge>
                )}
              </div>
              <span className="font-mono text-2xl font-bold tabular-nums">
                {formatDuration(elapsed)}
              </span>
            </div>

            <p className="text-sm text-red-700 mb-4 font-medium">
              {title.trim() || "Grabación en curso"}
            </p>

            {/* Active options */}
            <div className="flex gap-2 flex-wrap mb-4">
              {options.includeSystemAudio && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Volume2 className="h-3 w-3" /> Audio
                </span>
              )}
              {options.includeMic && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Mic className="h-3 w-3" /> Micrófono
                </span>
              )}
              {options.includeCamera && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Camera className="h-3 w-3" /> Cámara
                </span>
              )}
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {options.quality}
              </span>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              {state === "recording" ? (
                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-red-200"
                  onClick={pauseRecording}
                >
                  <Pause className="h-4 w-4" />
                  Pausar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1 gap-2 border-orange-200"
                  onClick={resumeRecording}
                >
                  <Play className="h-4 w-4" />
                  Continuar
                </Button>
              )}
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                onClick={stopRecording}
              >
                <Square className="h-4 w-4" />
                Detener y guardar
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground">
          Para detener la grabación también puedes hacer clic en "Dejar de
          compartir" en la barra del navegador.
        </p>
      </div>
    );
  }

  // ─── UPLOADING ────────────────────────────────────────────────────────────
  if (state === "uploading") {
    return (
      <div className="max-w-lg mx-auto py-20 text-center space-y-4 animate-fade-in">
        <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
        <h3 className="text-xl font-semibold">Guardando grabación...</h3>
        <p className="text-muted-foreground">
          Procesando y guardando en{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            captures/recordings/
          </code>
        </p>
        <p className="text-xs text-muted-foreground">
          Duración grabada: <strong>{formatDuration(elapsed)}</strong>
        </p>
      </div>
    );
  }

  // ─── DONE ────────────────────────────────────────────────────────────────
  if (state === "done" && result) {
    const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/share/${result.videoId}`;

    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
        {/* Success header */}
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">¡Grabación guardada!</p>
            <p className="text-sm text-green-600">
              {formatDuration(result.duration)} •{" "}
              {(result.fileSize / 1_000_000).toFixed(1)} MB •{" "}
              <code className="text-xs bg-green-100 px-1 rounded">
                captures/recordings/
              </code>
            </p>
          </div>
        </div>

        {/* Video preview */}
        {previewUrl && (
          <Card>
            <CardContent className="p-2">
              <video
                ref={videoPreviewRef}
                controls
                className="w-full rounded-lg max-h-80 bg-black"
                src={previewUrl}
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <a href={result.url} download>
            <Button variant="outline" className="w-full gap-2">
              <Download className="h-4 w-4" />
              Descargar WebM
            </Button>
          </a>
          <Button
            variant={copied ? "secondary" : "outline"}
            className="w-full gap-2"
            onClick={handleCopyLink}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                ¡Copiado!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar link
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm">
          <Share2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground text-xs truncate">{shareUrl}</span>
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            className="flex-1 gap-2"
            onClick={reset}
          >
            <RotateCcw className="h-4 w-4" />
            Nueva grabación
          </Button>
          <Button
            variant="gradient"
            className="flex-1"
            onClick={() => router.push(`/videos/${result.videoId}`)}
          >
            Ver en mis videos →
          </Button>
        </div>
      </div>
    );
  }

  // ─── ERROR ────────────────────────────────────────────────────────────────
  if (state === "error") {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4 animate-fade-in">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
          <span className="text-3xl">😕</span>
        </div>
        <h3 className="text-xl font-semibold">Algo salió mal</h3>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={reset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Intentar de nuevo
        </Button>
      </div>
    );
  }

  return null;
}

// ─── Sub-component ────────────────────────────────────────────────────────────

interface OptionToggleProps {
  icon: React.ElementType;
  iconOff: React.ElementType;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function OptionToggle({
  icon: Icon,
  iconOff: IconOff,
  label,
  description,
  enabled,
  onToggle,
}: OptionToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
        enabled
          ? "border-primary bg-primary/5 hover:bg-primary/10"
          : "border-border bg-background hover:bg-accent"
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          enabled ? "gradient-bg" : "bg-muted"
        )}
      >
        {enabled ? (
          <Icon className="h-4 w-4 text-white" />
        ) : (
          <IconOff className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div>
        <p className={cn("text-sm font-medium", !enabled && "text-muted-foreground")}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
