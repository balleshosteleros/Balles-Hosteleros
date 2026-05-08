"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportExportButton } from "@/features/logistica/components/ImportExportButton";
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
  exportProductosToPDF,
  downloadTemplateCSV,
} from "@/features/logistica/lib/productos-io";
import type { TipoProducto } from "@/features/logistica/data/productos";
import type { ProductoInput } from "@/features/logistica/actions/producto-actions";

interface ImportExportButtonsProps {
  tipo: TipoProducto;
  onImportSuccess?: () => void;
}

export function ImportExportButtons({ tipo, onImportSuccess }: ImportExportButtonsProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parsed, setParsed] = useState<ProductoInput[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  async function handleImport(file: File) {
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
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "No se pudo procesar el archivo.");
    }
    setPreviewOpen(true);
  }

  function confirmImport() {
    startTransition(async () => {
      const result = await bulkImportProductos(parsed);
      if (result.error) { toast.error(`Error al importar: ${result.error}`); return; }
      toast.success(`${result.imported} producto${result.imported === 1 ? "" : "s"} importado${result.imported === 1 ? "" : "s"} correctamente`);
      setPreviewOpen(false);
      setParsed([]);
      setFileName("");
      onImportSuccess?.();
    });
  }

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    setIsExporting(true);
    try {
      const productos = await listProductos(tipo);
      if (productos.length === 0) { toast.info("No hay productos para exportar todavía."); return; }
      const ts = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        exportProductosToCSV(productos, `productos-${tipo}-${ts}.csv`);
      } else if (format === "xlsx") {
        exportProductosToExcel(productos, `productos-${tipo}-${ts}.xlsx`);
      } else {
        exportProductosToPDF(productos, `productos-${tipo}-${ts}.pdf`, `Productos ${tipo}`);
      }
      toast.success(`${productos.length} productos exportados en ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <ImportExportButton
        onImport={handleImport}
        onExport={handleExport}
        onDownloadTemplate={downloadTemplateCSV}
        disabled={isExporting}
      />

      {/* Modal de preview de importación */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {parseError ? (
                <><AlertCircle className="h-5 w-5 text-destructive" />Error al procesar el archivo</>
              ) : (
                <><CheckCircle2 className="h-5 w-5 text-emerald-500" />Vista previa de importación</>
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
                Tip: descarga la plantilla desde el menú Importar → Descargar plantilla para ver el formato esperado.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="border-b">
                    <th className="text-left px-3 py-2 font-semibold">Nombre</th>
                    <th className="text-left px-3 py-2 font-semibold">Categoría</th>
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
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancelar</Button>
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
