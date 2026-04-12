"use client";

import { useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

interface EventoFiscal {
  dia: number;
  titulo: string;
  tipo: "impuesto" | "factura" | "pago" | "vencimiento";
}

const SAMPLE_EVENTOS: EventoFiscal[] = [
  { dia: 7, titulo: "IVA trimestral Q1", tipo: "impuesto" },
  { dia: 15, titulo: "Pago alquiler", tipo: "pago" },
  { dia: 20, titulo: "Modelo 303", tipo: "impuesto" },
  { dia: 20, titulo: "Modelo 111", tipo: "impuesto" },
  { dia: 25, titulo: "Vencimiento factura Atenco", tipo: "vencimiento" },
  { dia: 30, titulo: "Cierre trimestral", tipo: "impuesto" },
];

const tipoColor: Record<string, string> = {
  impuesto: "bg-amber-100 text-amber-800 border-amber-300",
  factura: "bg-blue-100 text-blue-800 border-blue-300",
  pago: "bg-red-100 text-red-800 border-red-300",
  vencimiento: "bg-violet-100 text-violet-800 border-violet-300",
};

export function CalendarioView() {
  const { empresaActual } = useEmpresa();
  const [mes, setMes] = useState(3); // Abril = 3 (0-indexed)
  const [ano, setAno] = useState(2026);

  const primerDia = new Date(ano, mes, 1).getDay();
  const diasEnMes = new Date(ano, mes + 1, 0).getDate();
  const offset = primerDia === 0 ? 6 : primerDia - 1;

  const prev = () => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); };
  const next = () => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); };

  return (
    <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold min-w-[140px] text-center">{MESES[mes]} {ano}</span>
          <Button variant="ghost" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-[10px]">
        {Object.entries(tipoColor).map(([k, cls]) => (
          <span key={k} className="flex items-center gap-1"><span className={cn("w-2.5 h-2.5 rounded-full", cls.split(" ")[0])} />{k.charAt(0).toUpperCase() + k.slice(1)}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/30">
          {DIAS_SEMANA.map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground border-b">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: offset }).map((_, i) => <div key={`e-${i}`} className="min-h-[90px] border-b border-r" />)}
          {Array.from({ length: diasEnMes }).map((_, i) => {
            const dia = i + 1;
            const eventos = SAMPLE_EVENTOS.filter(e => e.dia === dia);
            const isHoy = dia === 7 && mes === 3 && ano === 2026;
            return (
              <div key={dia} className={cn("min-h-[90px] border-b border-r p-1.5", isHoy && "bg-primary/5")}>
                <span className={cn("text-xs font-medium", isHoy && "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center")}>{dia}</span>
                <div className="mt-1 space-y-0.5">
                  {eventos.map((e, idx) => (
                    <Badge key={idx} className={cn("text-[8px] w-full justify-start truncate", tipoColor[e.tipo])} variant="outline">{e.titulo}</Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
