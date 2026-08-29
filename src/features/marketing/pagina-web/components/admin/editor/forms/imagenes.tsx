"use client";

/**
 * Subida de imágenes reutilizable por los formularios de bloque.
 *
 * Se extrae aquí porque cuatro bloques (collage, historia, instagram, premios)
 * necesitan exactamente lo mismo que la galería: elegir archivos, comprimir,
 * subir al bucket y devolver la URL. Repetir ese bucle en cada formulario era
 * garantizar que se arreglara un bug en uno y no en los otros tres.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subirAsset } from "../../../../services/asset-upload";
import { MAX_IMAGEN_MB, MAX_IMAGEN_BYTES, traducirErrorSubida } from "@/shared/lib/documentos";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { obtenerEmpresaActivaCliente } from "@/features/empresa/actions/empresa-activa-cliente-actions";

export interface ImagenItem {
  url: string;
  alt: string;
}

/** Hook con la subida ya resuelta: devuelve las URLs listas para guardar. */
export function useSubidaImagenes() {
  const paginaId = useEditorStore((s) => s.paginaId);
  const [subiendo, setSubiendo] = useState(false);

  const subir = async (files: FileList, maxNuevas = 60): Promise<ImagenItem[]> => {
    if (!paginaId) {
      toast.error("Guarda la página antes de subir imágenes.");
      return [];
    }
    setSubiendo(true);
    try {
      const empresaId = await obtenerEmpresaActivaCliente();
      if (!empresaId) {
        toast.error("Sin contexto de empresa.");
        return [];
      }
      const nuevas: ImagenItem[] = [];
      for (const file of Array.from(files)) {
        if (nuevas.length >= maxNuevas) break;
        if (file.size > MAX_IMAGEN_BYTES) {
          toast.error(`"${file.name}" supera el máximo de ${MAX_IMAGEN_MB} MB y no se ha subido`);
          continue;
        }
        const res = await subirAsset(file, empresaId, paginaId);
        if (!res.ok) {
          toast.error(traducirErrorSubida(res.error, `No se pudo subir "${file.name}"`));
          continue;
        }
        nuevas.push({ url: res.url, alt: file.name.replace(/\.[^.]+$/, "") });
      }
      if (nuevas.length) {
        toast.success(
          `${nuevas.length} imagen${nuevas.length > 1 ? "es" : ""} subida${nuevas.length > 1 ? "s" : ""}`,
        );
      }
      return nuevas;
    } finally {
      setSubiendo(false);
    }
  };

  return { subir, subiendo };
}

/** Botón de subida para UNA sola imagen (foto de historia, avatar, fondo…). */
export function SubirImagenUnica({
  valor,
  onChange,
  etiqueta = "Subir imagen",
}: {
  valor?: string;
  onChange: (url: string) => void;
  etiqueta?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { subir, subiendo } = useSubidaImagenes();

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          const [img] = await subir(e.target.files, 1);
          if (img) onChange(img.url);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <div className="flex items-center gap-2">
        <div
          className="w-12 h-12 rounded bg-muted shrink-0 bg-cover bg-center"
          style={valor ? { backgroundImage: `url(${valor})` } : undefined}
        />
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => fileRef.current?.click()}
          disabled={subiendo}
        >
          {subiendo ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Subiendo…
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5 mr-2" /> {etiqueta}
            </>
          )}
        </Button>
        {valor ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-600"
            onClick={() => onChange("")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <Input
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…o pega aquí la URL de la imagen"
      />
    </div>
  );
}

/** Lista de imágenes con subida múltiple (collage, feed de Instagram…). */
export function ListaImagenes({
  imagenes,
  onChange,
  max = 60,
}: {
  imagenes: ImagenItem[];
  onChange: (imagenes: ImagenItem[]) => void;
  max?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { subir, subiendo } = useSubidaImagenes();

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          const nuevas = await subir(e.target.files, max - imagenes.length);
          if (nuevas.length) onChange([...imagenes, ...nuevas]);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => fileRef.current?.click()}
        disabled={subiendo || imagenes.length >= max}
      >
        {subiendo ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subiendo…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" /> Subir imágenes
          </>
        )}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Se comprimen automáticamente a 1920 px / WebP ≤1.5 MB.
      </p>
      {imagenes.map((img, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border p-2 bg-muted/20">
          <div
            className="w-12 h-12 rounded bg-muted shrink-0 bg-cover bg-center"
            style={img.url ? { backgroundImage: `url(${img.url})` } : undefined}
          />
          <div className="flex-1 space-y-1">
            <Input
              value={img.url}
              onChange={(e) => {
                const copia = [...imagenes];
                copia[i] = { ...copia[i], url: e.target.value };
                onChange(copia);
              }}
              placeholder="URL"
            />
            <Input
              value={img.alt}
              onChange={(e) => {
                const copia = [...imagenes];
                copia[i] = { ...copia[i], alt: e.target.value };
                onChange(copia);
              }}
              placeholder="Texto alternativo (SEO)"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-600"
            onClick={() => onChange(imagenes.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
