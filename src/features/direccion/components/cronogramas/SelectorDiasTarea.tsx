"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Frecuencia, TerminaTipo } from "../../hooks/useCronogramasOperativos";

type CalendarioPatch = {
  frecuencia?: Frecuencia;
  dia_semana?: number[] | null;
  dia_mes?: number | null;
  fecha_anual?: string | null;
  meses_trimestrales?: number[] | null;
  tiempo_requerido?: string;
  intervalo?: number | null;
  termina_tipo?: TerminaTipo | null;
  termina_fecha?: string | null;
  termina_repeticiones?: number | null;
  fecha_inicio?: string | null;
};

interface Props {
  frecuencia: Frecuencia | string;
  dia_semana?: number[] | null;
  dia_mes?: number | null;
  fecha_anual?: string | null;
  meses_trimestrales?: number[] | null;
  tiempo_requerido?: string | null;
  intervalo?: number | null;
  termina_tipo?: TerminaTipo | null;
  termina_fecha?: string | null;
  termina_repeticiones?: number | null;
  fecha_inicio?: string | null;
  onChange: (patch: CalendarioPatch) => void;
  compact?: boolean;
}

const DIAS = [
  { iso: 1, label: "L" },
  { iso: 2, label: "M" },
  { iso: 3, label: "X" },
  { iso: 4, label: "J" },
  { iso: 5, label: "V" },
  { iso: 6, label: "S" },
  { iso: 7, label: "D" },
];

const DIAS_LARGOS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

const FRECUENCIA_LABEL: Record<Frecuencia, string> = {
  DIARIO: "día",
  SEMANAL: "semana",
  MENSUAL: "mes",
  TRIMESTRAL: "trimestre",
  ANUAL: "año",
  "POR NECESIDAD": "por necesidad",
  OTRO: "—",
};

const FRECUENCIAS_RECURRENTES: Frecuencia[] = ["DIARIO", "SEMANAL", "MENSUAL", "TRIMESTRAL", "ANUAL"];

const TIEMPO_OPCIONES = [
  "15 MIN", "30 MIN", "45 MIN",
  "1 HORA", "1H 15 MIN", "1H 30 MIN", "1H 45 MIN",
  "2 HORAS", "2H 15 MIN", "2H 30 MIN", "2H 45 MIN",
  "3 HORAS", "3H 30 MIN",
  "4 HORAS", "5 HORAS", "6 HORAS", "7 HORAS", "8 HORAS",
];

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function SelectorDiasTarea({
  frecuencia,
  dia_semana,
  dia_mes,
  fecha_anual,
  meses_trimestrales,
  tiempo_requerido,
  intervalo,
  termina_tipo,
  termina_fecha,
  termina_repeticiones,
  fecha_inicio,
  onChange,
  compact = false,
}: Props) {
  const intervaloVal = intervalo ?? 1;
  const isRecurrente = FRECUENCIAS_RECURRENTES.includes(frecuencia as Frecuencia);

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
    if (nueva === "POR NECESIDAD") {
      patch.intervalo = 1;
      patch.termina_tipo = null;
      patch.termina_fecha = null;
      patch.termina_repeticiones = null;
      patch.fecha_inicio = null;
    }
    onChange(patch);
  };

  const setIntervalo = (n: number) => {
    const v = Math.max(1, Math.min(99, n || 1));
    const patch: CalendarioPatch = { intervalo: v };
    if (v > 1 && !fecha_inicio) patch.fecha_inicio = todayISO();
    onChange(patch);
  };

  const setTermina = (tipo: TerminaTipo | null) => {
    const patch: CalendarioPatch = { termina_tipo: tipo };
    if (tipo === null) {
      patch.termina_fecha = null;
      patch.termina_repeticiones = null;
    }
    if (tipo === "fecha") {
      patch.termina_repeticiones = null;
      if (!termina_fecha) {
        const d = new Date();
        d.setMonth(d.getMonth() + 3);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        patch.termina_fecha = `${y}-${m}-${day}`;
      }
    }
    if (tipo === "repeticiones") {
      patch.termina_fecha = null;
      if (!termina_repeticiones) patch.termina_repeticiones = 13;
    }
    onChange(patch);
  };

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {/* Repetir cada + Tiempo requerido (misma fila) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase">
            Repetir cada
          </Label>
          <div className="flex items-center gap-2 mt-1.5">
            <Input
              type="number"
              min={1}
              max={99}
              value={intervaloVal}
              onChange={(e) => setIntervalo(Number(e.target.value))}
              disabled={!isRecurrente}
              className="w-16 text-center"
            />
            <Select value={frecuencia as string} onValueChange={(v) => handleFrecuencia(v as Frecuencia)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FRECUENCIA_LABEL) as Frecuencia[])
                  .filter((f) => f !== "OTRO")
                  .map((f) => (
                    <SelectItem key={f} value={f}>
                      {FRECUENCIA_LABEL[f]}{intervaloVal > 1 && f !== "POR NECESIDAD" ? "s" : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase">
            Tiempo requerido
          </Label>
          <Select
            value={tiempo_requerido ?? ""}
            onValueChange={(v) => onChange({ tiempo_requerido: v })}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Selecciona…" />
            </SelectTrigger>
            <SelectContent>
              {TIEMPO_OPCIONES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Frecuencia específica + Termina (lado a lado) */}
      <div className={cn(isRecurrente && frecuencia !== "DIARIO" ? "grid grid-cols-2 gap-4" : "")}>
        {/* SEMANAL — días de la semana */}
        {frecuencia === "SEMANAL" && (
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">
              Se repite el
            </Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {DIAS.map((d) => {
                const active = (dia_semana ?? []).includes(d.iso);
                return (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => toggleDiaSemana(d.iso)}
                    title={DIAS_LARGOS[d.iso]}
                    className={cn(
                      "w-9 h-9 rounded-full text-xs font-semibold border transition-all",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            {(dia_semana ?? []).length === 0 && (
              <p className="text-xs text-amber-600 mt-1.5">Selecciona al menos un día.</p>
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
              className="mt-1.5 w-24"
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
                          : "bg-background border-border text-muted-foreground hover:border-primary/50",
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
                className="mt-1.5 w-24"
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
              Fecha anual
            </Label>
            <div className="flex gap-2 mt-1.5">
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

        {/* TERMINA */}
        {isRecurrente && (
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">
              Termina
            </Label>
            <div className="space-y-1.5 mt-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="termina"
                  checked={termina_tipo == null}
                  onChange={() => setTermina(null)}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">Nunca</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="termina"
                  checked={termina_tipo === "fecha"}
                  onChange={() => setTermina("fecha")}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm w-16">El</span>
                <Input
                  type="date"
                  value={termina_fecha ?? ""}
                  onChange={(e) => onChange({ termina_fecha: e.target.value || null, termina_tipo: "fecha" })}
                  disabled={termina_tipo !== "fecha"}
                  className="h-8 flex-1"
                />
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="termina"
                  checked={termina_tipo === "repeticiones"}
                  onChange={() => setTermina("repeticiones")}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm w-16">Tras</span>
                <Input
                  type="number"
                  min={1}
                  max={9999}
                  value={termina_repeticiones ?? ""}
                  onChange={(e) =>
                    onChange({
                      termina_repeticiones: e.target.value ? Math.max(1, Number(e.target.value)) : null,
                      termina_tipo: "repeticiones",
                    })
                  }
                  disabled={termina_tipo !== "repeticiones"}
                  className="h-8 w-16"
                />
                <span className="text-xs text-muted-foreground">rep.</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* DIARIO — info cuando intervalo=1 */}
      {frecuencia === "DIARIO" && intervaloVal === 1 && (
        <Badge variant="secondary" className="text-xs">
          Se ejecutará todos los días.
        </Badge>
      )}
      {frecuencia === "POR NECESIDAD" && (
        <Badge variant="secondary" className="text-xs">
          No se siembra automáticamente. Aparece en una lista aparte para lanzar manualmente.
        </Badge>
      )}

      {/* Fecha de inicio (solo si intervalo > 1) */}
      {isRecurrente && intervaloVal > 1 && (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase">
            Empieza el
          </Label>
          <Input
            type="date"
            value={fecha_inicio ?? ""}
            onChange={(e) => onChange({ fecha_inicio: e.target.value || null })}
            className="mt-1.5 max-w-[200px]"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Ancla del intervalo. Las repeticiones se cuentan desde esta fecha.
          </p>
        </div>
      )}
    </div>
  );
}

export function BadgesDiasTarea({
  frecuencia, dia_semana, dia_mes, fecha_anual, meses_trimestrales,
  intervalo, termina_tipo, termina_fecha, termina_repeticiones,
}: Omit<Props, "onChange" | "compact" | "tiempo_requerido" | "fecha_inicio">) {
  const N = intervalo ?? 1;
  const prefijo = N > 1 ? `cada ${N} ` : "";
  const sufijoTermina = (() => {
    if (termina_tipo === "fecha" && termina_fecha) {
      const [y, m, d] = termina_fecha.split("-");
      return ` · hasta ${d}/${m}/${y.slice(2)}`;
    }
    if (termina_tipo === "repeticiones" && termina_repeticiones) {
      return ` · ${termina_repeticiones}×`;
    }
    return "";
  })();

  if (frecuencia === "DIARIO") {
    const txt = N > 1 ? `Cada ${N} días` : "Todos los días";
    return <Badge variant="outline" className="text-[10px] uppercase">{txt}{sufijoTermina}</Badge>;
  }
  if (frecuencia === "SEMANAL" && dia_semana && dia_semana.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {N > 1 && <span className="text-[10px] text-muted-foreground uppercase">cada {N} sem.</span>}
        {dia_semana.map((d) => (
          <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0">
            {DIAS_LARGOS[d]}
          </Badge>
        ))}
        {sufijoTermina && <span className="text-[10px] text-muted-foreground">{sufijoTermina}</span>}
      </div>
    );
  }
  if (frecuencia === "MENSUAL" && dia_mes) {
    return (
      <Badge variant="outline" className="text-[10px]">
        {prefijo}{N > 1 ? "meses" : "mes"} · día {dia_mes}{sufijoTermina}
      </Badge>
    );
  }
  if (frecuencia === "TRIMESTRAL" && dia_mes) {
    const meses = (meses_trimestrales ?? [1, 4, 7, 10]).map((m) => MESES[m - 1]).join("·");
    return <Badge variant="outline" className="text-[10px]">Día {dia_mes} · {meses}{sufijoTermina}</Badge>;
  }
  if (frecuencia === "ANUAL" && fecha_anual) {
    const [m, d] = fecha_anual.split("-");
    return <Badge variant="outline" className="text-[10px]">{prefijo}{N > 1 ? "años" : "año"} · {d} {MESES[parseInt(m) - 1]}{sufijoTermina}</Badge>;
  }
  if (frecuencia === "POR NECESIDAD") {
    return <Badge variant="outline" className="text-[10px]">Bajo demanda</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] text-amber-600">Sin fecha definida</Badge>;
}
