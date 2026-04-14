"use client";

import { useState, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { listStock } from "@/features/logistica/actions/stock-actions";
import { listProductos } from "@/features/logistica/actions/producto-actions";
import { type ProductoStock } from "@/features/logistica/data/stock";
import StockAnalytics from "@/features/logistica/components/stock/StockAnalytics";

export function StockAnalyticsSection() {
  const { empresaActual } = useEmpresa();
  const [stock, setStock] = useState<ProductoStock[]>([]);

  const load = useCallback(async () => {
    try {
      const [stockRes, productos] = await Promise.all([listStock(), listProductos("compra")]);
      const byId = new Map<string, { cantidad: number; minima: number }>();
      const byNombre = new Map<string, { cantidad: number; minima: number }>();
      if (stockRes.ok) {
        for (const r of stockRes.data as Array<Record<string, unknown>>) {
          const entry = { cantidad: Number(r.cantidad_actual ?? 0), minima: Number(r.cantidad_minima ?? 0) };
          if (r.producto_id) byId.set(r.producto_id as string, entry);
          if (r.producto_nombre) byNombre.set(String(r.producto_nombre).toLowerCase(), entry);
        }
      }
      const merged: ProductoStock[] = productos.map((p) => {
        const s = byId.get(p.id) ?? byNombre.get(p.nombre.toLowerCase());
        return {
          id: p.id, nombre: p.nombre, categoria: p.categoria || "Otros", unidad: p.unidad,
          stockMaximo: 0, stockSeguridad: s?.minima ?? 0, stockActual: s?.cantidad ?? 0,
          ultimoInventario: 0, ultimoInventarioFecha: null, empresaId: empresaActual.id,
        };
      });
      setStock(merged);
    } catch { /* silent */ }
  }, [empresaActual.id]);

  useEffect(() => { load(); }, [load]);

  return <StockAnalytics stock={stock} temporadaActiva={null} />;
}
