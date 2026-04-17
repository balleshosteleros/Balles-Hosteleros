"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

interface Props {
  numero: string;
  label: string;
  valor: number | undefined;
  tipo?: "base" | "cuota" | "resultado";
  facturasAsociadas?: Array<{
    factura_id: string;
    numero_factura?: string;
    proveedor?: string;
    importe: number;
    confianza?: number | null;
  }>;
  editable?: boolean;
  onChange?: (v: number) => void;
  compact?: boolean;
}

export function CasillaInput({
  numero,
  label,
  valor,
  tipo = "base",
  facturasAsociadas = [],
  editable = false,
  onChange,
  compact = false,
}: Props) {
  const [local, setLocal] = useState<string>(valor != null ? String(valor) : "");

  const bgByTipo = {
    base: "bg-gray-50",
    cuota: "bg-amber-50",
    resultado: "bg-green-50 font-bold",
  };

  return (
    <div className={`border border-gray-300 rounded ${compact ? "p-1" : "p-2"} ${bgByTipo[tipo]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] uppercase text-gray-500 tracking-wider">
          <span className="font-mono font-bold">{numero}</span>
          <span className="truncate max-w-[180px]">{label}</span>
          {facturasAsociadas.length > 0 ? (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" aria-label="Ver facturas que componen">
                  <Info className="h-3 w-3 text-blue-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-96 max-h-80 overflow-auto">
                <p className="text-xs font-semibold mb-2">
                  {facturasAsociadas.length} facturas en casilla {numero}
                </p>
                <div className="space-y-1">
                  {facturasAsociadas.slice(0, 20).map((f) => (
                    <div
                      key={f.factura_id}
                      className="flex items-center justify-between text-xs border-b pb-1"
                    >
                      <span className="truncate max-w-[180px]">
                        {f.numero_factura ?? f.factura_id.slice(0, 8)} · {f.proveedor ?? ""}
                      </span>
                      <span className="font-mono">
                        {f.importe.toLocaleString("es-ES", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>
      {editable ? (
        <input
          type="number"
          step="0.01"
          className="w-full text-right font-mono text-sm border-0 bg-transparent focus:outline-none focus:ring-0 p-0"
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            onChange?.(Number.parseFloat(e.target.value) || 0);
          }}
        />
      ) : (
        <div className="text-right font-mono text-sm">
          {valor != null
            ? valor.toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "—"}
        </div>
      )}
    </div>
  );
}
