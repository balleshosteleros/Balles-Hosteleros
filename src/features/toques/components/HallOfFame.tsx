"use client";

import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Crown } from "lucide-react";
import type { Ganador } from "@/features/toques/types/toques.types";

interface Props {
  ganadores: Ganador[];
}

const PERIODO_TITULO_MAP: Record<string, string> = {
  mes: "Empleado del Mes",
  trimestre: "Empleado del Trimestre",
  ano: "Empleado del Año",
};

const PERIODO_ACCENT: Record<string, string> = {
  mes: "from-blue-100 to-blue-50 border-blue-200",
  trimestre: "from-purple-100 to-purple-50 border-purple-200",
  ano: "from-amber-100 to-amber-50 border-amber-300",
};

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatPeriodo(g: Ganador): string {
  const ini = new Date(`${g.periodoInicio}T12:00:00Z`);
  if (g.periodo === "mes") {
    return ini.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  }
  if (g.periodo === "trimestre") {
    const q = Math.floor(ini.getUTCMonth() / 3) + 1;
    return `Q${q} ${ini.getUTCFullYear()}`;
  }
  if (g.periodo === "ano") {
    return String(ini.getUTCFullYear());
  }
  return g.periodoInicio;
}

export function HallOfFame({ ganadores }: Props) {
  if (ganadores.length === 0) {
    return null;
  }
  return (
    <Card className="p-4 md:p-5">
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        <Crown className="h-4 w-4 text-amber-500" />
        Hall of Fame
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {ganadores.map((g) => (
          <div
            key={g.id}
            className={`p-3 rounded-lg border bg-gradient-to-br ${
              PERIODO_ACCENT[g.periodo] ?? "from-slate-100 to-slate-50 border-slate-200"
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              {PERIODO_TITULO_MAP[g.periodo] ?? g.periodo}
            </div>
            <div className="flex items-center gap-2.5">
              <Avatar className="h-9 w-9 ring-2 ring-white">
                <AvatarFallback className="bg-amber-200 text-amber-800 text-xs font-semibold">
                  {iniciales(g.empleadoNombre || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{g.empleadoNombre || "—"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{formatPeriodo(g)}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-amber-700 font-bold tabular-nums">{g.totalToques} toques</span>
              {g.bonusOtorgado > 0 && (
                <span className="text-emerald-700 font-medium">+{g.bonusOtorgado} bonus</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
