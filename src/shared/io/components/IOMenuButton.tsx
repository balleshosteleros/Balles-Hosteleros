"use client";

import { useRef } from "react";
import {
  Upload,
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileDown,
  FileType2,
} from "lucide-react";
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

export type IOFormat = "csv" | "xlsx" | "json" | "pdf";

interface IOMenuButtonProps {
  onImport?: (file: File) => void;
  onExport?: (format: IOFormat) => void;
  onDownloadTemplate?: () => void;
  importFormats?: IOFormat[];
  exportFormats?: IOFormat[];
  disabled?: boolean;
  label?: string;
}

const FORMAT_META: Record<IOFormat, { label: string; icon: typeof FileText }> = {
  csv: { label: "CSV (.csv)", icon: FileText },
  xlsx: { label: "Excel (.xlsx)", icon: FileSpreadsheet },
  json: { label: "JSON (.json)", icon: FileCode },
  pdf: { label: "PDF (.pdf)", icon: FileType2 },
};

export function IOMenuButton({
  onImport,
  onExport,
  onDownloadTemplate,
  importFormats = ["xlsx", "csv"],
  exportFormats = ["xlsx", "pdf"],
  disabled,
  label = "Descargar",
}: IOMenuButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const acceptAttr = importFormats
    .map((f) => (f === "xlsx" ? ".xlsx,.xls" : f === "csv" ? ".csv,text/csv" : ".json,application/json"))
    .join(",");

  return (
    <>
      {onImport && (
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptAttr}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              onImport(f);
              e.target.value = "";
            }
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
            title={label}
            aria-label={label}
          >
            <Download className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          {onImport && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 text-xs cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                Importar
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuLabel className="text-xs">Subir archivo</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {importFormats.map((fmt) => {
                  const Icon = FORMAT_META[fmt].icon;
                  return (
                    <DropdownMenuItem
                      key={fmt}
                      className="gap-2 text-xs cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {FORMAT_META[fmt].label}
                    </DropdownMenuItem>
                  );
                })}
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

          {onExport && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 text-xs cursor-pointer">
                <Download className="h-3.5 w-3.5" />
                Exportar
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuLabel className="text-xs">Formato</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {exportFormats.map((fmt) => {
                  const Icon = FORMAT_META[fmt].icon;
                  return (
                    <DropdownMenuItem
                      key={fmt}
                      className="gap-2 text-xs cursor-pointer"
                      onClick={() => onExport(fmt)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {FORMAT_META[fmt].label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
