"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getExtraccionesAgora,
  getFacturasAgoraDia,
  type ExtraccionDia,
  type FacturaAgora,
} from "@/features/sala/actions/agora-extracciones-actions";

const eur = (n: number) => `${n.toFixed(2)} €`;

export function AgoraExtraccionesPanel() {
  const [dias, setDias] = useState<ExtraccionDia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getExtraccionesAgora().then((r) => {
      if (r.ok) setDias(r.data);
      else setError(r.error);
      setCargando(false);
    });
  }, []);

  if (cargando)
    return (
      <div className="flex items-center gap-2 px-3 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando extracciones…
      </div>
    );
  if (error) return <p className="px-3 py-6 text-sm text-destructive">{error}</p>;
  if (dias.length === 0)
    return <p className="px-3 py-6 text-sm text-muted-foreground">Aún no hay ventas importadas de Ágora.</p>;

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        Histórico por día de las ventas extraídas de Ágora. Despliega un día para ver todas sus facturas
        (incluidas las de importe 0 o negativo — devoluciones/abonos).
      </p>
      {dias.map((d) => (
        <DiaRow key={d.dia} dia={d} />
      ))}
    </div>
  );
}

function DiaRow({ dia }: { dia: ExtraccionDia }) {
  const [open, setOpen] = useState(false);
  const [facturas, setFacturas] = useState<FacturaAgora[] | null>(null);
  const [cargando, setCargando] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && facturas === null) {
      setCargando(true);
      getFacturasAgoraDia(dia.dia).then((r) => {
        setFacturas(r.ok ? r.data : []);
        setCargando(false);
      });
    }
  };

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-semibold">{dia.dia}</span>
        <Badge variant="secondary" className="text-[10px]">{dia.facturas} facturas</Badge>
        {dia.ceros > 0 && <Badge variant="outline" className="text-[10px]">{dia.ceros} a 0</Badge>}
        {dia.negativos > 0 && (
          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">{dia.negativos} negativas</Badge>
        )}
        <span className="ml-auto font-semibold tabular-nums">{eur(dia.total)}</span>
      </button>

      {open && (
        <CardContent className="border-t p-0">
          {cargando ? (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando facturas…
            </div>
          ) : !facturas || facturas.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">Sin facturas.</p>
          ) : (
            <ul className="divide-y">
              {facturas.map((f) => (
                <FacturaRow key={f.id} f={f} />
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function FacturaRow({ f }: { f: FacturaAgora }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/30"
      >
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium">{f.numero}</span>
        <span className="text-muted-foreground">· {f.comensales} pax · {f.lineas.length} líneas</span>
        <span
          className={`ml-auto tabular-nums font-semibold ${f.total < 0 ? "text-amber-600" : ""}`}
        >
          {eur(f.total)}
        </span>
      </button>
      {open && (
        <div className="bg-muted/20 px-8 py-2">
          {f.lineas.length === 0 ? (
            <p className="text-muted-foreground">Sin líneas.</p>
          ) : (
            <ul className="space-y-0.5">
              {f.lineas.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="tabular-nums text-muted-foreground w-10">{l.cantidad}×</span>
                  <span className="flex-1">{l.nombre}</span>
                  <span className="tabular-nums text-muted-foreground">{eur(l.precioUnitario)}</span>
                  <span className="tabular-nums font-medium w-16 text-right">{eur(l.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
