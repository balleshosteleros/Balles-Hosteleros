"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coffee, Calendar, CalendarDays, Gift, Coins, Crown } from "lucide-react";
import type { Recompensa, RecompensaTipo } from "@/features/toques/types/toques.types";

interface Props {
  recompensas: Recompensa[];
  saldoDisponible: number;
  onCanjear: (recompensa: Recompensa) => void;
  canjeoEnCurso?: boolean;
}

const TIPO_ICON: Record<RecompensaTipo, typeof Coffee> = {
  hora_libre: Coffee,
  dia_vacaciones: Calendar,
  fin_semana: CalendarDays,
  semana_vacaciones: CalendarDays,
  regalo_anual_descriptivo: Crown,
  custom: Gift,
};

const TIPO_LABEL: Record<RecompensaTipo, string> = {
  hora_libre: "Tiempo libre",
  dia_vacaciones: "Vacaciones",
  fin_semana: "Fin de semana",
  semana_vacaciones: "Semana extra",
  regalo_anual_descriptivo: "Premio anual",
  custom: "Otro",
};

export function RecompensasGrid({ recompensas, saldoDisponible, onCanjear, canjeoEnCurso }: Props) {
  return (
    <Card className="p-4 md:p-5">
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        <Gift className="h-4 w-4 text-amber-500" />
        Recompensas disponibles
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {recompensas.map((r) => {
          const Icon = TIPO_ICON[r.tipo] ?? Gift;
          const accesible = r.costeToques > 0 && saldoDisponible >= r.costeToques;
          const isAnual = r.tipo === "regalo_anual_descriptivo";
          return (
            <div
              key={r.id}
              className={`p-4 rounded-lg border bg-white flex flex-col gap-2.5 ${
                isAnual
                  ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50"
                  : accesible
                  ? "border-emerald-300"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isAnual ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {TIPO_LABEL[r.tipo]}
                </Badge>
              </div>
              <div>
                <div className="font-semibold text-sm">{r.nombre}</div>
                <p className="text-xs text-muted-foreground line-clamp-3 mt-0.5">{r.descripcion}</p>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2">
                {!isAnual && (
                  <div className="flex items-center gap-1.5 text-amber-600 font-bold">
                    <Coins className="h-4 w-4" />
                    <span className="tabular-nums">{r.costeToques}</span>
                  </div>
                )}
                {isAnual ? (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
                    Solo Empleado del Año
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant={accesible ? "default" : "outline"}
                    disabled={!accesible || canjeoEnCurso}
                    onClick={() => onCanjear(r)}
                  >
                    {accesible ? "Canjear" : `Faltan ${r.costeToques - saldoDisponible}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
