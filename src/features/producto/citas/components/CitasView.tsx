"use client";

/**
 * Citas (PRP-088) — la agenda de reuniones que entran por los embudos.
 *
 * Mes o año, y al lado el equipo: se elige de quién se están mirando las citas.
 * Todas las horas se pintan en la zona de la EMPRESA, nunca en la del
 * navegador: si no, un comercial de viaje vería las citas movidas.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Users, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfigButton } from "@/shared/components/config-button";
import { claveDiaEnZona, formatHoraEnZona, hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { listarCitas, listarCalendarios, listarEmpleados } from "../actions/citas-actions";
import type { CitaCalendario, CitaConDetalle, EmpleadoDeCalendario } from "../types";
import { CITA_ESTADO_LABEL } from "../types";
import { CalendariosConfigDialog } from "./CalendariosConfigDialog";
import { CitaDetalleDialog } from "./CitaDetalleDialog";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const COLOR_POR_DEFECTO = "#2563eb";

type Modo = "mes" | "ano";

interface Props {
  zonaHoraria: string;
}

/** Día de la semana con el lunes como primer día (0 = lunes). */
function indiceDiaSemana(fecha: Date): number {
  return (fecha.getDay() + 6) % 7;
}

/** Clave "AAAA-MM-DD" sin pasar por Date, para no desplazar el día. */
function clave(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function CitasView({ zonaHoraria }: Props) {
  const hoy = hoyEnZona(zonaHoraria);
  const [ano, setAno] = useState(() => Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(hoy.slice(5, 7)) - 1);
  const [modo, setModo] = useState<Modo>("mes");

  const [citas, setCitas] = useState<CitaConDetalle[]>([]);
  const [calendarios, setCalendarios] = useState<CitaCalendario[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoDeCalendario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [configAbierta, setConfigAbierta] = useState(false);
  const [citaAbierta, setCitaAbierta] = useState<CitaConDetalle | null>(null);

  // Sin marcar = se ven todos. Marcar acota, como en el resto del software.
  const [calendariosOcultos, setCalendariosOcultos] = useState<Set<string>>(new Set());
  const [empleadosOcultos, setEmpleadosOcultos] = useState<Set<string>>(new Set());

  const rango = useMemo(() => {
    if (modo === "ano") {
      return { desde: `${ano}-01-01T00:00:00.000Z`, hasta: `${ano + 1}-01-01T00:00:00.000Z` };
    }
    const siguiente = mes === 11 ? { a: ano + 1, m: 0 } : { a: ano, m: mes + 1 };
    return {
      desde: `${clave(ano, mes, 1)}T00:00:00.000Z`,
      hasta: `${clave(siguiente.a, siguiente.m, 1)}T00:00:00.000Z`,
    };
  }, [modo, ano, mes]);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [resCitas, resCal, resEmp] = await Promise.all([
      listarCitas(rango.desde, rango.hasta),
      listarCalendarios(),
      listarEmpleados(),
    ]);
    if (resCitas.ok) setCitas(resCitas.data);
    else toast.error(resCitas.error);
    if (resCal.ok) setCalendarios(resCal.data);
    if (resEmp.ok) setEmpleados(resEmp.data);
    setCargando(false);
  }, [rango.desde, rango.hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const visibles = useMemo(
    () =>
      citas.filter(
        (c) =>
          !calendariosOcultos.has(c.calendario_id) &&
          !(c.empleado_id && empleadosOcultos.has(c.empleado_id)),
      ),
    [citas, calendariosOcultos, empleadosOcultos],
  );

  /** Citas agrupadas por día, ya en la zona de la empresa. */
  const porDia = useMemo(() => {
    const mapa = new Map<string, CitaConDetalle[]>();
    for (const c of visibles) {
      const dia = claveDiaEnZona(c.inicio, zonaHoraria);
      const lista = mapa.get(dia);
      if (lista) lista.push(c);
      else mapa.set(dia, [c]);
    }
    return mapa;
  }, [visibles, zonaHoraria]);

  const alternar = (conjunto: Set<string>, set: (s: Set<string>) => void, id: string) => {
    const copia = new Set(conjunto);
    if (copia.has(id)) copia.delete(id);
    else copia.add(id);
    set(copia);
  };

  const retroceder = () => {
    if (modo === "ano") return setAno((a) => a - 1);
    if (mes === 0) {
      setMes(11);
      setAno((a) => a - 1);
    } else setMes((m) => m - 1);
  };
  const avanzar = () => {
    if (modo === "ano") return setAno((a) => a + 1);
    if (mes === 11) {
      setMes(0);
      setAno((a) => a + 1);
    } else setMes((m) => m + 1);
  };
  const irHoy = () => {
    setAno(Number(hoy.slice(0, 4)));
    setMes(Number(hoy.slice(5, 7)) - 1);
  };

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold mr-auto">Citas</h1>

        <div className="flex items-center rounded-md border">
          <Button variant="ghost" size="sm" onClick={retroceder} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-sm font-medium tabular-nums min-w-[9rem] text-center">
            {modo === "mes" ? `${MESES[mes]} ${ano}` : ano}
          </span>
          <Button variant="ghost" size="sm" onClick={avanzar} aria-label="Siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={irHoy}>
          Hoy
        </Button>

        <div className="flex items-center rounded-md border p-0.5">
          <Button
            variant={modo === "mes" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setModo("mes")}
          >
            Mes
          </Button>
          <Button
            variant={modo === "ano" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setModo("ano")}
          >
            Año
          </Button>
        </div>

        <ConfigButton onClick={() => setConfigAbierta(true)} title="Configurar calendarios" />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Lateral: de quién y de qué estrategia se están viendo las citas */}
        <aside className="w-full lg:w-60 shrink-0 space-y-4">
          <Card className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Calendarios
            </p>
            {calendarios.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Todavía no hay ninguno. Créalo en el engranaje.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {calendarios.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`cal-${c.id}`}
                      checked={!calendariosOcultos.has(c.id)}
                      onCheckedChange={() =>
                        alternar(calendariosOcultos, setCalendariosOcultos, c.id)
                      }
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: c.color ?? COLOR_POR_DEFECTO }}
                    />
                    <label htmlFor={`cal-${c.id}`} className="truncate text-sm">
                      {c.nombre}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Equipo
            </p>
            {empleados.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin empleados activos.</p>
            ) : (
              <ul className="space-y-1.5">
                {empleados.map((e) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`emp-${e.id}`}
                      checked={!empleadosOcultos.has(e.id)}
                      onCheckedChange={() => alternar(empleadosOcultos, setEmpleadosOcultos, e.id)}
                    />
                    <label htmlFor={`emp-${e.id}`} className="truncate text-sm">
                      {e.nombre}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>

        <div className="min-w-0 flex-1">
          {modo === "mes" ? (
            <VistaMes
              ano={ano}
              mes={mes}
              hoy={hoy}
              porDia={porDia}
              zonaHoraria={zonaHoraria}
              onCita={setCitaAbierta}
              cargando={cargando}
            />
          ) : (
            <VistaAno ano={ano} hoy={hoy} porDia={porDia} onMes={(m) => { setMes(m); setModo("mes"); }} />
          )}
        </div>
      </div>

      <CalendariosConfigDialog
        open={configAbierta}
        onOpenChange={setConfigAbierta}
        onGuardado={cargar}
      />
      <CitaDetalleDialog
        cita={citaAbierta}
        zonaHoraria={zonaHoraria}
        onOpenChange={(abierto) => !abierto && setCitaAbierta(null)}
        onCambiado={cargar}
      />
    </div>
  );
}

function VistaMes({
  ano,
  mes,
  hoy,
  porDia,
  zonaHoraria,
  onCita,
  cargando,
}: {
  ano: number;
  mes: number;
  hoy: string;
  porDia: Map<string, CitaConDetalle[]>;
  zonaHoraria: string;
  onCita: (c: CitaConDetalle) => void;
  cargando: boolean;
}) {
  const primero = new Date(ano, mes, 1);
  const huecosInicio = indiceDiaSemana(primero);
  const diasDelMes = new Date(ano, mes + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array<null>(huecosInicio).fill(null),
    ...Array.from({ length: diasDelMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {DIAS.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map((dia, i) => {
          const k = dia ? clave(ano, mes, dia) : null;
          const delDia = k ? porDia.get(k) ?? [] : [];
          return (
            <div
              key={i}
              className={`min-h-[104px] border-b border-r p-1.5 ${dia ? "" : "bg-muted/20"} ${
                k === hoy ? "bg-primary/5" : ""
              }`}
            >
              {dia && (
                <>
                  <span
                    className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ${
                      k === hoy ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {dia}
                  </span>
                  <div className="space-y-1">
                    {delDia.slice(0, 3).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onCita(c)}
                        className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] leading-tight text-white hover:opacity-90"
                        style={{ background: c.calendario_color ?? COLOR_POR_DEFECTO }}
                        title={`${c.cliente_nombre ?? "Sin nombre"} · ${c.calendario_nombre ?? ""}`}
                      >
                        {formatHoraEnZona(c.inicio, zonaHoraria)} {c.cliente_nombre ?? "Sin nombre"}
                      </button>
                    ))}
                    {delDia.length > 3 && (
                      <span className="px-1 text-[11px] text-muted-foreground">
                        +{delDia.length - 3} más
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {cargando && (
        <p className="p-3 text-center text-xs text-muted-foreground">Cargando citas…</p>
      )}
    </Card>
  );
}

function VistaAno({
  ano,
  hoy,
  porDia,
  onMes,
}: {
  ano: number;
  hoy: string;
  porDia: Map<string, CitaConDetalle[]>;
  onMes: (mes: number) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {MESES.map((nombre, mes) => {
        const dias = new Date(ano, mes + 1, 0).getDate();
        const primero = indiceDiaSemana(new Date(ano, mes, 1));
        const celdas: (number | null)[] = [
          ...Array<null>(primero).fill(null),
          ...Array.from({ length: dias }, (_, i) => i + 1),
        ];
        const total = Array.from({ length: dias }, (_, i) =>
          (porDia.get(clave(ano, mes, i + 1)) ?? []).length,
        ).reduce((a, b) => a + b, 0);

        return (
          <Card key={mes} className="p-3">
            <button
              type="button"
              onClick={() => onMes(mes)}
              className="mb-2 flex w-full items-center justify-between hover:underline"
            >
              <span className="text-sm font-semibold">{nombre}</span>
              {total > 0 && (
                <Badge variant="secondary" className="font-normal">
                  {total}
                </Badge>
              )}
            </button>
            <div className="grid grid-cols-7 gap-0.5">
              {DIAS.map((d) => (
                <span key={d} className="text-center text-[10px] text-muted-foreground">
                  {d}
                </span>
              ))}
              {celdas.map((dia, i) => {
                const k = dia ? clave(ano, mes, dia) : null;
                const n = k ? (porDia.get(k) ?? []).length : 0;
                return (
                  <span
                    key={i}
                    className={`flex h-6 items-center justify-center rounded text-[11px] tabular-nums ${
                      k === hoy ? "ring-1 ring-primary" : ""
                    } ${n > 0 ? "bg-primary/15 font-semibold" : "text-muted-foreground"}`}
                    title={n > 0 ? `${n} cita${n > 1 ? "s" : ""}` : undefined}
                  >
                    {dia ?? ""}
                  </span>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export { CITA_ESTADO_LABEL };
