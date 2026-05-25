"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { TipoProducto } from "@/features/logistica/data/productos";
import { listProveedores } from "@/features/logistica/actions/proveedores-actions";
import { listCategoriasProducto } from "@/features/logistica/actions/categorias-producto-actions";
import { useCatalogosLogistica } from "@/features/logistica/hooks/useCatalogosLogistica";
import {
  CAMPOS_OBLIGATORIOS_POR_TIPO,
  ETIQUETAS_CAMPOS,
  filaToProductoInput,
  type CampoProducto,
  type FilaSugerida,
} from "@/features/logistica/types/importador-ia";
import {
  extraerDeArchivo,
  FORMATOS_ACEPTADOS_INPUT,
} from "@/features/logistica/lib/importador-ia/extractor";
import { analizarImportacionIA } from "@/features/logistica/actions/importador-ia-actions";
import { bulkImportProductos } from "@/features/logistica/actions/producto-actions";

interface ImportadorIADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: TipoProducto;
  onImportSuccess?: () => void;
}

/** Columnas a mostrar en la tabla de revisión, según tipo de producto. */
const COLUMNAS_POR_TIPO: Record<TipoProducto, CampoProducto[]> = {
  compra: [
    "nombre",
    "categoria",
    "proveedor",
    "precioCompra",
    "iva",
    "unidad",
    "formato",
    "observaciones",
  ],
  venta: [
    "nombre",
    "categoria",
    "precioVenta",
    "coste",
    "unidad",
    "observaciones",
  ],
  elaboracion: [
    "nombre",
    "categoria",
    "coste",
    "unidad",
    "formato",
    "observaciones",
  ],
};

type Estado = "vacio" | "analizando" | "revision" | "guardando";

export function ImportadorIADialog({
  open,
  onOpenChange,
  tipo,
  onImportSuccess,
}: ImportadorIADialogProps) {
  const [estado, setEstado] = useState<Estado>("vacio");
  const [filas, setFilas] = useState<FilaSugerida[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState<string>("");
  const [resumenIA, setResumenIA] = useState<string | null>(null);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [proveedoresValidos, setProveedoresValidos] = useState<string[]>([]);
  const [categoriasValidas, setCategoriasValidas] = useState<string[]>([]);
  const catalogos = useCatalogosLogistica();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const obligatorias = CAMPOS_OBLIGATORIOS_POR_TIPO[tipo];
  const columnas = COLUMNAS_POR_TIPO[tipo];

  // Cargar proveedores al abrir el diálogo (solo cuando aplique a este tipo).
  useEffect(() => {
    if (!open || tipo !== "compra") return;
    let cancelled = false;
    listProveedores().then((res) => {
      if (cancelled || !res.ok) return;
      const nombres = res.data
        .map((p) => p.nombre_comercial)
        .filter((n): n is string => typeof n === "string" && n.trim().length > 0);
      setProveedoresValidos(nombres);
    });
    return () => {
      cancelled = true;
    };
  }, [open, tipo]);

  // Cargar catálogo de categorías al abrir (siempre, todos los tipos).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listCategoriasProducto(tipo).then((res) => {
      if (cancelled) return;
      setCategoriasValidas(res.ok ? res.data.map((c) => c.nombre) : []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, tipo]);

  const resetState = useCallback(() => {
    setEstado("vacio");
    setFilas([]);
    setNombreArchivo("");
    setResumenIA(null);
    setErrorAnalisis(null);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) resetState();
      onOpenChange(next);
    },
    [onOpenChange, resetState],
  );

  const handleArchivo = useCallback(
    async (file: File) => {
      setEstado("analizando");
      setNombreArchivo(file.name);
      setErrorAnalisis(null);
      try {
        const payload = await extraerDeArchivo(file);
        const res = await analizarImportacionIA({
          payload,
          tipo,
          proveedoresValidos,
          categoriasValidas,
        });
        if (res.error || !res.resultado) {
          setErrorAnalisis(res.error ?? "Error desconocido");
          setEstado("vacio");
          return;
        }
        setFilas(res.resultado.filas);
        setResumenIA(res.resultado.resumen ?? null);
        setEstado("revision");
      } catch (err) {
        setErrorAnalisis(
          err instanceof Error ? err.message : "No se pudo procesar el archivo.",
        );
        setEstado("vacio");
      }
    },
    [tipo, proveedoresValidos, categoriasValidas],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleArchivo(file);
    },
    [handleArchivo],
  );

  const updateCelda = useCallback(
    (tempId: string, campo: CampoProducto, valor: string) => {
      setFilas((prev) =>
        prev.map((f) =>
          f.tempId === tempId
            ? {
                ...f,
                valores: { ...f.valores, [campo]: valor === "" ? null : valor },
                // Si el usuario edita, esa celda pasa a confianza 1 (es humana).
                confianza: { ...f.confianza, [campo]: 1 },
              }
            : f,
        ),
      );
    },
    [],
  );

  const eliminarFila = useCallback((tempId: string) => {
    setFilas((prev) => prev.filter((f) => f.tempId !== tempId));
  }, []);

  const anadirFilaVacia = useCallback(() => {
    setFilas((prev) => [
      ...prev,
      {
        tempId: `nueva-${Date.now()}-${prev.length}`,
        valores: {},
        confianza: {},
      },
    ]);
  }, []);

  /** Devuelve los campos obligatorios sin rellenar para cada fila. */
  const camposFaltantesPorFila = useMemo(() => {
    const out: Record<string, CampoProducto[]> = {};
    for (const f of filas) {
      const faltan: CampoProducto[] = [];
      for (const c of obligatorias) {
        if (!(f.valores[c] ?? "").toString().trim()) faltan.push(c);
      }
      if (faltan.length > 0) out[f.tempId] = faltan;
    }
    return out;
  }, [filas, obligatorias]);

  const totalFaltantes = useMemo(
    () => Object.values(camposFaltantesPorFila).reduce((a, b) => a + b.length, 0),
    [camposFaltantesPorFila],
  );

  const puedeGuardar = filas.length > 0 && totalFaltantes === 0 && !isPending;

  const guardar = useCallback(() => {
    startTransition(async () => {
      setEstado("guardando");
      const inputs = filas.map((f) => filaToProductoInput(f, tipo));
      const res = await bulkImportProductos(inputs as Parameters<typeof bulkImportProductos>[0]);
      if (res.error) {
        toast.error(`Error al guardar: ${res.error}`);
        setEstado("revision");
        return;
      }
      toast.success(
        `${res.imported} producto${res.imported === 1 ? "" : "s"} importado${
          res.imported === 1 ? "" : "s"
        } correctamente`,
      );
      onImportSuccess?.();
      handleClose(false);
    });
  }, [filas, tipo, onImportSuccess, handleClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Importar con IA — {labelTipo(tipo)}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Sube cualquier archivo (Excel, CSV, PDF, foto de carta o albarán). La IA leerá
            el documento, propondrá la base de datos y tú revisas antes de guardar.
          </DialogDescription>
        </DialogHeader>

        {/* ── Estado: subida / análisis ───────────────────────────────── */}
        {(estado === "vacio" || estado === "analizando") && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              className={`w-full max-w-2xl cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition ${
                isDragging
                  ? "border-amber-500 bg-amber-50"
                  : "border-muted-foreground/25 hover:border-amber-400 hover:bg-amber-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={FORMATOS_ACEPTADOS_INPUT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    void handleArchivo(f);
                    e.target.value = "";
                  }
                }}
              />

              {estado === "analizando" ? (
                <div className="flex flex-col items-center gap-3 text-sm">
                  <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                  <p className="font-medium">Analizando {nombreArchivo}…</p>
                  <p className="text-xs text-muted-foreground">
                    La IA está leyendo el documento y extrayendo los productos.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <FileUp className="h-12 w-12 text-muted-foreground" />
                  <p className="text-base font-semibold">
                    Arrastra aquí tu archivo o pulsa para elegir
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Acepta Excel, CSV, PDF y fotos (PNG, JPG, HEIC). Máx. 20 MB.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {errorAnalisis && estado === "vacio" && (
          <div className="mx-6 mb-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorAnalisis}</span>
          </div>
        )}

        {/* ── Estado: revisión ───────────────────────────────────────── */}
        {(estado === "revision" || estado === "guardando") && (
          <>
            {resumenIA && (
              <div className="mx-1 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <span className="font-semibold">Nota de la IA: </span>
                {resumenIA}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>
                {filas.length} fila{filas.length === 1 ? "" : "s"} detectada
                {filas.length === 1 ? "" : "s"} en{" "}
                <span className="font-medium text-foreground">{nombreArchivo}</span>
              </span>
              <span className="flex items-center gap-3">
                <LeyendaConfianza />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={anadirFilaVacia}
                >
                  <Plus className="h-3 w-3" /> Añadir fila
                </Button>
              </span>
            </div>

            <div className="flex-1 overflow-auto rounded-lg border mt-2">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                  <tr className="border-b">
                    {columnas.map((c) => (
                      <th
                        key={c}
                        className="text-left px-2 py-2 font-semibold whitespace-nowrap"
                      >
                        {ETIQUETAS_CAMPOS[c]}
                        {obligatorias.includes(c) && (
                          <span className="ml-0.5 text-destructive" title="Obligatorio">
                            *
                          </span>
                        )}
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => {
                    const faltan = camposFaltantesPorFila[f.tempId] ?? [];
                    return (
                      <tr
                        key={f.tempId}
                        className={`border-b ${faltan.length > 0 ? "bg-destructive/5" : "hover:bg-muted/30"}`}
                      >
                        {columnas.map((c) => (
                          <td key={c} className="px-1 py-1 align-top">
                            {c === "unidad" ? (
                              <CeldaCatalogo
                                valor={f.valores[c] ?? ""}
                                confianza={f.confianza?.[c]}
                                opciones={catalogos.unidades}
                                onChange={(v) => updateCelda(f.tempId, c, v)}
                              />
                            ) : c === "iva" ? (
                              <CeldaCatalogo
                                valor={f.valores[c] ?? ""}
                                confianza={f.confianza?.[c]}
                                opciones={catalogos.ivas.map((o) => ({ value: o, label: o }))}
                                onChange={(v) => updateCelda(f.tempId, c, v)}
                                permitirVacio
                              />
                            ) : c === "categoria" ? (
                              <CeldaCatalogo
                                valor={f.valores[c] ?? ""}
                                confianza={f.confianza?.[c]}
                                opciones={categoriasValidas.map((p) => ({ value: p, label: p }))}
                                onChange={(v) => updateCelda(f.tempId, c, v)}
                                placeholderVacio={
                                  categoriasValidas.length === 0
                                    ? "Sin categorías — créalas en Configuración"
                                    : "— elegir —"
                                }
                                deshabilitado={categoriasValidas.length === 0}
                              />
                            ) : c === "proveedor" ? (
                              <CeldaCatalogo
                                valor={f.valores[c] ?? ""}
                                confianza={f.confianza?.[c]}
                                opciones={proveedoresValidos.map((p) => ({ value: p, label: p }))}
                                onChange={(v) => updateCelda(f.tempId, c, v)}
                                permitirVacio
                                placeholderVacio={
                                  proveedoresValidos.length === 0
                                    ? "Sin proveedores dados de alta"
                                    : "— sin asignar —"
                                }
                                deshabilitado={proveedoresValidos.length === 0}
                              />
                            ) : (
                              <CeldaEditable
                                valor={f.valores[c] ?? ""}
                                confianza={f.confianza?.[c]}
                                esObligatorio={obligatorias.includes(c)}
                                estaVacio={
                                  obligatorias.includes(c) &&
                                  !(f.valores[c] ?? "").toString().trim()
                                }
                                onChange={(v) => updateCelda(f.tempId, c, v)}
                              />
                            )}
                          </td>
                        ))}
                        <td className="px-1 py-1 align-top">
                          <button
                            type="button"
                            onClick={() => eliminarFila(f.tempId)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Eliminar fila"
                            aria-label="Eliminar fila"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <DialogFooter className="mt-2 flex items-center justify-between gap-3 sm:justify-between">
              <div className="text-xs">
                {totalFaltantes > 0 ? (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Faltan {totalFaltantes} dato{totalFaltantes === 1 ? "" : "s"}{" "}
                    obligatorio{totalFaltantes === 1 ? "" : "s"} (marcados con *).
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Todo listo para guardar.
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                <Button onClick={guardar} disabled={!puedeGuardar}>
                  {estado === "guardando" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    `Guardar ${filas.length} producto${filas.length === 1 ? "" : "s"}`
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Subcomponentes ─────────────────────────────────────────────── */

/**
 * Select genérico para campos con catálogo cerrado (unidad, iva, proveedor, etc.).
 * - `permitirVacio`: si true, "" es una opción válida (campo opcional).
 * - `deshabilitado`: bloquea el select (p.ej. cuando no hay proveedores aún).
 */
function CeldaCatalogo({
  valor,
  confianza,
  opciones,
  onChange,
  permitirVacio = false,
  placeholderVacio = "— elegir —",
  deshabilitado = false,
}: {
  valor: string;
  confianza?: number;
  opciones: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
  permitirVacio?: boolean;
  placeholderVacio?: string;
  deshabilitado?: boolean;
}) {
  const valido = opciones.some((o) => o.value === valor);
  const bordeConfianza =
    confianza === undefined
      ? ""
      : confianza >= 0.85
        ? "border-emerald-200"
        : confianza >= 0.5
          ? "border-amber-200"
          : "border-rose-200";

  // Si la IA devolvió algo no válido (o null tras saneado), forzamos elección
  // marcando ámbar (no destructivo, porque puede ser opcional).
  const borde =
    !valor
      ? permitirVacio
        ? "border-input"
        : "border-amber-300 bg-amber-50"
      : bordeConfianza;

  return (
    <select
      value={valido ? valor : ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={deshabilitado}
      className={`w-full rounded border bg-background px-2 py-1 text-xs outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-200 disabled:opacity-50 ${borde}`}
    >
      <option value="" disabled={!permitirVacio}>
        {placeholderVacio}
      </option>
      {opciones.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function CeldaEditable({
  valor,
  confianza,
  esObligatorio,
  estaVacio,
  onChange,
}: {
  valor: string;
  confianza?: number;
  esObligatorio: boolean;
  estaVacio: boolean;
  onChange: (v: string) => void;
}) {
  const bgConfianza =
    confianza === undefined
      ? ""
      : confianza >= 0.85
        ? "border-emerald-200"
        : confianza >= 0.5
          ? "border-amber-200"
          : "border-rose-200";

  const bgErrorObligatorio = estaVacio
    ? "border-destructive bg-destructive/5"
    : bgConfianza;

  return (
    <div className="relative">
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={esObligatorio ? "—" : ""}
        className={`w-full rounded border bg-background px-2 py-1 text-xs outline-none transition focus:border-amber-400 focus:ring-1 focus:ring-amber-200 ${bgErrorObligatorio}`}
      />
    </div>
  );
}

function LeyendaConfianza() {
  return (
    <span className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> alta
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> media
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-rose-400" /> baja
      </span>
    </span>
  );
}

function labelTipo(t: TipoProducto): string {
  switch (t) {
    case "compra":
      return "Productos de compra";
    case "venta":
      return "Productos de venta";
    case "elaboracion":
      return "Elaboraciones";
  }
}
