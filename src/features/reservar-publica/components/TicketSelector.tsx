"use client";

import { Label } from "@/components/ui/label";
import { Check, Ticket } from "lucide-react";

export interface ProductoTicketPublico {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  iva: number;
  modoPrecio: "por_persona" | "por_reserva";
  stockModo: "ilimitado" | "limitado";
  stockTotal: number | null;
  stockConsumido: number;
  ocultarAlAgotar: boolean;
}

interface Props {
  productos: ProductoTicketPublico[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  required: boolean;
  accent: string;
  onAccent: string;
}

function disponible(p: ProductoTicketPublico): number | null {
  if (p.stockModo === "ilimitado" || p.stockTotal == null) return null;
  return Math.max(0, p.stockTotal - p.stockConsumido);
}

function fmtEuro(n: number, iva: number): string {
  const total = n * (1 + iva / 100);
  return `${total.toFixed(2)} €`;
}

export function TicketSelector({ productos, selectedId, onChange, required, accent, onAccent }: Props) {
  if (productos.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Ticket className="h-4 w-4 text-zinc-500" />
        <Label className="text-zinc-700">
          Elige tu ticket {required && <span className="text-red-600">*</span>}
        </Label>
      </div>
      <div className="space-y-2">
        {productos.map((p) => {
          const restante = disponible(p);
          const agotado = restante === 0;
          const isSelected = selectedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={agotado}
              onClick={() => onChange(isSelected ? null : p.id)}
              aria-pressed={isSelected}
              className={`w-full text-left rounded-xl border p-3 transition flex items-start gap-3 ${
                isSelected ? "ring-2" : "hover:bg-zinc-50"
              } ${agotado ? "opacity-50 cursor-not-allowed" : ""}`}
              style={isSelected
                ? { borderColor: accent, boxShadow: `0 0 0 2px ${accent}` }
                : { borderColor: "#e4e4e7" }}
            >
              <div
                className="h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5"
                style={isSelected
                  ? { background: accent, borderColor: accent, color: onAccent }
                  : { borderColor: "#a1a1aa" }}
              >
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-medium text-sm">{p.nombre}</span>
                  <span className="text-sm font-semibold" style={{ color: accent }}>
                    {fmtEuro(p.precio, p.iva)}
                    <span className="text-[10px] font-normal text-zinc-500 ml-1">
                      {p.modoPrecio === "por_persona" ? "/persona" : "/reserva"}
                    </span>
                  </span>
                </div>
                {p.descripcion && (
                  <p className="text-xs text-zinc-600 mt-0.5">{p.descripcion}</p>
                )}
                <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-500">
                  {restante != null && restante > 0 && restante <= 5 && (
                    <span className="text-amber-700 font-medium">Quedan {restante}</span>
                  )}
                  {agotado && (
                    <span className="text-red-700 font-medium">Agotado</span>
                  )}
                  <span>IVA incluido</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
