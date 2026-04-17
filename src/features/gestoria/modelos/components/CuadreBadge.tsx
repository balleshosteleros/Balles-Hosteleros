"use client";

import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import type { ResultadoCuadre } from "../services/validar-cuadre";

export function CuadreBadge({ resultado }: { resultado: ResultadoCuadre }) {
  const color =
    resultado.nivel === "ok"
      ? "bg-green-50 text-green-800 border-green-200"
      : resultado.nivel === "aviso"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-red-50 text-red-800 border-red-200";

  const Icon =
    resultado.nivel === "ok"
      ? CheckCircle2
      : resultado.nivel === "aviso"
        ? AlertCircle
        : XCircle;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${color}`}
        >
          <Icon className="h-4 w-4" />
          {resultado.mensaje}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <Card className="p-3 space-y-2">
          <h4 className="font-semibold text-sm">Validación de cuadre</h4>
          <table className="w-full text-xs">
            <thead className="border-b">
              <tr>
                <th className="text-left">Concepto</th>
                <th className="text-right">Facturas</th>
                <th className="text-right">Casillas</th>
                <th className="text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {resultado.detalles.map((d, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1">{d.concepto}</td>
                  <td className="text-right font-mono">{d.facturas.toFixed(2)}</td>
                  <td className="text-right font-mono">{d.casillas.toFixed(2)}</td>
                  <td
                    className={`text-right font-mono ${
                      Math.abs(d.diff) < 0.02 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {d.diff.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
