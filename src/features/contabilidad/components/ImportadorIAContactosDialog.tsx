"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
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
import {
  CAMPOS_OBLIGATORIOS_CONTACTO,
  ETIQUETAS_CAMPOS_CONTACTO,
  TIPOS_CONTACTO,
  type CampoContacto,
  type FilaContactoSugerida,
} from "@/features/contabilidad/types/importador-ia";
import {
  extraerDeArchivo,
  FORMATOS_ACEPTADOS_INPUT,
} from "@/features/logistica/lib/importador-ia/extractor";
import {
  analizarContactosIA,
  bulkImportContactos,
} from "@/features/contabilidad/actions/importador-ia-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
}

const COLUMNAS: CampoContacto[] = [
  "nombre",
  "tipo",
  "nif",
  "email",
  "telefono",
  "direccion",
  "categoria",
];

type Estado = "vacio" | "analizando" | "revision" | "guardando";

export function ImportadorIAContactosDialog({ open, onOpenChange, onImportSuccess }: Props) {
  const [estado, setEstado] = useState<Estado>("vacio");
  const [filas, setFilas] = useState<FilaContactoSugerida[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState<string>("");
  const [resumenIA, setResumenIA] = useState<string | null>(null);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleArchivo = useCallback(async (file: File) => {
    setEstado("analizando");
    setNombreArchivo(file.name);
    setErrorAnalisis(null);
    try {
      const payload = await extraerDeArchivo(file);
      const res = await analizarContactosIA({ payload });
      if (res.error || !res.resultado) {
        setErrorAnalisis(res.error ?? "Error desconocido");
        setEstado("vacio");
        return;
      }
      setFilas(res.resultado.filas);
      setResumenIA(res.resultado.resumen ?? null);
      setEstado("revision");
    } catch (err) {
      setErrorAnalisis(err instanceof Error ? err.message : "No se pudo procesar el archivo.");
      setEstado("vacio");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleArchivo(file);
    },
    [handleArchivo],
  );

  const updateCelda = useCallback((tempId: string, campo: CampoContacto, valor: string) => {
    setFilas((prev) =>
      prev.map((f) =>
        f.tempId === tempId
          ? {
              ...f,
              valores: { ...f.valores, [campo]: valor === "" ? null : valor },
              confianza: { ...f.confianza, [campo]: 1 },
            }
          : f,
      ),
    );
  }, []);

  const eliminarFila = useCallback((tempId: string) => {
    setFilas((prev) => prev.filter((f) => f.tempId !== tempId));
  }, []);

  const anadirFilaVacia = useCallback(() => {
    setFilas((prev) => [
      ...prev,
      { tempId: `nueva-${Date.now()}-${prev.length}`, valores: {}, confianza: {} },
    ]);
  }, []);

  const camposFaltantesPorFila = useMemo(() => {
    const out: Record<string, CampoContacto[]> = {};
    for (const f of filas) {
      const faltan: CampoContacto[] = [];
      for (const c of CAMPOS_OBLIGATORIOS_CONTACTO) {
        if (!(f.valores[c] ?? "").toString().trim()) faltan.push(c);
      }
      if (faltan.length > 0) out[f.tempId] = faltan;
    }
    return out;
  }, [filas]);

  const totalFaltantes = useMemo(
    () => Object.values(camposFaltantesPorFila).reduce((a, b) => a + b.length, 0),
    [camposFaltantesPorFila],
  );

  const puedeGuardar = filas.length > 0 && totalFaltantes === 0 && !isPending;

  const guardar = useCallback(() => {
    startTransition(async () => {
      setEstado("guardando");
      const inputs = filas.map((f) => ({
        nombre: (f.valores.nombre ?? "").trim(),
        tipo: f.valores.tipo ?? "EMPRESA",
        nif: f.valores.nif ?? null,
        email: f.valores.email ?? null,
        telefono: f.valores.telefono ?? null,
        direccion: f.valores.direccion ?? null,
        categoria: f.valores.categoria ?? null,
        observaciones: f.valores.observaciones ?? null,
      }));
      const res = await bulkImportContactos(inputs);
      if (res.error) {
        toast.error(`Error al guardar: ${res.error}`);
        setEstado("revision");
        return;
      }
      toast.success(`${res.imported} contacto${res.imported === 1 ? "" : "s"} importado${res.imported === 1 ? "" : "s"}`);
      onImportSuccess?.();
      handleClose(false);
    });
  }, [filas, onImportSuccess, handleClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Importar contactos con IA
          </DialogTitle>
          <DialogDescription className="text-xs">
            Sube un Excel, CSV, PDF o foto de directorio. La IA extrae nombre, NIF, email, teléfono… y tú revisas antes de guardar.
          </DialogDescription>
        </DialogHeader>

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
                isDragging ? "border-amber-500 bg-amber-50" : "border-muted-foreground/25 hover:border-amber-400 hover:bg-amber-50/50"
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
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <FileUp className="h-12 w-12 text-muted-foreground" />
                  <p className="text-base font-semibold">Arrastra aquí tu archivo o pulsa para elegir</p>
                  <p className="text-xs text-muted-foreground">Excel, CSV, PDF y fotos. Máx. 20 MB.</p>
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
                {filas.length} contacto{filas.length === 1 ? "" : "s"} detectado{filas.length === 1 ? "" : "s"} en{" "}
                <span className="font-medium text-foreground">{nombreArchivo}</span>
              </span>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={anadirFilaVacia}>
                <Plus className="h-3 w-3" /> Añadir fila
              </Button>
            </div>

            <div className="flex-1 overflow-auto rounded-lg border mt-2">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                  <tr className="border-b">
                    {COLUMNAS.map((c) => (
                      <th key={c} className="text-left px-2 py-2 font-semibold whitespace-nowrap">
                        {ETIQUETAS_CAMPOS_CONTACTO[c]}
                        {CAMPOS_OBLIGATORIOS_CONTACTO.includes(c) && (
                          <span className="ml-0.5 text-destructive">*</span>
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
                      <tr key={f.tempId} className={`border-b ${faltan.length > 0 ? "bg-destructive/5" : "hover:bg-muted/30"}`}>
                        {COLUMNAS.map((c) => (
                          <td key={c} className="px-1 py-1 align-top">
                            {c === "tipo" ? (
                              <CeldaSelect
                                valor={f.valores[c] ?? ""}
                                opciones={[...TIPOS_CONTACTO]}
                                onChange={(v) => updateCelda(f.tempId, c, v)}
                              />
                            ) : (
                              <CeldaEditable
                                valor={f.valores[c] ?? ""}
                                confianza={f.confianza?.[c]}
                                estaVacio={
                                  CAMPOS_OBLIGATORIOS_CONTACTO.includes(c) &&
                                  !(f.valores[c] ?? "").toString().trim()
                                }
                                onChange={(v) => updateCelda(f.tempId, c, v)}
                                type={c === "email" ? "email" : "text"}
                              />
                            )}
                          </td>
                        ))}
                        <td className="px-1 py-1 align-top">
                          <button
                            type="button"
                            onClick={() => eliminarFila(f.tempId)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
                    Faltan {totalFaltantes} nombre{totalFaltantes === 1 ? "" : "s"}.
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Todo listo para guardar.
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button onClick={guardar} disabled={!puedeGuardar}>
                  {estado === "guardando" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    `Guardar ${filas.length} contacto${filas.length === 1 ? "" : "s"}`
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

function CeldaSelect({
  valor,
  opciones,
  onChange,
}: {
  valor: string;
  opciones: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={opciones.includes(valor) ? valor : ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:border-amber-400"
    >
      <option value="">—</option>
      {opciones.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function CeldaEditable({
  valor,
  confianza,
  estaVacio,
  onChange,
  type = "text",
}: {
  valor: string;
  confianza?: number;
  estaVacio: boolean;
  onChange: (v: string) => void;
  type?: "text" | "email";
}) {
  const bgConfianza =
    confianza === undefined
      ? ""
      : confianza >= 0.85
        ? "border-emerald-200"
        : confianza >= 0.5
          ? "border-amber-200"
          : "border-rose-200";
  const borde = estaVacio ? "border-destructive bg-destructive/5" : bgConfianza;
  return (
    <input
      type={type}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded border bg-background px-2 py-1 text-xs outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 ${borde}`}
    />
  );
}
