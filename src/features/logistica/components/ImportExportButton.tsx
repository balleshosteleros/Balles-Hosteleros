"use client";

import { FileUp, Upload, Download, FileText, FileSpreadsheet, Sparkles } from "lucide-react";
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
  /** Llamado cuando el usuario pulsa "Importar". Abre el diálogo de IA. */
  onOpenImport?: () => void;
  /** Llamado con el formato de exportación elegido. */
  onExport: (format: "csv" | "xlsx") => void;
  disabled?: boolean;
}

export function ImportExportButton({
  onOpenImport,
  onExport,
  disabled,
}: ImportExportButtonProps) {
  return (
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
        {/* ── Importar ── un solo click que abre el diálogo de IA ── */}
        {onOpenImport && (
          <>
            <DropdownMenuItem
              className="gap-2 text-xs cursor-pointer"
              onClick={onOpenImport}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="flex-1">Importar</span>
              <Sparkles className="h-3 w-3 text-amber-500" aria-label="IA" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* ── Exportar (mantenido con submenu por formato) ── */}
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
  );
}
