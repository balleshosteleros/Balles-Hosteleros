"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Frecuencia } from "../../hooks/useCronogramasOperativos";

type CalendarioPatch = {
  frecuencia?: Frecuencia;
  dia_semana?: number[] | null;
  dia_mes?: number | null;
  fecha_anual?: string | null;
  meses_trimestrales?: number[] | null;
  tiempo_requerido?: string;
};

interface Props {
  frecuencia: Frecuencia | string;
  dia_semana?: number[] | null;
  dia_mes?: number | null;
  fecha_anual?: string | null;
  meses_trimestrales?: number[] | null;
  tiempo_requerido?: string | null;
  onChange: (patch: CalendarioPatch) => void;
  compact?: boolean;
}

const DIAS = [
  { iso: 1, label: "Lun" },
  { iso: 2, label: "Mar" },
  { iso: 3, label: "Mié" },
  { iso: 4, label: "Jue" },
  { iso: 5, label: "Vie" },
  { iso: 6, label: "Sáb" },
  { iso: 7, label: "Dom" },
];

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const FRECUENCIAS: Frecuencia[] = [
  "DIARIO", "SEMANAL", "MENSUAL", "TRIMESTRAL", "ANUAL", "POR NECESIDAD",
];

export function SelectorDiasTarea({
  frecuencia,
  dia_semana,
  dia_mes,
  fecha_anual,
  meses_trimestrales,
  tiempo_requerido,
  onChange,
  compact = false,
}: Props) {
  const toggleDiaSemana = (iso: number) => {
    const actuales = dia_semana ?? [];
    const nuevos = actuales.includes(iso)
      ? actuales.filter((d) => d !== iso)
      : [...actuales, iso].sort((a, b) => a - b);
    onChange({ dia_semana: nuevos.length > 0 ? nuevos : null });
  };

  const toggleMesTrimestral = (mes: number) => {
    const actuales = meses_trimestrales ?? [1, 4, 7, 10];
    const nuevos = actuales.includes(mes)
      ? actuales.filter((m) => m !== mes)
      : [...actuales, mes].sort((a, b) => a - b);
    onChange({ meses_trimestrales: nuevos.length > 0 ? nuevos : null });
  };

  const handleFrecuencia = (nueva: Frecuencia) => {
    const patch: CalendarioPatch = { frecuencia: nueva };
    if (nueva !== "SEMANAL") patch.dia_semana = null;
    if (nueva !== "MENSUAL" && nueva !== "TRIMESTRAL") patch.dia_mes = null;
    if (nueva !== "ANUAL") patch.fecha_anual = null;
    if (nueva !== "TRIMESTRAL") patch.meses_trimestrales = null;
    onChange(patch);
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {/* Frecuencia */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Frecuencia</Label>
          <Select value={frecuencia as string} onValueChange={(v) => handleFrecuencia(v as Frecuencia)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FRECUENCIAS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Tiempo requerido</Label>
          <Input
            className="mt-1"
            placeholder="Ej. 30 MIN / 1 HORA"
            value={tiempo_requerido ?? ""}
            onChange={(e) => onChange({ tiempo_requerido: e.target.value })}
          />
        </div>
      </div>

      {/* SEMANAL — días de la semana */}
      {frecuencia === "SEMANAL" && (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase">
            Días de la semana
          </Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {DIAS.map((d) => {
              const active = (dia_semana ?? []).includes(d.iso);
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => toggleDiaSemana(d.iso)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          {(dia_semana ?? []).length === 0 && (
            <p className="text-xs text-amber-600 mt-1">Selecciona al menos un día.</p>
          )}
        </div>
      )}

      {/* MENSUAL — día del mes */}
      {frecuencia === "MENSUAL" && (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase">
            Día del mes (1-31)
          </Label>
          <Input
            type="number"
            min={1}
            max={31}
            className="mt-1 w-24"
            value={dia_mes ?? ""}
            onChange={(e) =>
              onChange({ dia_mes: e.target.value ? Math.min(31, Math.max(1, Number(e.target.value))) : null })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Si eliges 31 y el mes no tiene 31, se ejecuta el último día.
          </p>
        </div>
      )}

      {/* TRIMESTRAL — meses + día del mes */}
      {frecuencia === "TRIMESTRAL" && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Meses</Label>
            <div className="grid grid-cols-6 gap-1.5 mt-1.5">
              {MESES.map((m, i) => {
                const mesN = i + 1;
                const active = (meses_trimestrales ?? [1, 4, 7, 10]).includes(mesN);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMesTrimestral(mesN)}
                    className={cn(
                      "px-2 py-1.5 rounded text-xs font-semibold border transition-all",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">
              Día del mes (1-31)
            </Label>
            <Input
              type="number"
              min={1}
              max={31}
              className="mt-1 w-24"
              value={dia_mes ?? ""}
              onChange={(e) =>
                onChange({ dia_mes: e.target.value ? Math.min(31, Math.max(1, Number(e.target.value))) : null })
              }
            />
          </div>
        </div>
      )}

      {/* ANUAL — fecha MM-DD */}
      {frecuencia === "ANUAL" && (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase">
            Fecha anual (mes-día)
          </Label>
          <div className="flex gap-2 mt-1">
            <Select
              value={fecha_anual ? fecha_anual.split("-")[0] : ""}
              onValueChange={(m) => {
                const d = fecha_anual ? fecha_anual.split("-")[1] : "01";
                onChange({ fecha_anual: `${m}-${d}` });
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((label, i) => {
                  const v = String(i + 1).padStart(2, "0");
                  return <SelectItem key={v} value={v}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={31}
              placeholder="Día"
              className="w-24"
              value={fecha_anual ? parseInt(fecha_anual.split("-")[1]) : ""}
              onChange={(e) => {
                const m = fecha_anual ? fecha_anual.split("-")[0] : "01";
                const d = String(Math.min(31, Math.max(1, Number(e.target.value) || 1))).padStart(2, "0");
                onChange({ fecha_anual: `${m}-${d}` });
              }}
            />
          </div>
        </div>
      )}

      {/* DIARIO / POR NECESIDAD — info */}
      {frecuencia === "DIARIO" && (
        <Badge variant="secondary" className="text-xs">
          Se ejecutará todos los días del año.
        </Badge>
      )}
      {frecuencia === "POR NECESIDAD" && (
        <Badge variant="secondary" className="text-xs">
          No se siembra automáticamente. Aparece en una lista aparte para lanzar manualmente.
        </Badge>
      )}
    </div>
  );
}

export function BadgesDiasTarea({
  frecuencia, dia_semana, dia_mes, fecha_anual, meses_trimestrales,
}: Omit<Props, "onChange" | "compact" | "tiempo_requerido">) {
  if (frecuencia === "DIARIO") {
    return <Badge variant="outline" className="text-[10px] uppercase">Todos los días</Badge>;
  }
  if (frecuencia === "SEMANAL" && dia_semana && dia_semana.length > 0) {
    return (
      <div className="flex flex-wrap gap-1">
        {dia_semana.map((d) => (
          <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0">
            {DIAS[d - 1]?.label}
          </Badge>
        ))}
      </div>
    );
  }
  if (frecuencia === "MENSUAL" && dia_mes) {
    return <Badge variant="outline" className="text-[10px]">Día {dia_mes} de cada mes</Badge>;
  }
  if (frecuencia === "TRIMESTRAL" && dia_mes) {
    const meses = (meses_trimestrales ?? [1, 4, 7, 10]).map((m) => MESES[m - 1]).join("·");
    return <Badge variant="outline" className="text-[10px]">Día {dia_mes} · {meses}</Badge>;
  }
  if (frecuencia === "ANUAL" && fecha_anual) {
    const [m, d] = fecha_anual.split("-");
    return <Badge variant="outline" className="text-[10px]">{d} {MESES[parseInt(m) - 1]}</Badge>;
  }
  if (frecuencia === "POR NECESIDAD") {
    return <Badge variant="outline" className="text-[10px]">Bajo demanda</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] text-amber-600">Sin fecha definida</Badge>;
}
