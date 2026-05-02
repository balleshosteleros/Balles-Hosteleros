"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type {
  ColumnDef,
  ImportError,
  ImportMode,
  ImportResult,
  ParsedFile,
} from "../types";

interface ImportDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  parsed: ParsedFile<T> | null;
  parseError: string | null;
  columns: ColumnDef<T>[];
  label: string;
  supportsUpsert: boolean;
  onConfirm: (rows: T[], mode: ImportMode) => Promise<ImportResult>;
  onSuccess?: () => void;
}

export function ImportDialog<T>({
  open,
  onOpenChange,
  fileName,
  parsed,
  parseError,
  columns,
  label,
  supportsUpsert,
  onConfirm,
  onSuccess,
}: ImportDialogProps<T>) {
  const [mode, setMode] = useState<ImportMode>(supportsUpsert ? "upsert" : "insert");
  const [isPending, startTransition] = useTransition();

  const visibleColumns = columns.filter((c) => !c.hideInImport).slice(0, 8);
  const rowCount = parsed?.rows.length ?? 0;
  const errorCount = parsed?.errors.length ?? 0;
  const hasFatalError = !!parseError;
  const canImport = !hasFatalError && rowCount > 0;

  function handleConfirm() {
    if (!parsed) return;
    startTransition(async () => {
      try {
        const result = await onConfirm(parsed.rows, mode);
        if (!result.ok) {
          toast.error(`Importación fallida (${result.errors.length} errores)`);
          return;
        }
        const totalProcessed = result.imported + result.updated;
        toast.success(
          `${totalProcessed} fila${totalProcessed === 1 ? "" : "s"} importada${totalProcessed === 1 ? "" : "s"}` +
            (result.skipped ? ` (${result.skipped} omitidas)` : "")
        );
        onOpenChange(false);
        onSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al importar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasFatalError ? (
              <>
                <AlertCircle className="h-5 w-5 text-destructive" />
                Error al procesar el archivo
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Vista previa: {label}
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {hasFatalError
              ? fileName
              : `${rowCount} fila${rowCount === 1 ? "" : "s"} válida${rowCount === 1 ? "" : "s"}` +
                (errorCount ? ` · ${errorCount} con errores` : "") +
                ` · ${fileName}`}
          </DialogDescription>
        </DialogHeader>

        {hasFatalError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {parseError}
            <p className="mt-3 text-xs text-muted-foreground">
              Sugerencia: descarga la plantilla desde el menú Importar → Descargar plantilla.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto space-y-3">
            {errorCount > 0 && parsed && <ErrorsTable errors={parsed.errors} />}
            {rowCount > 0 && parsed && (
              <PreviewTable rows={parsed.rows} columns={visibleColumns} />
            )}
          </div>
        )}

        <DialogFooter className="flex flex-row items-center gap-2">
          {canImport && supportsUpsert && (
            <div className="mr-auto">
              <Select value={mode} onValueChange={(v) => setMode(v as ImportMode)}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="insert">Sólo insertar</SelectItem>
                  <SelectItem value="upsert">Insertar o actualizar</SelectItem>
                  <SelectItem value="replace">Reemplazar todo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {canImport && (
            <Button onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Importando..." : `Importar ${rowCount}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ErrorsTable({ errors }: { errors: ImportError[] }) {
  const visible = errors.slice(0, 25);
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5">
      <div className="px-3 py-2 text-xs font-semibold text-destructive border-b border-destructive/30">
        {errors.length} error{errors.length === 1 ? "" : "es"} detectado{errors.length === 1 ? "" : "s"}
      </div>
      <table className="w-full text-xs">
        <thead className="bg-destructive/10">
          <tr>
            <th className="text-left px-3 py-1.5 font-semibold">Fila</th>
            <th className="text-left px-3 py-1.5 font-semibold">Columna</th>
            <th className="text-left px-3 py-1.5 font-semibold">Problema</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((e, i) => (
            <tr key={i} className="border-t border-destructive/20">
              <td className="px-3 py-1 font-mono">{e.row}</td>
              <td className="px-3 py-1 text-muted-foreground">{e.column ?? "—"}</td>
              <td className="px-3 py-1">{e.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {errors.length > 25 && (
        <div className="border-t border-destructive/20 px-3 py-1.5 text-center text-[11px] text-muted-foreground">
          Mostrando 25 de {errors.length}. Corrige los errores y vuelve a subir.
        </div>
      )}
    </div>
  );
}

function PreviewTable<T>({
  rows,
  columns,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
}) {
  const visible = rows.slice(0, 50);
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur">
          <tr className="border-b">
            {columns.map((c) => (
              <th key={c.key} className="text-left px-3 py-2 font-semibold whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr key={i} className="border-b hover:bg-muted/30">
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {formatPreview((row as Record<string, unknown>)[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && (
        <div className="border-t bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
          Mostrando primeras 50 filas de {rows.length}.
        </div>
      )}
    </div>
  );
}

function formatPreview(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}
