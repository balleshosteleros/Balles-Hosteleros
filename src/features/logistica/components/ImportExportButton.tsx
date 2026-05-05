"use client";

import { useRef } from "react";
import { FileUp, Upload, Download, FileText, FileSpreadsheet, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface ImportExportButtonProps {
  /** Llamado con el File elegido. Si no se pasa, Importar no aparece. */
  onImport?: (file: File) => void;
  /** Llamado con el formato de exportación elegido. */
  onExport: (format: "csv" | "xlsx") => void;
  /** Si se pasa, aparece "Descargar plantilla" dentro de Importar. */
  onDownloadTemplate?: () => void;
  disabled?: boolean;
}

export function ImportExportButton({
  onImport,
  onExport,
  onDownloadTemplate,
  disabled,
}: ImportExportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {onImport && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { onImport(f); e.target.value = ""; }
          }}
        />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0"
            disabled={disabled}
            title="Importar / Exportar"
            aria-label="Importar / Exportar"
          >
            <FileUp className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          {/* ── Importar ── */}
          {onImport && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 text-xs cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                Importar
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-44">
                <DropdownMenuLabel className="text-xs">Formato</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-xs cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText className="h-3.5 w-3.5" />
                  CSV (.csv)
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-xs cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                {onDownloadTemplate && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2 text-xs text-muted-foreground cursor-pointer"
                      onClick={onDownloadTemplate}
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Descargar plantilla
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* ── Exportar ── */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 text-xs cursor-pointer">
              <Download className="h-3.5 w-3.5" />
              Exportar
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <DropdownMenuLabel className="text-xs">Formato</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-xs cursor-pointer"
                onClick={() => onExport("csv")}
              >
                <FileText className="h-3.5 w-3.5" />
                CSV (.csv)
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 text-xs cursor-pointer"
                onClick={() => onExport("xlsx")}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
