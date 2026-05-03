"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Sprout, Zap, Shield, Award, Crown, Trophy, Star, Lock, Check, Gift, PartyPopper } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Nivel } from "@/features/toques/types/toques.types";

interface Props {
  niveles: Nivel[];
  toquesAcumulados: number;
}

const ICONS: Record<string, LucideIcon> = {
  Sprout,
  Zap,
  Shield,
  Award,
  Crown,
  Trophy,
  Star,
};

// Niveles que reciben trofeo en la cena de Navidad
const NIVELES_CON_TROFEO = new Set(["Veterano", "Mentor", "Leyenda"]);

function resolveIcon(name: string | null): LucideIcon {
  if (!name) return Trophy;
  return ICONS[name] ?? Trophy;
}

export function NivelesRoadmap({ niveles, toquesAcumulados }: Props) {
  const ordenados = [...niveles].sort((a, b) => a.orden - b.orden);
  const [seleccionado, setSeleccionado] = useState<Nivel | null>(null);
  if (ordenados.length === 0) return null;

  // Determinar nivel actual
  let actualOrden = ordenados[0].orden;
  for (const nv of ordenados) {
    if (toquesAcumulados >= nv.toquesMin) actualOrden = nv.orden;
  }

  return (
    <Card className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Camino de niveles
        </h2>
        <div className="text-xs text-muted-foreground">
          Tienes <strong className="text-amber-600 tabular-nums">{toquesAcumulados}</strong> points
          acumulados
        </div>
      </div>

      {/* Vista horizontal (desktop) */}
      <div className="hidden md:block">
        <div className="relative">
          {/* línea base */}
          <div className="absolute top-8 left-0 right-0 h-1 bg-slate-200 rounded-full" />
          {/* línea de progreso */}
          {(() => {
            const actualIdx = ordenados.findIndex((n) => n.orden === actualOrden);
            // Calcular porcentaje hasta el siguiente nivel
            let pct = 0;
            if (actualIdx >= ordenados.length - 1) {
              pct = 100;
            } else {
              const actual = ordenados[actualIdx];
              const siguiente = ordenados[actualIdx + 1];
              const rango = siguiente.toquesMin - actual.toquesMin;
              const ganados = toquesAcumulados - actual.toquesMin;
              const partial = rango > 0 ? Math.min(1, Math.max(0, ganados / rango)) : 1;
              const baseSteps = ordenados.length - 1;
              pct = ((actualIdx + partial) / baseSteps) * 100;
            }
            return (
              <div
                className="absolute top-8 left-0 h-1 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-purple-500 transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            );
          })()}

          <div className="relative grid" style={{ gridTemplateColumns: `repeat(${ordenados.length}, 1fr)` }}>
            {ordenados.map((nv) => {
              const Icon = resolveIcon(nv.badgeIcon);
              const desbloqueado = toquesAcumulados >= nv.toquesMin;
              const esActual = nv.orden === actualOrden;
              const faltan = Math.max(0, nv.toquesMin - toquesAcumulados);
              const tieneTrofeo = NIVELES_CON_TROFEO.has(nv.nombre);
              return (
                <div key={nv.id} className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setSeleccionado(nv)}
                    className={`w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-all relative z-10 cursor-pointer hover:scale-105 ${
                      esActual ? "ring-4 ring-amber-300 scale-110 hover:scale-110" : "scale-100"
                    }`}
                    style={{
                      backgroundColor: desbloqueado ? nv.badgeColor : "#94a3b8",
                      filter: desbloqueado ? undefined : "grayscale(0.4)",
                    }}
                    aria-label={`Ver detalles del nivel ${nv.nombre}`}
                  >
                    <Icon
                      className={`h-7 w-7 ${desbloqueado ? "text-white" : "text-white/70"}`}
                    />
                    {desbloqueado && !esActual && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      </div>
                    )}
                    {!desbloqueado && (
                      <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-slate-600 border-2 border-white flex items-center justify-center shadow">
                        <Lock className="h-3 w-3 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                    {tieneTrofeo && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center shadow-sm">
                        <Trophy className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                  </button>
                  <div className="mt-3 text-center">
                    <div
                      className={`text-sm font-semibold ${
                        esActual ? "text-amber-700" : desbloqueado ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {nv.nombre}
                    </div>
                    <div
                      className={`text-xs tabular-nums ${
                        desbloqueado ? "text-muted-foreground" : "text-slate-400"
                      }`}
                    >
                      {nv.toquesMin === 0 ? "Inicio" : `${nv.toquesMin} points`}
                    </div>
                    {!desbloqueado && faltan > 0 && (
                      <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                        Faltan {faltan}
                      </div>
                    )}
                    {esActual && (
                      <div className="text-[10px] text-amber-600 font-bold mt-0.5 uppercase tracking-wider">
                        Estás aquí
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Vista vertical (móvil) */}
      <div className="md:hidden space-y-3">
        {ordenados.map((nv, idx) => {
          const Icon = resolveIcon(nv.badgeIcon);
          const desbloqueado = toquesAcumulados >= nv.toquesMin;
          const esActual = nv.orden === actualOrden;
          const faltan = Math.max(0, nv.toquesMin - toquesAcumulados);
          const isLast = idx === ordenados.length - 1;
          const tieneTrofeo = NIVELES_CON_TROFEO.has(nv.nombre);
          return (
            <div key={nv.id} className="relative flex gap-3">
              {/* línea vertical */}
              {!isLast && (
                <div
                  className={`absolute left-7 top-14 bottom-[-12px] w-0.5 ${
                    desbloqueado ? "bg-emerald-400" : "bg-slate-200"
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => setSeleccionado(nv)}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow shrink-0 z-10 cursor-pointer hover:scale-105 transition-transform relative ${
                  esActual ? "ring-4 ring-amber-300" : ""
                }`}
                style={{
                  backgroundColor: desbloqueado ? nv.badgeColor : "#94a3b8",
                  filter: desbloqueado ? undefined : "grayscale(0.4)",
                }}
                aria-label={`Ver detalles del nivel ${nv.nombre}`}
              >
                <Icon className={`h-6 w-6 ${desbloqueado ? "text-white" : "text-white/70"}`} />
                {!desbloqueado && (
                  <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-slate-600 border-2 border-white flex items-center justify-center shadow">
                    <Lock className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
                  </div>
                )}
                {tieneTrofeo && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center">
                    <Trophy className="h-3 w-3 text-white" strokeWidth={2.5} />
                  </div>
                )}
              </button>
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold ${
                      esActual ? "text-amber-700" : desbloqueado ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {nv.nombre}
                  </span>
                  {esActual && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-1.5 rounded">
                      Aquí
                    </span>
                  )}
                  {desbloqueado && !esActual && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                  {tieneTrofeo && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {nv.toquesMin === 0 ? "Punto de partida" : `${nv.toquesMin} points`}
                </div>
                {!desbloqueado && faltan > 0 && (
                  <div className="text-[11px] text-amber-600 font-medium">Faltan {faltan} points</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!seleccionado} onOpenChange={(o) => !o && setSeleccionado(null)}>
        <DialogContent>
          {seleccionado && (() => {
            const Icon = resolveIcon(seleccionado.badgeIcon);
            const desbloqueado = toquesAcumulados >= seleccionado.toquesMin;
            const faltan = Math.max(0, seleccionado.toquesMin - toquesAcumulados);
            const tieneTrofeo = NIVELES_CON_TROFEO.has(seleccionado.nombre);
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-md"
                      style={{ backgroundColor: seleccionado.badgeColor }}
                    >
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-xl">{seleccionado.nombre}</DialogTitle>
                      <DialogDescription className="text-xs mt-0.5">
                        Nivel {seleccionado.orden} de {ordenados.length}
                      </DialogDescription>
                    </div>
                    {desbloqueado ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                        Desbloqueado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500">
                        <Lock className="h-3 w-3 mr-1" />
                        Bloqueado
                      </Badge>
                    )}
                  </div>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border bg-slate-50">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Points requeridos
                      </div>
                      <div className="text-lg font-bold tabular-nums">
                        {seleccionado.toquesMin === 0 ? "Inicio" : seleccionado.toquesMin}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border bg-slate-50">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {desbloqueado ? "Tu progreso" : "Te faltan"}
                      </div>
                      <div
                        className={`text-lg font-bold tabular-nums ${
                          desbloqueado ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {desbloqueado ? toquesAcumulados : faltan}
                      </div>
                    </div>
                  </div>

                  {tieneTrofeo && (
                    <div className="p-4 rounded-lg border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-200 flex items-center justify-center shrink-0">
                          <Trophy className="h-5 w-5 text-amber-700" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <PartyPopper className="h-4 w-4 text-amber-600" />
                            <span className="font-bold text-amber-800 text-sm">
                              Premio especial
                            </span>
                          </div>
                          <p className="text-sm text-amber-900">
                            Al alcanzar <strong>{seleccionado.nombre}</strong> recibes un
                            <strong> trofeo físico</strong> que se entrega en la
                            <strong> Cena de Navidad</strong> de la empresa.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!tieneTrofeo && seleccionado.nombre !== "Aprendiz" && (
                    <div className="p-3 rounded-lg border bg-slate-50 text-xs text-muted-foreground flex items-start gap-2">
                      <Gift className="h-4 w-4 shrink-0 mt-0.5" />
                      Sigue sumando points: el siguiente nivel desbloquea el trofeo de la cena de Navidad.
                    </div>
                  )}

                  {seleccionado.nombre === "Aprendiz" && (
                    <div className="p-3 rounded-lg border bg-slate-50 text-xs text-muted-foreground">
                      Punto de partida de todos los empleados. Empieza a sumar points siendo puntual,
                      cumpliendo tus tareas y fichando correctamente.
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
