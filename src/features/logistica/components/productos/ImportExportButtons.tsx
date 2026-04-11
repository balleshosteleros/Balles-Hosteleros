"use client";

import { useState, useRef, useTransition } from "react";
import { Upload, Download, FileSpreadsheet, FileText, FileDown, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { bulkImportProductos, listProductos } from "@/features/logistica/actions/producto-actions";
import {
  parseFileToProductos,
  exportProductosToCSV,
  exportProductosToExcel,
  downloadTemplateCSV,
} from "@/features/logistica/lib/productos-io";
import type { TipoProducto } from "@/features/logistica/data/productos";
import type { ProductoInput } from "@/features/logistica/actions/producto-actions";

interface ImportExportButtonsProps {
  tipo: TipoProducto;
  onImportSuccess?: () => void;
}

export function ImportExportButtons({
  tipo,
  onImportSuccess,
}: ImportExportButtonsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parsed, setParsed] = useState<ProductoInput[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  function triggerFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setParsed([]);

    try {
      const productos = await parseFileToProductos(file, tipo);
      if (productos.length === 0) {
        setParseError("El archivo no contiene filas válidas.");
      } else {
        setParsed(productos);
      }
      setPreviewOpen(true);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "No se pudo procesar el archivo."
      );
      setPreviewOpen(true);
    } finally {
      // limpiar input para permitir re-seleccionar el mismo archivo
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function confirmImport() {
    startTransition(async () => {
      const result = await bulkImportProductos(parsed);
      if (result.error) {
        toast.error(`Error al importar: ${result.error}`);
        return;
      }
      toast.success(
        `${result.imported} producto${result.imported === 1 ? "" : "s"} importado${result.imported === 1 ? "" : "s"} correctamente`
      );
      setPreviewOpen(false);
      setParsed([]);
      setFileName("");
      onImportSuccess?.();
    });
  }

  async function handleExport(format: "csv" | "xlsx") {
    setIsExporting(true);
    try {
      const productos = await listProductos(tipo);
      if (productos.length === 0) {
        toast.info("No hay productos para exportar todavía.");
        return;
      }
      const ts = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        exportProductosToCSV(productos, `productos-${tipo}-${ts}.csv`);
      } else {
        exportProductosToExcel(productos, `productos-${tipo}-${ts}.xlsx`);
      }
      toast.success(`${productos.length} productos exportados en ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al exportar"
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Botón Importar con dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Importar
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs">Importar desde archivo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={triggerFilePicker} className="gap-2 text-xs">
            <FileText className="h-3.5 w-3.5" />
            CSV (.csv)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={triggerFilePicker} className="gap-2 text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel (.xlsx, .xls)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={downloadTemplateCSV} className="gap-2 text-xs text-muted-foreground">
            <FileDown className="h-3.5 w-3.5" />
            Descargar plantilla
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Botón Exportar con dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5" disabled={isExporting}>
            <Download className="h-3.5 w-3.5" />
            {isExporting ? "Exportando..." : "Exportar"}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs">Exportar a</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2 text-xs">
            <FileText className="h-3.5 w-3.5" />
            CSV (.csv)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("xlsx")} className="gap-2 text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modal de preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {parseError ? (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Error al procesar el archivo
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Vista previa de importación
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {parseError
                ? fileName
                : `${parsed.length} producto${parsed.length === 1 ? "" : "s"} detectado${parsed.length === 1 ? "" : "s"} en ${fileName}`}
            </DialogDescription>
          </DialogHeader>

          {parseError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {parseError}
              <p className="mt-3 text-xs text-muted-foreground">
                Tip: descarga la plantilla desde el menú Importar → Descargar plantilla
                para ver el formato esperado.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="border-b">
                    <th className="text-left px-3 py-2 font-semibold">Nombre</th>
                    <th className="text-left px-3 py-2 font-semibold">Categoría</th>
                    <th className="text-left px-3 py-2 font-semibold">Familia</th>
                    <th className="text-left px-3 py-2 font-semibold">Estado</th>
                    {tipo === "compra" && (
                      <>
                        <th className="text-left px-3 py-2 font-semibold">Proveedor</th>
                        <th className="text-left px-3 py-2 font-semibold">Precio compra</th>
                      </>
                    )}
                    {tipo === "venta" && (
                      <>
                        <th className="text-left px-3 py-2 font-semibold">Precio venta</th>
                        <th className="text-left px-3 py-2 font-semibold">Coste</th>
                      </>
                    )}
                    <th className="text-left px-3 py-2 font-semibold">Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 50).map((p, i) => (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{p.nombre}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.categoria}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.familia ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.estado}</td>
                      {tipo === "compra" && (
                        <>
                          <td className="px-3 py-2 text-muted-foreground">{p.proveedor ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.precioCompra ?? "—"}</td>
                        </>
                      )}
                      {tipo === "venta" && (
                        <>
                          <td className="px-3 py-2 text-muted-foreground">{p.precioVenta ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.coste ?? "—"}</td>
                        </>
                      )}
                      <td className="px-3 py-2 text-muted-foreground">{p.unidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 50 && (
                <div className="border-t bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
                  Mostrando primeras 50 filas de {parsed.length}. Al confirmar se importarán todas.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancelar
            </Button>
            {!parseError && parsed.length > 0 && (
              <Button onClick={confirmImport} disabled={isPending}>
                {isPending ? "Importando..." : `Importar ${parsed.length} producto${parsed.length === 1 ? "" : "s"}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
