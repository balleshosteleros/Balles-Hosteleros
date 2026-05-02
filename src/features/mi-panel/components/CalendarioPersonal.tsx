"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { getMiCalendarioMes } from "@/features/mi-panel/actions/mi-panel-actions";
import { useAuth } from "@/features/auth/contexts/auth-context";
import type { DiaCalendario } from "@/features/mi-panel/types";

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function indexLunes(date: Date): number {
  // 0 = lunes ... 6 = domingo
  return (date.getDay() + 6) % 7;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Horario provisional por día de la semana (mock visual hasta conectar BD)
const HORARIO_PROVISIONAL: Record<number, { tipo: "trabajo" | "libre"; horario: string }> = {
  0: { tipo: "trabajo", horario: "10:00–16:00" }, // Lunes
  1: { tipo: "trabajo", horario: "10:00–16:00" }, // Martes
  2: { tipo: "libre", horario: "—" },              // Miércoles
  3: { tipo: "trabajo", horario: "17:00–23:00" }, // Jueves
  4: { tipo: "trabajo", horario: "13:00–23:30" }, // Viernes
  5: { tipo: "trabajo", horario: "12:00–23:30" }, // Sábado
  6: { tipo: "libre", horario: "—" },              // Domingo
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

  const horarioFichado = info?.fichado ? `${info.horasFichaje?.toFixed(1) ?? "0"}h fichadas` : prov.horario;

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

export function CalendarioPersonal({ refreshKey = 0 }: CalendarioPersonalProps) {
  const { profile } = useAuth();
  const today = new Date();
  const [anio, setAnio] = useState(today.getFullYear());
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [dias, setDias] = useState<DiaCalendario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getMiCalendarioMes(anio, mes).then((res) => {
      if (cancel) return;
      setDias(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [anio, mes, refreshKey]);

  const map = useMemo(() => {
    const m = new Map<string, DiaCalendario>();
    for (const d of dias) m.set(d.fecha, d);
    return m;
  }, [dias]);

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

  function prev() {
    if (mes === 1) {
      setMes(12);
      setAnio(anio - 1);
    } else {
      setMes(mes - 1);
    }
  }
  function next() {
    if (mes === 12) {
      setMes(1);
      setAnio(anio + 1);
    } else {
      setMes(mes + 1);
    }
  }

  const todayKey = ymd(today);

  function handleDownloadPdf() {
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;

    const fechaDesc = today.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    const horaDesc = today.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const nombre = profile?.nombre ?? "";
    const apellidos = profile?.apellidos ?? "";
    // Provisional: DNI aún no está en el perfil. Mostrar placeholder hasta que se añada al schema.
    const dni = "—";

    const cellsHtml = celdas
      .map((c) => {
        if (!c.fecha) return `<div class="cell empty"></div>`;
        const info = map.get(c.fecha);
        const di = getDiaInfo(c.fecha, info, todayKey);
        const s = HEX_STYLES[di.estado];
        return `
          <div class="cell" style="background:${s.bg};border-color:${s.border}">
            <span class="cell-num">${c.dia}</span>
            <span class="badge" style="background:${s.badge}">${di.badgeText}</span>
            <span class="horario" style="color:${s.text}">${di.horario}</span>
          </div>`;
      })
      .join("");

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
    const leyendaHtml = leyendaItems
      .map((l) => `<span class="leg-item"><span class="sw" style="background:${l.color}"></span>${l.text}</span>`)
      .join("");

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
    <div class="download-date">
      Descargado el<br>${fechaDesc}<br>${horaDesc}
    </div>
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
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <h2 className="text-lg font-semibold">Mi calendario</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={prev} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-semibold">
            {MESES[mes - 1]} {anio}
          </span>
          <Button variant="ghost" size="icon" onClick={next} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
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
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Cargando…
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((c, i) => {
            if (!c.fecha) return <div key={i} className="min-h-[78px]" />;
            const info = map.get(c.fecha);
            const isToday = c.fecha === todayKey;
            const di = getDiaInfo(c.fecha, info, todayKey);
            const cls = TW_CLASSES[di.estado];

            return (
              <div
                key={i}
                title={`${c.fecha} · ${di.badgeText} ${di.horario}`}
                className={`relative min-h-[78px] rounded-md p-1.5 flex flex-col items-center justify-center gap-1 transition-colors cursor-default ${cls.bg}`}
              >
                <span
                  className={`absolute top-1 right-1.5 text-[11px] font-bold leading-none ${
                    isToday ? "text-yellow-900" : "text-slate-700"
                  }`}
                >
                  {c.dia}
                </span>
                <span
                  className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${cls.badge}`}
                >
                  {di.badgeText}
                </span>
                <span className={`text-[10px] font-medium leading-none ${cls.horario}`}>
                  {di.horario}
                </span>
                {info?.trabajoExtra === "horas_extras" && (
                  <span className="text-[8px] font-semibold text-amber-700 leading-none">
                    + EXTRAS
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Trabajado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-yellow-500" /> Hoy
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-orange-500" /> Trabajar
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Libre
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" /> Vacaciones
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Baja médica
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Permiso
        </span>
        <span className="ml-auto italic">Horario provisional (mock)</span>
      </div>
    </Card>
  );
}
