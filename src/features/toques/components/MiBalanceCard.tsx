"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, Coins, Sparkles, Sprout, Zap, Shield, Award, Crown, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Balance, NivelProgreso } from "@/features/toques/types/toques.types";

interface Props {
  balance: Balance;
  nivelProgreso: NivelProgreso;
  reservadoPendiente: number;
}

const ICONS: Record<string, LucideIcon> = { Sprout, Zap, Shield, Award, Crown, Trophy, Star };

export function MiBalanceCard({ balance, nivelProgreso, reservadoPendiente }: Props) {
  const { actual, siguiente, toquesParaSiguiente, progresoPct } = nivelProgreso;
  const disponibles = Math.max(0, balance.toquesCanjeables - reservadoPendiente);
  const NivelIcon = (actual?.badgeIcon && ICONS[actual.badgeIcon]) || Trophy;

  return (
    <Card className="p-5 md:p-6 bg-gradient-to-br from-amber-50 via-white to-orange-50 border-amber-200">
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div
          className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center shrink-0 shadow-inner"
          style={{ backgroundColor: actual?.badgeColor ?? "#9ca3af" }}
        >
          <NivelIcon className="h-10 w-10 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Tu nivel</span>
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="text-2xl md:text-3xl font-bold text-slate-800">
            {actual?.nombre ?? "Aprendiz"}
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{balance.toquesAcumulados} points acumulados</span>
              {siguiente ? (
                <span>
                  Faltan <strong className="text-slate-800">{toquesParaSiguiente}</strong> para{" "}
                  <strong className="text-slate-800">{siguiente.nombre}</strong>
                </span>
              ) : (
                <span className="text-amber-700 font-medium">¡Nivel máximo alcanzado!</span>
              )}
            </div>
            <Progress value={progresoPct} className="h-2" />
          </div>
        </div>

        <div className="flex md:flex-col gap-3 md:gap-2 md:items-end shrink-0">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-amber-200 shadow-sm">
            <Coins className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-xs text-muted-foreground leading-none">Saldo</div>
              <div className="text-2xl font-bold text-amber-600 leading-tight">
                {disponibles}
                <span className="text-sm font-medium ml-1 text-amber-500">points</span>
              </div>
            </div>
          </div>
          {reservadoPendiente > 0 && (
            <div className="text-[11px] text-muted-foreground md:text-right">
              {reservadoPendiente} reservados en canjes pendientes
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
