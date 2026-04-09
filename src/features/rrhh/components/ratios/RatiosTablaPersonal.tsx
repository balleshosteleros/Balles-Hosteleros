import { SemanaRatio, FilaRatio, DIAS_LABELS, calcularResumenArea } from "@/features/rrhh/data/ratios";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const DIAS_CORTOS: Record<string, string> = {
  lunes: "LUN", martes: "MAR", miércoles: "MIÉ", jueves: "JUE",
  viernes: "VIE", sábado: "SÁB", domingo: "DOM",
};

function fmt(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDec(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtPct(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

function RatioIndicator({ value }: { value: number }) {
  const color = value <= 30 ? "text-emerald-600 bg-emerald-50" : value <= 40 ? "text-amber-600 bg-amber-50" : "text-destructive bg-red-50";
  const icon = value > 40 ? <AlertTriangle className="h-3 w-3" /> : null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", color)}>
      {icon}{fmtPct(value)}
    </span>
  );
}

function FilaRow({ fila }: { fila: FilaRatio }) {
  return (
    <TableRow className="text-xs hover:bg-muted/20">
      <TableCell className="sticky left-0 bg-card z-10 font-medium whitespace-nowrap">{fila.nombre}</TableCell>
      {fila.dias.map((d) => (
        <TableCell key={d.dia} className="text-center border-l border-border/40 tabular-nums text-muted-foreground" colSpan={1}>
          {d.coste > 0 ? (
            <div>
              <span>{fmt(d.coste)}</span>
              <span className="text-muted-foreground/60 ml-1 text-[10px]">{fmtDec(d.horas)}h</span>
            </div>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </TableCell>
      ))}
      <TableCell className="text-center border-l border-border font-semibold tabular-nums">
        <div>{fmt(fila.totalCoste)}<span className="text-muted-foreground/60 ml-1 text-[10px]">{fmtDec(fila.totalHoras)}h</span></div>
      </TableCell>
    </TableRow>
  );
}

export default function RatiosTablaPersonal({ semana }: { semana: SemanaRatio }) {
  const operativa = useMemo(() => calcularResumenArea(semana.filas, "operativa"), [semana]);
  const administrativa = useMemo(() => calcularResumenArea(semana.filas, "administrativa"), [semana]);
  const filasOp = semana.filas.filter((f) => f.area === "operativa");
  const filasAdm = semana.filas.filter((f) => f.area === "administrativa");

  const costeTotal = operativa.totalCoste + administrativa.totalCoste;
  const ratioGlobal = semana.facturacionTotal > 0 ? (costeTotal / semana.facturacionTotal) * 100 : 0;

  const costeTotalPorDia = (dia: string) => {
    const op = operativa.porDia.find((d) => d.dia === dia)?.coste ?? 0;
    const adm = administrativa.porDia.find((d) => d.dia === dia)?.coste ?? 0;
    return op + adm;
  };

  const ratioDia = (dia: string) => {
    const fact = semana.facturacionDiaria[dia] ?? 0;
    const coste = costeTotalPorDia(dia);
    return fact > 0 ? (coste / fact) * 100 : 0;
  };

  return (
    <Card>
      <CardContent className="p-0 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="sticky left-0 bg-muted/30 z-10 min-w-[180px]">PUESTO</TableHead>
              {DIAS_LABELS.map((dia) => (
                <TableHead key={dia} className="text-center text-xs border-l border-border/40 min-w-[100px]">
                  {DIAS_CORTOS[dia]}
                </TableHead>
              ))}
              <TableHead className="text-center text-xs border-l border-border font-bold bg-muted/50 min-w-[110px]">TOTAL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* OPERATIVA */}
            <TableRow className="bg-primary/5 border-t-2 border-primary/20">
              <TableCell colSpan={9} className="sticky left-0 font-bold text-xs text-primary tracking-wider py-2">ÁREA OPERATIVA</TableCell>
            </TableRow>
            {filasOp.map((f) => <FilaRow key={f.puestoId} fila={f} />)}
            <TableRow className="bg-primary/5 font-semibold text-xs border-t border-primary/20">
              <TableCell className="sticky left-0 bg-primary/5 z-10 font-bold">TOTAL OPERATIVA</TableCell>
              {operativa.porDia.map((d) => (
                <TableCell key={d.dia} className="text-center border-l border-border/40 tabular-nums">
                  {fmt(d.coste)} <span className="text-[10px] text-muted-foreground">{fmtDec(d.horas)}h</span>
                </TableCell>
              ))}
              <TableCell className="text-center border-l border-border font-bold tabular-nums">{fmt(operativa.totalCoste)}</TableCell>
            </TableRow>

            {/* ADMINISTRATIVA */}
            <TableRow className="bg-secondary/30 border-t-2 border-secondary/40">
              <TableCell colSpan={9} className="sticky left-0 font-bold text-xs text-secondary-foreground tracking-wider py-2">ÁREA ADMINISTRATIVA</TableCell>
            </TableRow>
            {filasAdm.map((f) => <FilaRow key={f.puestoId} fila={f} />)}
            <TableRow className="bg-secondary/20 font-semibold text-xs border-t border-secondary/30">
              <TableCell className="sticky left-0 bg-secondary/20 z-10 font-bold">TOTAL ADMINISTRATIVA</TableCell>
              {administrativa.porDia.map((d) => (
                <TableCell key={d.dia} className="text-center border-l border-border/40 tabular-nums">
                  {fmt(d.coste)} <span className="text-[10px] text-muted-foreground">{fmtDec(d.horas)}h</span>
                </TableCell>
              ))}
              <TableCell className="text-center border-l border-border font-bold tabular-nums">{fmt(administrativa.totalCoste)}</TableCell>
            </TableRow>

            {/* FACTURACIÓN */}
            <TableRow className="bg-muted/40 font-semibold text-xs border-t-2 border-border">
              <TableCell className="sticky left-0 bg-muted/40 z-10 font-bold">FACTURACIÓN</TableCell>
              {DIAS_LABELS.map((dia) => (
                <TableCell key={dia} className="text-center border-l border-border/40 tabular-nums">{fmt(semana.facturacionDiaria[dia] ?? 0)}</TableCell>
              ))}
              <TableCell className="text-center border-l border-border font-bold tabular-nums">{fmt(semana.facturacionTotal)}</TableCell>
            </TableRow>

            {/* % RRHH */}
            <TableRow className="font-bold text-xs border-t border-border">
              <TableCell className="sticky left-0 z-10 font-bold">% RRHH</TableCell>
              {DIAS_LABELS.map((dia) => (
                <TableCell key={dia} className="text-center border-l border-border/40">
                  <RatioIndicator value={ratioDia(dia)} />
                </TableCell>
              ))}
              <TableCell className="text-center border-l border-border">
                <RatioIndicator value={ratioGlobal} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
