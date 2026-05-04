"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Coins,
  Sparkles,
  Sprout,
  Zap,
  Shield,
  Award,
  Crown,
  Star,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MiPanelResumen } from "@/features/mi-panel/actions/mi-panel-actions";

const ICONS: Record<string, LucideIcon> = {
  Sprout,
  Zap,
  Shield,
  Award,
  Crown,
  Trophy,
  Star,
};

interface Props {
  resumen: MiPanelResumen["points"];
  loading?: boolean;
}

export function PointsHeroCard({ resumen, loading = false }: Props) {
  const NivelIcon =
    (resumen.nivelIcon && ICONS[resumen.nivelIcon]) || Trophy;
  const colorBadge = resumen.nivelColor ?? "#9ca3af";

  return (
    <Card className="relative overflow-hidden p-5 md:p-6 bg-gradient-to-br from-amber-50 via-white to-orange-50 border-amber-200 shadow-md">
      {/* Halo decorativo */}
      <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row md:items-center gap-5">
        {/* Badge de nivel */}
        <div
          className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shrink-0 shadow-inner"
          style={{ backgroundColor: colorBadge }}
        >
          <NivelIcon className="h-10 w-10 text-white" />
        </div>

        {/* Núcleo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-amber-700">
              Mi nivel
            </span>
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate-800">
            {loading ? "—" : (resumen.nivelNombre ?? "Aprendiz")}
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
              <span>
                <strong className="text-slate-800 tabular-nums">
                  {resumen.acumulados}
                </strong>{" "}
                points acumulados
              </span>
              {resumen.siguienteNombre ? (
                <span className="text-right">
                  Faltan{" "}
                  <strong className="text-slate-800 tabular-nums">
                    {resumen.faltan}
                  </strong>{" "}
                  para{" "}
                  <strong className="text-slate-800">
                    {resumen.siguienteNombre}
                  </strong>
                </span>
              ) : (
                <span className="text-amber-700 font-medium">
                  ¡Nivel máximo!
                </span>
              )}
            </div>
            <Progress value={resumen.progresoPct} className="h-2" />
          </div>
        </div>

        {/* Saldo + CTA */}
        <div className="flex md:flex-col gap-3 md:gap-2 md:items-end shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-amber-200 shadow-sm">
            <Coins className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
                Saldo
              </div>
              <div className="text-2xl font-bold text-amber-600 leading-tight tabular-nums">
                {resumen.canjeables}
                <span className="text-sm font-medium ml-1 text-amber-500">
                  points
                </span>
              </div>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/25"
          >
            <Link href="/mi-panel/points" className="inline-flex items-center">
              Ver POINTS
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
