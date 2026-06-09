"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { IMPUESTOS_INGRESOS, IMPUESTOS_GASTOS, FilaImpuesto } from "@/features/contabilidad/data/contabilidad";

const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2 }) + " €";

function FilaTabla({ fila }: { fila: FilaImpuesto }) {
  const total = fila.q1 + fila.q2 + fila.q3 + fila.q4;
  return (
    <tr className="border-b hover:bg-muted/20">
      <td className="py-3 pl-8 text-sm">{fila.expandible && <span className="mr-1">›</span>}{fila.concepto}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(fila.q1)}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(fila.q2)}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(fila.q3)}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(fila.q4)}</td>
      <td className="py-3 text-right text-sm font-mono font-semibold">{fmt(total)}</td>
    </tr>
  );
}

function TotalFila({ filas, label }: { filas: FilaImpuesto[]; label: string }) {
  const sum = (k: "q1" | "q2" | "q3" | "q4") => filas.reduce((s, f) => s + f[k], 0);
  const total = sum("q1") + sum("q2") + sum("q3") + sum("q4");
  return (
    <tr className="border-b bg-muted/30 font-semibold">
      <td className="py-3 pl-8 text-sm">{label}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(sum("q1"))}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(sum("q2"))}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(sum("q3"))}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(sum("q4"))}</td>
      <td className="py-3 text-right text-sm font-mono font-bold">{fmt(total)}</td>
    </tr>
  );
}

export function ImpuestosView() {
  const [periodo, setPeriodo] = useState("TRIMESTRAL");

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon"><Download className="h-4 w-4" /></Button>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="TRIMESTRAL">Trimestral</SelectItem><SelectItem value="MENSUAL">Mensual</SelectItem><SelectItem value="ANUAL">Anual</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="text-xs">📅 2026-Q1 — 2026-Q4</Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            {/* INGRESOS header */}
            <tr className="bg-muted/40 border-b">
              <th className="py-3 pl-4 text-left text-sm font-bold text-emerald-600 flex items-center gap-1.5">↗ Ingresos</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-Q1</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-Q2</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-Q3</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-Q4</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px] pr-4">Total</th>
            </tr>
          </thead>
          <tbody>
            {IMPUESTOS_INGRESOS.map(f => <FilaTabla key={f.concepto} fila={f} />)}
            <TotalFila filas={IMPUESTOS_INGRESOS} label="Total" />
          </tbody>
        </table>

        <table className="w-full mt-2">
          <thead>
            <tr className="bg-muted/40 border-b border-t">
              <th className="py-3 pl-4 text-left text-sm font-bold text-red-500 flex items-center gap-1.5">↙ Gastos</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-Q1</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-Q2</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-Q3</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-Q4</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px] pr-4">Total</th>
            </tr>
          </thead>
          <tbody>
            {IMPUESTOS_GASTOS.map(f => <FilaTabla key={f.concepto} fila={f} />)}
            <TotalFila filas={IMPUESTOS_GASTOS} label="Total" />
          </tbody>
        </table>
      </div>
    </div>
  );
}
