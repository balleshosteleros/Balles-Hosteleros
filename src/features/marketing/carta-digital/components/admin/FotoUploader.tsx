"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Button } from "@/shared/components/ui/button";
import { Upload } from "lucide-react";
import { subirFotoItem } from "../../services/foto-upload";

export function FotoUploader({
  empresaId,
  itemId,
  fotoUrl,
  onUploaded,
}: {
  empresaId: string;
  itemId: string;
  fotoUrl: string | null;
  onUploaded: (url: string, path: string) => void;
}) {
  const [preview, setPreview] = useState<string | null>(fotoUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFile = (file: File | null) => {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    startTransition(async () => {
      const res = await subirFotoItem(file, empresaId, itemId);
      if (!res.ok) {
        setError(res.error);
        setPreview(fotoUrl);
        return;
      }
      onUploaded(res.url, res.path);
      setPreview(res.url);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-stone-100 ring-1 ring-stone-200">
        {preview ? (
          <Image src={preview} alt="Foto del plato" fill sizes="320px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-stone-300">
            🍽️
          </div>
        )}
      </div>
      <label>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="primary"
          size="lg"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2"
          asChild
        >
          <span>
            <Upload className="h-5 w-5" />
            {pending ? "Subiendo..." : "Subir foto"}
          </span>
        </Button>
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
