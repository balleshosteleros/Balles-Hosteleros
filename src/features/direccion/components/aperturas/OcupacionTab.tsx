"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Flame } from "lucide-react";
import {
  DIAS_SEMANA,
  FRANJAS_HORARIAS,
  bloqueOcupacionInicial,
  matrizOcupacionVacia,
  ocupacionMedia,
  type BloqueOcupacion,
  type DiaSemana,
  type EscenarioOcupacion,
  type FranjaHoraria,
  type MatrizOcupacion,
} from "@/features/direccion/data/aperturas";

interface Props {
  ocupacion: BloqueOcupacion;
  plazasTotales: number;
  onChange: (next: BloqueOcupacion, opts?: { flush?: boolean }) => void;
}

function clamp01_100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

export function OcupacionTab({ ocupacion, plazasTotales, onChange }: Props) {
  const bloque = ocupacion.escenarios.length > 0 ? ocupacion : bloqueOcupacionInicial();

  const [activoId, setActivoId] = useState<string>(
    bloque.escenarioActivoId && bloque.escenarios.some((e) => e.id === bloque.escenarioActivoId)
      ? bloque.escenarioActivoId
      : bloque.escenarios[0].id,
  );

  const activo = bloque.escenarios.find((e) => e.id === activoId) ?? bloque.escenarios[0];

  const setEscenarios = (next: EscenarioOcupacion[], opts?: { flush?: boolean }, nextActivoId?: string) =>
    onChange(
      {
        escenarios: next,
        escenarioActivoId: nextActivoId ?? activoId,
      },
      opts,
    );

  const updateActivo = (patch: Partial<EscenarioOcupacion>, opts?: { flush?: boolean }) => {
    setEscenarios(
      bloque.escenarios.map((e) => (e.id === activo.id ? { ...e, ...patch } : e)),
      opts,
    );
  };

  const updateCelda = (dia: DiaSemana, franja: FranjaHoraria, raw: number) => {
    const matriz: MatrizOcupacion = {
      ...activo.matriz,
      [dia]: { ...activo.matriz[dia], [franja]: clamp01_100(raw) },
    } as MatrizOcupacion;
    updateActivo({ matriz });
  };

  const seleccionarEscenario = (id: string) => {
    setActivoId(id);
    onChange({ ...bloque, escenarioActivoId: id }, { flush: true });
  };

  const aplicarPreset = (preset: "vacio" | "tipico" | "lleno") => {
    let valor: (dia: DiaSemana, f: FranjaHoraria) => number;
    if (preset === "vacio") {
      valor = () => 0;
    } else if (preset === "lleno") {
      valor = () => 100;
    } else {
      // Patrón típico hostelería: comida y cena medios-altos, desayuno bajo,
      // findes con cena más alta. Es solo un punto de partida orientativo.
      const base: Record<FranjaHoraria, number> = { desayuno: 25, comida: 70, cena: 65 };
      valor = (dia, f) => {
        let v = base[f];
        if (dia === "viernes" || dia === "sabado") v += f === "cena" ? 20 : 5;
        if (dia === "domingo") v = f === "comida" ? v + 10 : f === "cena" ? v - 10 : v;
        if (dia === "lunes") v -= 10;
        return clamp01_100(v);
      };
    }
    const matriz = matrizOcupacionVacia();
    for (const d of DIAS_SEMANA.map((x) => x.key)) {
      for (const f of FRANJAS_HORARIAS.map((x) => x.key)) {
        matriz[d][f] = valor(d, f);
      }
    }
    updateActivo({ matriz }, { flush: true });
  };

  // KPIs
  const media = useMemo(() => ocupacionMedia(activo.matriz), [activo.matriz]);
  const personasSemana = useMemo(() => {
    if (plazasTotales <= 0) return 0;
    let total = 0;
    for (const d of DIAS_SEMANA.map((x) => x.key)) {
      for (const f of FRANJAS_HORARIAS.map((x) => x.key)) {
        total += plazasTotales * (activo.matriz[d][f] / 100);
      }
    }
    return total;
  }, [activo.matriz, plazasTotales]);
  const personasDia = personasSemana / 7;

  return (
    <div className="space-y-4">
      {/* Selector + edición de escenario activo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escenarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {bloque.escenarios.map((e) => {
              const isActivo = e.id === activoId;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => seleccionarEscenario(e.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 h-8 text-sm transition-colors ${
                    isActivo
                      ? "border-foreground/40 bg-foreground/5 font-medium"
                      : "border-muted-foreground/20 hover:bg-muted/40"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full inline-block"
                    style={{ backgroundColor: e.color }}
                  />
                  <span>{e.nombre}</span>
                </button>
              );
            })}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => aplicarPreset("vacio")}>Vaciar</Button>
              <Button size="sm" variant="outline" onClick={() => aplicarPreset("tipico")}>Plantilla típica</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs del escenario activo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{media.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Ocupación media</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{fmtNum(plazasTotales)}</p>
            <p className="text-xs text-muted-foreground">Comensales totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{fmtNum(personasDia)}</p>
            <p className="text-xs text-muted-foreground">Personas / día (media)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold flex items-center justify-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              {fmtNum(personasSemana)}
            </p>
            <p className="text-xs text-muted-foreground">Personas / semana</p>
          </CardContent>
        </Card>
      </div>

      {plazasTotales <= 0 && (
        <p className="text-xs text-muted-foreground italic">
          * Para calcular personas esperadas, define los comensales (interior + terraza) en la pestaña <strong>Local</strong>.
        </p>
      )}

      {/* Editor matriz */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matriz día × franja — {activo.nombre || "Escenario"}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Introduce el % de ocupación esperado en cada celda (0–100).
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left p-2 font-medium w-32"></th>
                  {FRANJAS_HORARIAS.map((f) => (
                    <th key={f.key} className="text-center p-2 font-medium">
                      <div>{f.label}</div>
                      <div className="text-xs text-muted-foreground font-normal">{f.horario}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIAS_SEMANA.map((d) => (
                  <tr key={d.key}>
                    <td className="p-2 font-medium text-muted-foreground">{d.label}</td>
                    {FRANJAS_HORARIAS.map((f) => {
                      const v = activo.matriz[d.key][f.key];
                      return (
                        <td key={f.key} className="p-1">
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={5}
                              value={v || ""}
                              onChange={(e) => updateCelda(d.key, f.key, Number(e.target.value))}
                              className="h-9 text-sm pr-7 text-right"
                              placeholder="0"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="h-4 w-4" style={{ color: activo.color }} />
            Mapa de calor — {activo.nombre || "Escenario"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Visualiza la intensidad de la ocupación de un vistazo. Más oscuro = más ocupación.
          </p>
        </CardHeader>
        <CardContent>
          <Heatmap matriz={activo.matriz} color={activo.color} plazas={plazasTotales} />
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Heatmap CSS-only (sin libs externas) ─────────────────────────── */
function Heatmap({
  matriz,
  color,
  plazas,
}: {
  matriz: MatrizOcupacion;
  color: string;
  plazas: number;
}) {
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          <div className="grid" style={{ gridTemplateColumns: "auto repeat(3, minmax(0,1fr))" }}>
            {/* Header franjas */}
            <div />
            {FRANJAS_HORARIAS.map((f) => (
              <div key={f.key} className="px-2 pb-2 text-center">
                <div className="text-xs font-medium">{f.label}</div>
                <div className="text-[10px] text-muted-foreground">{f.horario}</div>
              </div>
            ))}

            {/* Filas día × celdas */}
            {DIAS_SEMANA.map((d) => (
              <FilaHeatmap key={d.key} dia={d} matriz={matriz} color={color} plazas={plazas} />
            ))}
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span>0%</span>
        <div
          className="h-2 flex-1 rounded"
          style={{
            background: `linear-gradient(to right, color-mix(in srgb, ${color} 0%, white), color-mix(in srgb, ${color} 100%, white))`,
          }}
        />
        <span>100%</span>
      </div>
    </div>
  );
}

function FilaHeatmap({
  dia,
  matriz,
  color,
  plazas,
}: {
  dia: { key: DiaSemana; label: string; corto: string };
  matriz: MatrizOcupacion;
  color: string;
  plazas: number;
}) {
  return (
    <>
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center">
        {dia.label}
      </div>
      {FRANJAS_HORARIAS.map((f) => {
        const pct = matriz[dia.key][f.key] || 0;
        const personas = plazas > 0 ? Math.round(plazas * (pct / 100)) : 0;
        const fg = pct >= 55 ? "text-white" : "text-foreground";
        return (
          <div key={f.key} className="p-1">
            <div
              className={`h-14 rounded-md flex flex-col items-center justify-center text-xs font-medium border border-black/5 transition-colors ${fg}`}
              style={{
                background: `color-mix(in srgb, ${color} ${pct}%, white)`,
              }}
              title={`${dia.label} · ${f.label}: ${pct}%${plazas > 0 ? ` (~${personas} pers.)` : ""}`}
            >
              <span>{pct}%</span>
              {plazas > 0 && (
                <span className={`text-[10px] font-normal ${fg === "text-white" ? "opacity-90" : "text-muted-foreground"}`}>
                  ~{personas} pers.
                </span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

