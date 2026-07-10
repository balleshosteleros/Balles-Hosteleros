"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { subirModeloPdf } from "../actions/modelos-pdf-actions";

/**
 * Sube manualmente el PDF presentado de un modelo. Subir el documento marca el
 * modelo como PRESENTADO (mismo efecto que cuando la gestoría lo sube por el
 * enlace del correo). Tras subir, refresca para reflejar el nuevo estado.
 */
export function SubirDocumentoModeloButton({ modeloId }: { modeloId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-seleccionar el mismo archivo
    if (!file) return;
    setSubiendo(true);
    try {
      const res = await subirModeloPdf(modeloId, file);
      if (res.ok) {
        toast.success("Documento subido. El modelo queda presentado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "No se pudo subir el documento.");
      }
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFile}
      />
      <Button
        variant="default"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        className="bg-green-600 hover:bg-green-700"
      >
        {subiendo ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-1" />
        )}
        Subir documento
      </Button>
    </>
  );
}
