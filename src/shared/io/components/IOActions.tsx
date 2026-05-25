"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { IOContext, ImportMode, ModuleIO, ParsedFile } from "../types";
import { readRows, readWorkbook } from "../lib/xlsx";
import { validateRows } from "../lib/validate";
import { downloadExport } from "../lib/template";
import { downloadTemplate } from "../lib/template";
import { IOMenuButton, type IOFormat } from "./IOMenuButton";
import { ImportDialog } from "./ImportDialog";

interface IOActionsProps<T> {
  config: ModuleIO<T>;
  context?: IOContext;
  onSuccess?: () => void;
  exportRecords?: T[];
  /**
   * Si se proporciona, el botón "Importar" del dropdown se convierte en un
   * único item que invoca este callback (en lugar del submenu Excel/CSV/Plantilla).
   * Pensado para flujos de importación con IA.
   */
  onCustomImport?: () => void;
}

export function IOActions<T>({
  config,
  context = {},
  onSuccess,
  exportRecords,
  onCustomImport,
}: IOActionsProps<T>) {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedFile<T> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  const supportsImport = !!config.upsert;
  const importFormats = config.supportedImportFormats ?? ["xlsx", "csv"];
  const baseExportFormats = config.supportedExportFormats ?? ["xlsx"];
  const exportFormats = baseExportFormats.includes("pdf")
    ? baseExportFormats
    : [...baseExportFormats, "pdf" as const];

  async function handleImport(file: File) {
    setFileName(file.name);
    setParseError(null);
    setParsed(null);
    setOpen(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "json") {
        const text = await file.text();
        const parsedJson = JSON.parse(text) as { records?: unknown[] } | unknown[];
        const records = Array.isArray(parsedJson) ? parsedJson : parsedJson.records ?? [];
        const rawRows = records as Record<string, unknown>[];
        const result = validateRows(rawRows, config.columns, config.schema);
        if (result.rows.length === 0 && result.errors.length === 0) {
          setParseError("El archivo no contiene registros.");
        } else {
          setParsed(result);
        }
        return;
      }

      const wb = await readWorkbook(file);
      const rawRows = readRows(wb);
      if (rawRows.length === 0) {
        setParseError("El archivo no contiene filas con datos.");
        return;
      }
      const result = validateRows(rawRows, config.columns, config.schema);
      if (result.rows.length === 0 && result.errors.length === 0) {
        setParseError("No se reconoció ninguna columna. Descarga la plantilla para ver el formato.");
        return;
      }
      setParsed(result);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "No se pudo procesar el archivo.");
    }
  }

  async function handleConfirm(rows: T[], mode: ImportMode) {
    if (!config.upsert) {
      throw new Error("Esta vista no permite importar.");
    }
    return config.upsert(rows, context, mode);
  }

  async function handleExport(format: IOFormat) {
    setBusy(true);
    try {
      const records = exportRecords ?? (await config.fetchAll(context));
      if (records.length === 0) {
        toast.info("No hay registros para exportar.");
        return;
      }
      await downloadExport(config, records, format);
      toast.success(`${records.length} registro${records.length === 1 ? "" : "s"} exportado${records.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadTemplate() {
    downloadTemplate(config, "xlsx");
    toast.success("Plantilla descargada");
  }

  return (
    <>
      <IOMenuButton
        onImport={supportsImport ? handleImport : undefined}
        onExport={handleExport}
        onDownloadTemplate={supportsImport ? handleDownloadTemplate : undefined}
        importFormats={importFormats}
        exportFormats={exportFormats}
        disabled={busy}
        label={`Importar / Exportar ${config.label}`}
        onCustomImport={onCustomImport}
      />
      {supportsImport && !onCustomImport && (
        <ImportDialog
          open={open}
          onOpenChange={setOpen}
          fileName={fileName}
          parsed={parsed}
          parseError={parseError}
          columns={config.columns}
          label={config.label}
          supportsUpsert={!!config.uniqueBy}
          onConfirm={handleConfirm}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}
