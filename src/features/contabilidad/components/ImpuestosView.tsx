"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { IMPUESTOS_INGRESOS, IMPUESTOS_GASTOS, FilaImpuesto } from "@/features/contabilidad/data/contabilidad";

const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2 }) + " €";

function FilaTabla({ fila }: { fila: FilaImpuesto }) {
  const total = fila.t1 + fila.t2 + fila.t3 + fila.t4;
  return (
    <tr className="border-b hover:bg-muted/20">
      <td className="py-3 pl-8 text-sm">{fila.expandible && <span className="mr-1">›</span>}{fila.concepto}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(fila.t1)}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(fila.t2)}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(fila.t3)}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(fila.t4)}</td>
      <td className="py-3 text-right text-sm font-mono font-semibold">{fmt(total)}</td>
    </tr>
  );
}

function TotalFila({ filas, label }: { filas: FilaImpuesto[]; label: string }) {
  const sum = (k: "t1" | "t2" | "t3" | "t4") => filas.reduce((s, f) => s + f[k], 0);
  const total = sum("t1") + sum("t2") + sum("t3") + sum("t4");
  return (
    <tr className="border-b bg-muted/30 font-semibold">
      <td className="py-3 pl-8 text-sm">{label}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(sum("t1"))}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(sum("t2"))}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(sum("t3"))}</td>
      <td className="py-3 text-right text-sm font-mono">{fmt(sum("t4"))}</td>
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
          <Button variant="outline" size="sm" className="text-xs">📅 2026-T1 — 2026-T4</Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            {/* INGRESOS header */}
            <tr className="bg-muted/40 border-b">
              <th className="py-3 pl-4 text-left text-sm font-bold text-emerald-600 flex items-center gap-1.5">↗ Ingresos</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-T1</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-T2</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-T3</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-T4</th>
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
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-T1</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-T2</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-T3</th>
              <th className="py-3 text-right text-xs font-semibold text-muted-foreground w-[150px]">2026-T4</th>
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
