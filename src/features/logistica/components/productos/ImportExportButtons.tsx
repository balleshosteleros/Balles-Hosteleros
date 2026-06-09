"use client";

import { useState } from "react";
import { ImportExportButton } from "@/features/logistica/components/ImportExportButton";
import { ImportadorIADialog } from "@/features/logistica/components/ImportadorIADialog";
import { toast } from "sonner";
import { listProductos } from "@/features/logistica/actions/producto-actions";
import {
  exportProductosToCSV,
  exportProductosToExcel,
  exportProductosToPDF,
} from "@/features/logistica/lib/productos-io";
import type { TipoProducto } from "@/features/logistica/data/productos";

interface ImportExportButtonsProps {
  tipo: TipoProducto;
  onImportSuccess?: () => void;
}

export function ImportExportButtons({ tipo, onImportSuccess }: ImportExportButtonsProps) {
  const [iaOpen, setIaOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
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
        onOpenImport={() => setIaOpen(true)}
        onExport={handleExport}
        disabled={isExporting}
      />

      <ImportadorIADialog
        open={iaOpen}
        onOpenChange={setIaOpen}
        tipo={tipo}
        onImportSuccess={onImportSuccess}
      />
    </>
  );
}
