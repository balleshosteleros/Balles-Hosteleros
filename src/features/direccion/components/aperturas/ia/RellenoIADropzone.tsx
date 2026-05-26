"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import {
  extraerDeArchivo,
  FORMATOS_ACEPTADOS_INPUT,
} from "@/features/logistica/lib/importador-ia/extractor";
import type { PayloadExtraido } from "@/features/logistica/types/importador-ia";

/**
 * Dropzone multi-archivo para el flujo "Rellenar con IA" de Aperturas.
 *
 * Características:
 *  - Hasta `maxArchivos` (default 5) seleccionables a la vez.
 *  - Cada archivo se procesa por `extraerDeArchivo`: PDF/imagen → binario,
 *    Excel/CSV → tabla (lista de filas).
 *  - Tamaño máx 10 MB por archivo (cap más estricto que el del extractor para
 *    no reventar el límite de body de Next.js al pasar a server actions).
 *  - Lista de archivos cargados con botón eliminar.
 *  - Rechazo elegante de .doc/.docx (mensaje "Convierte a PDF, por favor").
 */
const MAX_BYTES_POR_ARCHIVO = 10 * 1024 * 1024;
const FORMATOS_NO_SOPORTADOS = ["doc", "docx", "odt", "rtf"];

export interface ArchivoCargado {
  nombre: string;
  tamano: number;
  payload: PayloadExtraido;
}

export function RellenoIADropzone({
  archivos,
  onChange,
  onError,
  maxArchivos = 5,
  disabled,
}: {
  archivos: ArchivoCargado[];
  onChange: (next: ArchivoCargado[]) => void;
  onError?: (mensaje: string) => void;
  maxArchivos?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const procesarArchivos = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;
      const lista = Array.from(files);
      if (lista.length === 0) return;
      setProcesando(true);
      try {
        const nuevos: ArchivoCargado[] = [];
        for (const file of lista) {
          if (archivos.length + nuevos.length >= maxArchivos) {
            onError?.(`Máximo ${maxArchivos} archivos por análisis.`);
            break;
          }
          const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
          if (FORMATOS_NO_SOPORTADOS.includes(ext)) {
            onError?.(`.${ext} no soportado todavía. Convierte a PDF, por favor.`);
            continue;
          }
          if (file.size > MAX_BYTES_POR_ARCHIVO) {
            onError?.(`${file.name}: supera los 10 MB.`);
            continue;
          }
          try {
            const payload = await extraerDeArchivo(file);
            nuevos.push({ nombre: file.name, tamano: file.size, payload });
          } catch (err) {
            onError?.(
              err instanceof Error ? `${file.name}: ${err.message}` : `${file.name}: error al leer.`,
            );
          }
        }
        if (nuevos.length > 0) onChange([...archivos, ...nuevos]);
      } finally {
        setProcesando(false);
      }
    },
    [archivos, disabled, maxArchivos, onChange, onError],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) void procesarArchivos(e.dataTransfer.files);
    },
    [procesarArchivos],
  );

  const eliminar = useCallback(
    (idx: number) => {
      const next = archivos.filter((_, i) => i !== idx);
      onChange(next);
    },
    [archivos, onChange],
  );

  const lleno = archivos.length >= maxArchivos;

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          if (disabled || lleno) return;
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => {
          if (disabled || lleno) return;
          inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        aria-disabled={disabled || lleno}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          disabled || lleno
            ? "cursor-not-allowed border-muted-foreground/15 bg-muted/30 opacity-60"
            : isDragging
              ? "border-amber-500 bg-amber-50"
              : "border-muted-foreground/25 hover:border-amber-400 hover:bg-amber-50/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={FORMATOS_ACEPTADOS_INPUT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              void procesarArchivos(e.target.files);
              e.target.value = "";
            }
          }}
        />
        <FileUp className="h-7 w-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          {lleno
            ? `Máximo ${maxArchivos} archivos`
            : procesando
              ? "Procesando archivos…"
              : "Arrastra archivos o pulsa para elegir"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          PDF, fotos, Excel o CSV · máx. 10 MB cada uno · hasta {maxArchivos} archivos
        </p>
      </div>

      {archivos.length > 0 && (
        <ul className="space-y-1">
          {archivos.map((a, i) => (
            <li
              key={`${a.nombre}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs"
            >
              <span className="flex-1 truncate" title={a.nombre}>
                <span className="font-medium">{a.nombre}</span>
                <span className="ml-2 text-muted-foreground">
                  {(a.tamano / 1024).toFixed(0)} KB · {a.payload.kind === "tabla" ? "tabla" : "documento"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => eliminar(i)}
                disabled={disabled}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                aria-label={`Eliminar ${a.nombre}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
