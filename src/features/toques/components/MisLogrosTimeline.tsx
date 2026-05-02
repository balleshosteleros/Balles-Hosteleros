"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Award, Hand, ShoppingBag, Wrench, Inbox } from "lucide-react";
import type { Movimiento } from "@/features/toques/types/toques.types";
import { ORIGEN_LABEL } from "@/features/toques/types/toques.types";

interface Props {
  items: Movimiento[];
}

const ORIGEN_ICON = {
  regla: Award,
  bonus_periodo: Trophy,
  manual: Hand,
  canje: ShoppingBag,
  ajuste: Wrench,
} as const;

function formatFecha(s: string): string {
  if (!s) return "—";
  try {
    const d = new Date(s.includes("T") ? s : `${s}T12:00:00Z`);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  } catch {
    return s;
  }
}

export function MisLogrosTimeline({ items }: Props) {
  return (
    <Card className="p-4 md:p-5">
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        Mis logros recientes
      </h2>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
          <Inbox className="h-6 w-6 mb-1.5" />
          Aún no has ganado toques. Cumple tus tareas y ficha a tiempo para empezar a sumar.
        </div>
      ) : (
        <ol className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {items.map((m) => {
            const Icon = ORIGEN_ICON[m.origen] ?? Award;
            const positivo = m.toques > 0;
            return (
              <li key={m.id} className="flex items-start gap-3 text-sm">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    positivo ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold tabular-nums ${
                        positivo ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {positivo ? `+${m.toques}` : m.toques}
                    </span>
                    <span className="truncate">{m.motivo || ORIGEN_LABEL[m.origen]}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {ORIGEN_LABEL[m.origen]}
                    </Badge>
                    <span>{formatFecha(m.fecha || m.createdAt)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
