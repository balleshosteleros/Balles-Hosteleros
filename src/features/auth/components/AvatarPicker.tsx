"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Check, RefreshCw, Loader2, Sparkles, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { uploadAvatar } from "@/features/auth/actions/avatar-actions";
import { generateAiAvatar } from "@/features/auth/actions/avatar-ai-actions";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

type Mode = "menu" | "camera" | "preview";

export interface AvatarPickerProps {
  /** Llamado tras subir con éxito. Si no se pasa, se hace window.location.reload(). */
  onUploaded?: (publicUrl: string) => void;
  /** Texto del botón final ("Usar esta foto" por defecto). */
  confirmLabel?: string;
  /** Tema visual del contenedor (overlay oscuro vs dialog normal). */
  variant?: "overlay" | "dialog";
}

export function AvatarPicker({
  onUploaded,
  confirmLabel = "Usar esta foto",
  variant = "overlay",
}: AvatarPickerProps) {
  const { user } = useAuth();
  const { empresaActual, getLogoUrl } = useEmpresa();
  const empresaLogoUrl = getLogoUrl(empresaActual.id);
  const tieneLogoEmpresa = !!empresaLogoUrl;
  const [mode, setMode] = useState<Mode>("menu");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isOverlay = variant === "overlay";
  const helpColor = isOverlay ? "text-blue-300/60" : "text-muted-foreground";
  const errorBoxClass = isOverlay
    ? "rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300"
    : "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive";

  useEffect(() => {
    if (mode !== "camera") {
      stopCamera();
      return;
    }
    let cancelled = false;
    async function startCamera() {
      try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setCameraReady(true);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo acceder a la cámara.";
        setError(msg);
        setMode("menu");
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [mode]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }

  function takePicture() {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    const size = Math.min(v.videoWidth, v.videoHeight);
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;
    c.width = 720;
    c.height = 720;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, sx, sy, size, size, 0, 0, 720, 720);
    c.toBlob(
      (blob) => {
        if (!blob) {
          setError("No se pudo capturar la imagen.");
          return;
        }
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setMode("preview");
      },
      "image/jpeg",
      0.9,
    );
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setPreviewBlob(f);
    setPreviewUrl(URL.createObjectURL(f));
    setMode("preview");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function confirmUpload() {
    if (!previewBlob || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const ext =
        previewBlob.type === "image/png" ? "png" :
        previewBlob.type === "image/webp" ? "webp" : "jpg";
      const file = new File([previewBlob], `avatar.${ext}`, { type: previewBlob.type || "image/jpeg" });
      const fd = new FormData();
      fd.append("file", file);
      const url = await uploadAvatar(user.id, fd);

      setSubmitting(false);
      setGeneratingAi(true);
      const aiResult = await generateAiAvatar(user.id, empresaActual?.id ?? null);
      if (!aiResult.ok) {
        console.warn("[AvatarPicker] generación IA falló, conservando foto real:", aiResult.error);
      }
      setGeneratingAi(false);

      if (onUploaded) {
        onUploaded(aiResult.avatarAiUrl ?? url);
      } else {
        window.location.reload();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al subir la foto.";
      setError(msg);
      setSubmitting(false);
      setGeneratingAi(false);
    }
  }

  if (!tieneLogoEmpresa) {
    return (
      <div className="w-full">
        <div
          className={
            isOverlay
              ? "rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 text-amber-100"
              : "rounded-lg border border-amber-500/50 bg-amber-50 p-4 text-amber-900"
          }
        >
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">
                Falta el logotipo de {empresaActual.nombre}
              </p>
              <p className="text-xs leading-relaxed opacity-90">
                Antes de subir tu foto necesitamos el logotipo corporativo para
                generar tu uniforme. Pide a un administrador que lo suba en{" "}
                <span className="font-semibold">Ajustes → Empresa → Logotipo</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {error && <p className={`mb-4 ${errorBoxClass}`}>{error}</p>}

      {mode === "menu" && (
        <div className="space-y-3">
          <Button
            size="lg"
            onClick={() => setMode("camera")}
            className={
              isOverlay
                ? "w-full gap-2 bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30"
                : "w-full gap-2"
            }
          >
            <Camera className="h-5 w-5" />
            Hacer una foto con la cámara
          </Button>

          <Button
            size="lg"
            variant={isOverlay ? "secondary" : "outline"}
            onClick={() => fileInputRef.current?.click()}
            className={
              isOverlay
                ? "w-full gap-2 bg-white/10 text-white hover:bg-white/20 border border-white/20"
                : "w-full gap-2"
            }
          >
            <Upload className="h-5 w-5" />
            Subir desde mi dispositivo
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileChosen}
          />

          <p className={`pt-2 text-xs ${helpColor}`}>
            JPG, PNG o WEBP — hasta 5 MB.
          </p>
        </div>
      )}

      {mode === "camera" && (
        <div className="space-y-4">
          <div
            className={
              isOverlay
                ? "relative mx-auto aspect-square w-64 overflow-hidden rounded-2xl border border-white/20 bg-black shadow-lg"
                : "relative mx-auto aspect-square w-56 overflow-hidden rounded-2xl border bg-black shadow"
            }
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-blue-200/80">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              onClick={takePicture}
              disabled={!cameraReady}
              className={isOverlay ? "gap-2 bg-blue-600 text-white hover:bg-blue-700" : "gap-2"}
            >
              <Camera className="h-5 w-5" />
              Capturar
            </Button>
            <Button
              variant="ghost"
              onClick={() => setMode("menu")}
              className={isOverlay ? "text-blue-200 hover:bg-white/10" : ""}
            >
              Volver
            </Button>
          </div>
        </div>
      )}

      {mode === "preview" && previewUrl && (
        <div className="space-y-4">
          <div
            className={
              isOverlay
                ? "relative mx-auto aspect-square w-64 overflow-hidden rounded-full border-4 border-blue-500/40 shadow-xl"
                : "relative mx-auto aspect-square w-56 overflow-hidden rounded-full border-4 border-primary/30 shadow"
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Vista previa" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              onClick={confirmUpload}
              disabled={submitting || generatingAi}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Guardando…
                </>
              ) : generatingAi ? (
                <>
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  Generando uniforme con IA…
                </>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  {confirmLabel}
                </>
              )}
            </Button>
            {generatingAi && (
              <p className={`text-center text-xs ${helpColor}`}>
                Recreando tu foto con el uniforme corporativo (5–15 s)…
              </p>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                setPreviewBlob(null);
                setMode("menu");
              }}
              disabled={submitting || generatingAi}
              className={isOverlay ? "gap-2 text-blue-200 hover:bg-white/10" : "gap-2"}
            >
              <RefreshCw className="h-4 w-4" />
              Elegir otra
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
