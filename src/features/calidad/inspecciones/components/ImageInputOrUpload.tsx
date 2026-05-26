"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Link2, X, Loader2, ImageIcon } from "lucide-react";
import { subirImagenInspeccion } from "../services/foto-upload";

interface ImageInputOrUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  empresaId: string;
  kind?: "slide" | "card" | "image-block";
  placeholder?: string;
  /** Compacto: oculta miniatura cuando no hay valor. Útil dentro de tarjetas pequeñas. */
  compact?: boolean;
}

export function ImageInputOrUpload({
  value,
  onChange,
  empresaId,
  kind = "slide",
  placeholder = "URL de imagen (opcional)",
  compact = false,
}: ImageInputOrUploadProps) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);

  function pickFile() {
    fileRef.current?.click();
  }

  function handleFile(file: File | null) {
    if (!file) return;
    if (!empresaId) {
      toast.error("No hay empresa activa");
      return;
    }
    startTransition(async () => {
      const res = await subirImagenInspeccion(file, empresaId, kind);
      if (!res.ok) {
        toast.error(`Error al subir: ${res.error}`);
        return;
      }
      onChange(res.url);
      toast.success("Imagen subida");
    });
  }

  const hasValue = !!value;

  return (
    <div className="space-y-1.5">
      {hasValue ? (
        <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value!}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="flex-1 truncate text-xs text-muted-foreground" title={value!}>
            {value}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            onClick={() => onChange(null)}
            title="Quitar imagen"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : compact ? null : (
        <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-2 py-2 text-xs text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
          Sin imagen
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <div className="inline-flex overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`px-2 py-1 text-xs transition-colors ${
              mode === "upload"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <Upload className="h-3 w-3" /> Subir
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("url")}
            className={`px-2 py-1 text-xs transition-colors ${
              mode === "url"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <Link2 className="h-3 w-3" /> URL
            </span>
          </button>
        </div>

        {mode === "upload" ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 flex-1 text-xs"
              onClick={pickFile}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Subiendo…
                </>
              ) : (
                <>
                  <Upload className="h-3 w-3" /> {hasValue ? "Reemplazar" : "Elegir archivo"}
                </>
              )}
            </Button>
          </>
        ) : (
          <Input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={placeholder}
            className="h-7 flex-1 text-xs"
          />
        )}
      </div>
    </div>
  );
}
