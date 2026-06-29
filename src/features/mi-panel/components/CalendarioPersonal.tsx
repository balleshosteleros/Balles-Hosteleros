"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, AlertCircle, Info } from "lucide-react";
import {
  getMiCalendarioMes,
  getZonaHorariaActiva,
} from "@/features/mi-panel/actions/mi-panel-actions";
import {
  formatFechaEnZona,
  formatHoraEnZona,
  ZONA_HORARIA_FALLBACK,
} from "@/features/empresa/lib/zona-horaria";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getFestivoEnFecha } from "@/features/rrhh/data/calendarios";
import type { DiaCalendario } from "@/features/mi-panel/types";
import { formatHorasDecimal } from "@/shared/lib/timeUtils";
import { CalendarRangeToggle, CalendarRangeNav } from "@/shared/components/calendar/CalendarRangeToggle";
import { useCalendarRange, type CalendarRangeMode } from "@/shared/components/calendar/calendar-range";
import { cn } from "@/lib/utils";

const TIPO_FESTIVO_LABEL: Record<string, string> = {
  nacional: "Nacional",
  autonomico: "Autonómico",
  local: "Local",
};

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function indexLunes(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const HORARIO_PROVISIONAL: Record<number, { tipo: "trabajo" | "libre"; horario: string }> = {
  0: { tipo: "trabajo", horario: "10:00–16:00" },
  1: { tipo: "trabajo", horario: "10:00–16:00" },
  2: { tipo: "libre", horario: "—" },
  3: { tipo: "trabajo", horario: "17:00–23:00" },
  4: { tipo: "trabajo", horario: "13:00–23:30" },
  5: { tipo: "trabajo", horario: "12:00–23:30" },
  6: { tipo: "libre", horario: "—" },
};

type EstadoDia = "vacaciones" | "baja" | "permiso" | "hoy" | "trabajado" | "trabajar" | "libre";

interface DiaInfo {
  estado: EstadoDia;
  badgeText: string;
  horario: string;
}

function getDiaInfo(fecha: string, info: DiaCalendario | undefined, todayKey: string): DiaInfo {
  const isToday = fecha === todayKey;
  const isPast = fecha < todayKey;
  const isFuture = fecha > todayKey;
  const [yy, mm, dd] = fecha.split("-").map(Number);
  const idx = indexLunes(new Date(yy, mm - 1, dd));
  const prov = HORARIO_PROVISIONAL[idx];

  if (info?.ausencia === "vacaciones") return { estado: "vacaciones", badgeText: "VACAC.", horario: "—" };
  if (info?.ausencia === "baja_medica") return { estado: "baja", badgeText: "BAJA", horario: "—" };
  if (info?.ausencia === "permiso") return { estado: "permiso", badgeText: "PERMISO", horario: "—" };

  const horarioFichado = info?.fichado ? `${formatHorasDecimal(info.horasFichaje)} fichadas` : prov.horario;

  if (isToday) return { estado: "hoy", badgeText: "HOY", horario: horarioFichado };
  if (info?.fichado || (prov.tipo === "trabajo" && isPast)) return { estado: "trabajado", badgeText: "TRABAJADO", horario: horarioFichado };
  if (prov.tipo === "trabajo" && isFuture) return { estado: "trabajar", badgeText: "TRABAJAR", horario: prov.horario };
  return { estado: "libre", badgeText: "LIBRE", horario: prov.horario };
}

const TW_CLASSES: Record<EstadoDia, { bg: string; badge: string; horario: string }> = {
  vacaciones: { bg: "bg-blue-50 hover:bg-blue-100 border border-blue-200",       badge: "bg-blue-500 text-white",   horario: "text-blue-700" },
  baja:       { bg: "bg-rose-50 hover:bg-rose-100 border border-rose-200",       badge: "bg-rose-500 text-white",   horario: "text-rose-700" },
  permiso:    { bg: "bg-violet-50 hover:bg-violet-100 border border-violet-200", badge: "bg-violet-500 text-white", horario: "text-violet-700" },
  hoy:        { bg: "bg-yellow-100 hover:bg-yellow-200 border border-yellow-400", badge: "bg-yellow-500 text-white", horario: "text-yellow-800" },
  trabajado:  { bg: "bg-emerald-50 hover:bg-emerald-100 border border-emerald-200", badge: "bg-emerald-500 text-white", horario: "text-emerald-700" },
  trabajar:   { bg: "bg-orange-50 hover:bg-orange-100 border border-orange-200", badge: "bg-orange-500 text-white", horario: "text-orange-700" },
  libre:      { bg: "bg-slate-50 hover:bg-slate-100 border border-slate-200",     badge: "bg-slate-400 text-white",  horario: "text-slate-500" },
};

const HEX_STYLES: Record<EstadoDia, { bg: string; border: string; badge: string; text: string }> = {
  vacaciones: { bg: "#eff6ff", border: "#bfdbfe", badge: "#3b82f6", text: "#1d4ed8" },
  baja:       { bg: "#fff1f2", border: "#fecdd3", badge: "#f43f5e", text: "#be123c" },
  permiso:    { bg: "#f5f3ff", border: "#ddd6fe", badge: "#8b5cf6", text: "#6d28d9" },
  hoy:        { bg: "#fef9c3", border: "#facc15", badge: "#eab308", text: "#854d0e" },
  trabajado:  { bg: "#ecfdf5", border: "#a7f3d0", badge: "#10b981", text: "#047857" },
  trabajar:   { bg: "#fff7ed", border: "#fed7aa", badge: "#f97316", text: "#c2410c" },
  libre:      { bg: "#f8fafc", border: "#e2e8f0", badge: "#94a3b8", text: "#64748b" },
};

interface CalendarioPersonalProps {
  refreshKey?: number;
}

function mesesARequerir(mode: CalendarRangeMode, anchor: Date): { y: number; m: number }[] {
  const out: { y: number; m: number }[] = [];
  const push = (d: Date) => {
    const key = { y: d.getFullYear(), m: d.getMonth() + 1 };
    if (!out.some((k) => k.y === key.y && k.m === key.m)) out.push(key);
  };
  if (mode === "DIARIO") {
    push(anchor);
  } else if (mode === "SEMANAL") {
    const start = new Date(anchor);
    const iso = (anchor.getDay() + 6) % 7;
    start.setDate(start.getDate() - iso);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      push(d);
    }
  } else if (mode === "MENSUAL") {
    push(anchor);
  } else if (mode === "TRIMESTRAL") {
    const q = Math.floor(anchor.getMonth() / 3) * 3;
    for (let i = 0; i < 3; i++) push(new Date(anchor.getFullYear(), q + i, 1));
  } else if (mode === "SEMESTRAL") {
    const s = anchor.getMonth() < 6 ? 0 : 6;
    for (let i = 0; i < 6; i++) push(new Date(anchor.getFullYear(), s + i, 1));
  } else {
    for (let i = 0; i < 12; i++) push(new Date(anchor.getFullYear(), i, 1));
  }
  return out;
}

export function CalendarioPersonal({ refreshKey = 0 }: CalendarioPersonalProps) {
  const { profile } = useAuth();
  const { empresaActual } = useEmpresa();
  const today = new Date();
  const todayKey = ymd(today);

  const rango = useCalendarRange("MENSUAL");
  const [dias, setDias] = useState<DiaCalendario[]>([]);
  const [loading, setLoading] = useState(true);
  // Zona horaria de la empresa (PRP-069): formatea el sello "Descargado el" del
  // PDF, que es un instante (el momento de la descarga). Resuelta en servidor.
  const [zonaHoraria, setZonaHoraria] = useState<string>(ZONA_HORARIA_FALLBACK);

  useEffect(() => {
    getZonaHorariaActiva().then(setZonaHoraria);
  }, []);

  const mesesKey = useMemo(() => {
    return mesesARequerir(rango.mode, rango.anchor).map((k) => `${k.y}-${k.m}`).join("|");
  }, [rango.mode, rango.anchor]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const meses = mesesARequerir(rango.mode, rango.anchor);
    Promise.all(meses.map(({ y, m }) => getMiCalendarioMes(y, m)))
      .then((results) => {
        if (cancel) return;
        const all: DiaCalendario[] = [];
        for (const r of results) {
          if (r.ok) all.push(...r.data);
        }
        setDias(all);
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [mesesKey, refreshKey]);

  const map = useMemo(() => {
    const m = new Map<string, DiaCalendario>();
    for (const d of dias) m.set(d.fecha, d);
    return m;
  }, [dias]);

  const renderDayCell = (fecha: string, dia: number, opts?: { compact?: boolean }) => {
    const info = map.get(fecha);
    const isToday = fecha === todayKey;
    const di = getDiaInfo(fecha, info, todayKey);
    const cls = TW_CLASSES[di.estado];
    const festivoInfo = empresaActual?.id ? getFestivoEnFecha(empresaActual.id, fecha) : null;
    const compact = opts?.compact ?? false;

    return (
      <div
        title={`${fecha} · ${di.badgeText} ${di.horario}`}
        className={cn(
          "relative rounded-md p-1.5 flex flex-col items-center justify-center gap-1 transition-colors cursor-default",
          compact ? "min-h-[44px]" : "min-h-[78px]",
          cls.bg,
        )}
      >
        <span className={cn(
          "absolute top-1 right-1.5 font-bold leading-none",
          compact ? "text-[9px]" : "text-[11px]",
          isToday ? "text-yellow-900" : "text-slate-700",
        )}>
          {dia}
        </span>
        {festivoInfo && !compact && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute top-1 left-1 h-4 w-4 rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform z-10",
                  festivoInfo.tipo === "festivo" ? "bg-rose-500 text-white" : "bg-sky-500 text-white",
                )}
                aria-label={festivoInfo.tipo === "festivo" ? "Festivo" : "Víspera de festivo"}
              >
                {festivoInfo.tipo === "festivo"
                  ? <AlertCircle className="h-3 w-3" />
                  : <Info className="h-3 w-3" />}
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-60 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold">
                {festivoInfo.tipo === "festivo"
                  ? <><AlertCircle className="h-3.5 w-3.5 text-rose-500" /> Festivo</>
                  : <><Info className="h-3.5 w-3.5 text-sky-500" /> Víspera de festivo</>}
              </div>
              <div className="mt-2 space-y-1">
                <div className="font-medium">{festivoInfo.festivo.nombre}</div>
                <div className="text-muted-foreground">{festivoInfo.festivo.fecha}</div>
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    {TIPO_FESTIVO_LABEL[festivoInfo.festivo.tipo] ?? festivoInfo.festivo.tipo}
                  </Badge>
                  {festivoInfo.festivo.region && (
                    <Badge variant="outline" className="text-[10px]">{festivoInfo.festivo.region}</Badge>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}
        {festivoInfo && compact && (
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-1.5 w-1.5 rounded-full",
              festivoInfo.tipo === "festivo" ? "bg-rose-500" : "bg-sky-500",
            )}
            title={festivoInfo.festivo.nombre}
          />
        )}
        {!compact && (
          <>
            <span className={cn("text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded", cls.badge)}>
              {di.badgeText}
            </span>
            <span className={cn("text-[10px] font-medium leading-none", cls.horario)}>
              {di.horario}
            </span>
            {info?.trabajoExtra === "horas_extras" && (
              <span className="text-[8px] font-semibold text-amber-700 leading-none">+ EXTRAS</span>
            )}
          </>
        )}
        {compact && (
          <span className={cn("h-1 w-1 rounded-full", cls.badge)} />
        )}
      </div>
    );
  };

  function handleDownloadPdf() {
    const anio = rango.anchor.getFullYear();
    const mes = rango.anchor.getMonth() + 1;
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    const ahoraIso = today.toISOString();
    const fechaDesc = formatFechaEnZona(ahoraIso, zonaHoraria, { month: "long" });
    const horaDesc = formatHoraEnZona(ahoraIso, zonaHoraria);
    const nombre = profile?.nombre ?? "";
    const apellidos = profile?.apellidos ?? "";
    const dni = "—";

    const primerDia = new Date(anio, mes - 1, 1);
    const totalDias = new Date(anio, mes, 0).getDate();
    const offsetIni = indexLunes(primerDia);
    const celdas: { fecha: string | null; dia: number | null }[] = [];
    for (let i = 0; i < offsetIni; i++) celdas.push({ fecha: null, dia: null });
    for (let d = 1; d <= totalDias; d++) {
      const fecha = ymd(new Date(anio, mes - 1, d));
      celdas.push({ fecha, dia: d });
    }
    while (celdas.length % 7 !== 0) celdas.push({ fecha: null, dia: null });

    const cellsHtml = celdas.map((c) => {
      if (!c.fecha) return `<div class="cell empty"></div>`;
      const info = map.get(c.fecha);
      const di = getDiaInfo(c.fecha, info, todayKey);
      const s = HEX_STYLES[di.estado];
      return `<div class="cell" style="background:${s.bg};border-color:${s.border}"><span class="cell-num">${c.dia}</span><span class="badge" style="background:${s.badge}">${di.badgeText}</span><span class="horario" style="color:${s.text}">${di.horario}</span></div>`;
    }).join("");

    const headersHtml = DIAS_SEMANA.map((d) => `<div class="dh">${d}</div>`).join("");
    const leyendaItems: { color: string; text: string }[] = [
      { color: HEX_STYLES.trabajado.badge, text: "Trabajado" },
      { color: HEX_STYLES.hoy.badge, text: "Hoy" },
      { color: HEX_STYLES.trabajar.badge, text: "Trabajar" },
      { color: HEX_STYLES.libre.badge, text: "Libre" },
      { color: HEX_STYLES.vacaciones.badge, text: "Vacaciones" },
      { color: HEX_STYLES.baja.badge, text: "Baja médica" },
      { color: HEX_STYLES.permiso.badge, text: "Permiso" },
    ];
    const leyendaHtml = leyendaItems.map((l) => `<span class="leg-item"><span class="sw" style="background:${l.color}"></span>${l.text}</span>`).join("");

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Mi calendario · ${MESES[mes - 1]} ${anio}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;margin:0;padding:24px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:18px}
  .name{font-size:22px;font-weight:700;margin:0;letter-spacing:-0.01em}
  .data{font-size:13px;color:#475569;margin-top:6px;line-height:1.6}
  .data b{color:#0f172a}
  .download-date{font-size:10px;color:#94a3b8;text-align:right;line-height:1.4}
  h2{font-size:16px;margin:0 0 12px 0;font-weight:600}
  .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
  .dh{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;text-align:center;color:#64748b;padding:6px 0}
  .cell{min-height:72px;border:1px solid #e2e8f0;border-radius:6px;padding:6px 4px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
  .cell.empty{border:none;background:transparent}
  .cell-num{position:absolute;top:4px;right:6px;font-size:11px;font-weight:700;color:#334155}
  .badge{font-size:8.5px;font-weight:700;padding:2px 6px;border-radius:4px;color:#fff;letter-spacing:0.06em}
  .horario{font-size:9.5px;font-weight:500}
  .legend{margin-top:14px;display:flex;flex-wrap:wrap;gap:10px;font-size:10px;color:#64748b}
  .leg-item{display:inline-flex;align-items:center;gap:4px}
  .sw{width:10px;height:10px;border-radius:2px;display:inline-block}
  .footer-note{margin-top:8px;font-size:9px;font-style:italic;color:#94a3b8}
  @media print{body{padding:14px}.cell{min-height:64px}}
</style></head>
<body>
  <div class="header">
    <div>
      <h1 class="name">${nombre} ${apellidos}</h1>
      <div class="data"><b>DNI:</b> ${dni}</div>
    </div>
    <div class="download-date">Descargado el<br>${fechaDesc}<br>${horaDesc}</div>
  </div>
  <h2>Mi calendario · ${MESES[mes - 1]} ${anio}</h2>
  <div class="grid">${headersHtml}</div>
  <div class="grid" style="margin-top:4px">${cellsHtml}</div>
  <div class="legend">${leyendaHtml}</div>
  <div class="footer-note">Horario provisional (mock)</div>
  <script>window.addEventListener("load",function(){setTimeout(function(){window.print();},200);});</script>
</body></html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <h2 className="text-lg font-semibold">Mi calendario</h2>
          <CalendarRangeToggle mode={rango.mode} onChange={rango.setMode} />
        </div>
        <div className="flex items-center gap-1">
          <CalendarRangeNav
            label={rango.label}
            onPrev={rango.prev}
            onNext={rango.next}
            onToday={rango.goToToday}
            isToday={rango.isToday}
            minWidth={160}
          />
          {rango.mode === "MENSUAL" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              className="ml-2"
              disabled={loading}
              aria-label="Descargar PDF"
            >
              <Download className="h-4 w-4 mr-1.5" />
              PDF
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {rango.mode === "DIARIO" && (
            <VistaDiaria fecha={ymd(rango.anchor)} renderDayCell={renderDayCell} />
          )}
          {rango.mode === "SEMANAL" && (
            <VistaSemanal inicio={rango.range.start} renderDayCell={renderDayCell} />
          )}
          {rango.mode === "MENSUAL" && (
            <VistaMensual anchor={rango.anchor} renderDayCell={renderDayCell} />
          )}
          {(rango.mode === "TRIMESTRAL" || rango.mode === "SEMESTRAL" || rango.mode === "ANUAL") && (
            <VistaMultiMes
              meses={mesesARequerir(rango.mode, rango.anchor)}
              mesesCount={rango.mode === "TRIMESTRAL" ? 3 : rango.mode === "SEMESTRAL" ? 6 : 12}
              renderDayCell={renderDayCell}
            />
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Trabajado</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-yellow-500" /> Hoy</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-orange-500" /> Trabajar</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Libre</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Vacaciones</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Baja médica</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Permiso</span>
        <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-rose-500" /> Festivo</span>
        <span className="flex items-center gap-1"><Info className="h-3 w-3 text-sky-500" /> Víspera</span>
        <span className="ml-auto italic">Horario provisional (mock)</span>
      </div>
    </Card>
  );
}

function VistaDiaria({
  fecha,
  renderDayCell,
}: {
  fecha: string;
  renderDayCell: (fecha: string, dia: number, opts?: { compact?: boolean }) => React.ReactNode;
}) {
  const [yy, mm, dd] = fecha.split("-").map(Number);
  return (
    <div className="max-w-sm mx-auto">
      {renderDayCell(fecha, dd)}
      <div className="mt-2 text-center text-[11px] text-muted-foreground">
        {new Date(yy, mm - 1, dd).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}

function VistaSemanal({
  inicio,
  renderDayCell,
}: {
  inicio: Date;
  renderDayCell: (fecha: string, dia: number, opts?: { compact?: boolean }) => React.ReactNode;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
  return (
    <>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d, i) => (
          <div key={i}>{renderDayCell(ymd(d), d.getDate())}</div>
        ))}
      </div>
    </>
  );
}

function VistaMensual({
  anchor,
  renderDayCell,
}: {
  anchor: Date;
  renderDayCell: (fecha: string, dia: number, opts?: { compact?: boolean }) => React.ReactNode;
}) {
  const anio = anchor.getFullYear();
  const mes = anchor.getMonth() + 1;
  const primerDia = new Date(anio, mes - 1, 1);
  const totalDias = new Date(anio, mes, 0).getDate();
  const offsetIni = indexLunes(primerDia);
  const celdas: { fecha: string | null; dia: number | null }[] = [];
  for (let i = 0; i < offsetIni; i++) celdas.push({ fecha: null, dia: null });
  for (let d = 1; d <= totalDias; d++) {
    const fecha = ymd(new Date(anio, mes - 1, d));
    celdas.push({ fecha, dia: d });
  }
  while (celdas.length % 7 !== 0) celdas.push({ fecha: null, dia: null });

  return (
    <>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((c, i) => {
          if (!c.fecha) return <div key={i} className="min-h-[78px]" />;
          return <div key={i}>{renderDayCell(c.fecha, c.dia!)}</div>;
        })}
      </div>
    </>
  );
}

function VistaMultiMes({
  meses,
  mesesCount,
  renderDayCell,
}: {
  meses: { y: number; m: number }[];
  mesesCount: 3 | 6 | 12;
  renderDayCell: (fecha: string, dia: number, opts?: { compact?: boolean }) => React.ReactNode;
}) {
  const cols = mesesCount === 3 ? "grid-cols-1 md:grid-cols-3"
    : mesesCount === 6 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={cn("grid gap-3", cols)}>
      {meses.map(({ y, m }) => (
        <MiniMes key={`${y}-${m}`} anio={y} mes={m} renderDayCell={renderDayCell} />
      ))}
    </div>
  );
}

function MiniMes({
  anio,
  mes,
  renderDayCell,
}: {
  anio: number;
  mes: number;
  renderDayCell: (fecha: string, dia: number, opts?: { compact?: boolean }) => React.ReactNode;
}) {
  const primerDia = new Date(anio, mes - 1, 1);
  const totalDias = new Date(anio, mes, 0).getDate();
  const offsetIni = indexLunes(primerDia);
  const celdas: { fecha: string | null; dia: number | null }[] = [];
  for (let i = 0; i < offsetIni; i++) celdas.push({ fecha: null, dia: null });
  for (let d = 1; d <= totalDias; d++) {
    celdas.push({ fecha: ymd(new Date(anio, mes - 1, d)), dia: d });
  }
  while (celdas.length % 7 !== 0) celdas.push({ fecha: null, dia: null });

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-2.5 py-1.5 bg-muted/30 border-b text-center text-[11px] font-semibold uppercase tracking-wider">
        {MESES[mes - 1]} <span className="text-muted-foreground">{anio}</span>
      </div>
      <div className="grid grid-cols-7 text-[9px] text-muted-foreground bg-muted/10">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="px-1 py-0.5 text-center font-semibold">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 p-1">
        {celdas.map((c, i) => {
          if (!c.fecha) return <div key={i} className="aspect-square" />;
          return <div key={i}>{renderDayCell(c.fecha, c.dia!, { compact: true })}</div>;
        })}
      </div>
    </div>
  );
}
