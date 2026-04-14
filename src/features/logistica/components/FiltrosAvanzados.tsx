"use client";

import { useState, useMemo } from "react";
import { SlidersHorizontal, ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";

export type TipoCampo = "lista" | "numero" | "fecha";

export type CampoFiltro<T extends string = string> = {
  campo: T;
  label: string;
  tipo: TipoCampo;
  opciones?: string[]; // para tipo "lista"
};

export type FiltroActivo<T extends string = string> = {
  id: string;
  campo: T;
  etiqueta: string;
  valores?: string[];
  operador?: "mayor" | "menor" | "igual";
  numVal?: number;
  desde?: string;
  hasta?: string;
};

interface FiltrosAvanzadosProps<T extends string = string> {
  campos: CampoFiltro<T>[];
  filtros: FiltroActivo<T>[];
  onChange: (f: FiltroActivo<T>[]) => void;
}

export function FiltrosAvanzados<T extends string = string>({
  campos,
  filtros,
  onChange,
}: FiltrosAvanzadosProps<T>) {
  const [open, setOpen] = useState(false);
  const [paso, setPaso] = useState<"campo" | "valor">("campo");
  const [campoActual, setCampoActual] = useState<T | null>(null);
  const [tempValores, setTempValores] = useState<string[]>([]);
  const [tempOperador, setTempOperador] = useState<"mayor" | "menor" | "igual">("mayor");
  const [tempNum, setTempNum] = useState("");
  const [tempDesde, setTempDesde] = useState("");
  const [tempHasta, setTempHasta] = useState("");

  const campoDef = useMemo(
    () => (campoActual ? campos.find((c) => c.campo === campoActual) : null),
    [campoActual, campos]
  );

  function abrirCampo(c: T) {
    setCampoActual(c);
    setTempValores([]);
    setTempOperador("mayor");
    setTempNum("");
    setTempDesde("");
    setTempHasta("");
    setPaso("valor");
  }

  function confirmarFiltro() {
    if (!campoActual || !campoDef) return;
    let nuevo: FiltroActivo<T> | null = null;
    if (campoDef.tipo === "lista" && tempValores.length > 0) {
      nuevo = { id: crypto.randomUUID(), campo: campoActual, etiqueta: campoDef.label, valores: tempValores };
    } else if (campoDef.tipo === "numero" && tempNum) {
      nuevo = { id: crypto.randomUUID(), campo: campoActual, etiqueta: campoDef.label, operador: tempOperador, numVal: parseFloat(tempNum) };
    } else if (campoDef.tipo === "fecha" && (tempDesde || tempHasta)) {
      nuevo = { id: crypto.randomUUID(), campo: campoActual, etiqueta: campoDef.label, desde: tempDesde || undefined, hasta: tempHasta || undefined };
    }
    if (nuevo) onChange([...filtros, nuevo]);
    setOpen(false);
    setPaso("campo");
  }

  function labelFiltro(f: FiltroActivo<T>): string {
    if (f.valores?.length) return `${f.etiqueta}: ${f.valores.join(", ")}`;
    if (f.operador !== undefined) {
      const op = f.operador === "mayor" ? ">" : f.operador === "menor" ? "<" : "=";
      return `${f.etiqueta} ${op} ${f.numVal}`;
    }
    const partes: string[] = [];
    if (f.desde) partes.push(`desde ${f.desde}`);
    if (f.hasta) partes.push(`hasta ${f.hasta}`);
    return `${f.etiqueta}: ${partes.join(" ")}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPaso("campo"); }}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtrar
            {filtros.length > 0 && (
              <Badge className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px] rounded-full">{filtros.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="end">
          {paso === "campo" ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtrar por columna</p>
              <div className="grid grid-cols-2 gap-1.5">
                {campos.map((c) => (
                  <button
                    key={c.campo}
                    onClick={() => abrirCampo(c.campo)}
                    className="text-left text-sm px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors border border-transparent hover:border-border"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPaso("campo")} className="text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold">{campoDef?.label}</p>
              </div>

              {campoDef?.tipo === "lista" && (
                <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
                  {(campoDef.opciones ?? []).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm px-1.5 py-1 rounded hover:bg-muted cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={tempValores.includes(opt)}
                        onChange={(e) =>
                          setTempValores(e.target.checked ? [...tempValores, opt] : tempValores.filter((v) => v !== opt))
                        }
                        className="rounded accent-primary"
                      />
                      {opt}
                    </label>
                  ))}
                  {(campoDef.opciones ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Sin opciones disponibles</p>
                  )}
                </div>
              )}

              {campoDef?.tipo === "numero" && (
                <div className="space-y-2">
                  <Select value={tempOperador} onValueChange={(v) => setTempOperador(v as typeof tempOperador)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mayor">Mayor que (&gt;)</SelectItem>
                      <SelectItem value="menor">Menor que (&lt;)</SelectItem>
                      <SelectItem value="igual">Igual a (=)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Introducir valor..."
                    value={tempNum}
                    onChange={(e) => setTempNum(e.target.value)}
                    className="h-8"
                  />
                </div>
              )}

              {campoDef?.tipo === "fecha" && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Desde</Label>
                    <Input type="date" value={tempDesde} onChange={(e) => setTempDesde(e.target.value)} className="h-8 mt-0.5" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Hasta</Label>
                    <Input type="date" value={tempHasta} onChange={(e) => setTempHasta(e.target.value)} className="h-8 mt-0.5" />
                  </div>
                </div>
              )}

              <Button size="sm" className="w-full" onClick={confirmarFiltro}>Aplicar filtro</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {filtros.map((f) => (
        <span key={f.id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5">
          {labelFiltro(f)}
          <button onClick={() => onChange(filtros.filter((x) => x.id !== f.id))} className="hover:text-destructive ml-0.5">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {filtros.length > 1 && (
        <button onClick={() => onChange([])} className="text-xs text-muted-foreground hover:text-foreground underline">
          Limpiar todo
        </button>
      )}
    </div>
  );
}
