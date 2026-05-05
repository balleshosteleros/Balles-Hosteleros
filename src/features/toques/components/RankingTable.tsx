"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Medal, Inbox, Loader2, Sprout, Zap, Shield, Award, Trophy, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RankingRow } from "@/features/toques/types/toques.types";

const NIVEL_ICONS: Record<string, LucideIcon> = { Sprout, Zap, Shield, Award, Crown, Trophy, Star };

interface Props {
  rows: RankingRow[];
  loading: boolean;
  highlightUserId?: string;
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function PosicionBadge({ pos }: { pos: number }) {
  if (pos === 1) {
    return (
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-md">
        <Crown className="h-5 w-5" />
      </div>
    );
  }
  if (pos === 2) {
    return (
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-white flex items-center justify-center shadow">
        <Medal className="h-4 w-4" />
      </div>
    );
  }
  if (pos === 3) {
    return (
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center shadow">
        <Medal className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-sm">
      {pos}
    </div>
  );
}

export function RankingTable({ rows, loading, highlightUserId }: Props) {
  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card className="p-6 flex flex-col items-center justify-center text-muted-foreground text-sm">
        <Inbox className="h-6 w-6 mb-1.5" />
        Aún no hay points registrados en este periodo.
      </Card>
    );
  }
  const top10 = rows.slice(0, 10);
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y">
        {top10.map((row) => {
          const isMe = highlightUserId && row.userId === highlightUserId;
          return (
            <li
              key={row.userId}
              className={`flex items-center gap-3 px-4 py-3 ${
                isMe ? "bg-amber-50" : "hover:bg-slate-50"
              }`}
            >
              <PosicionBadge pos={row.posicion} />
              <Avatar className="h-9 w-9 shrink-0">
                {row.avatarUrl ? <AvatarImage src={row.avatarUrl} /> : null}
                <AvatarFallback className="bg-slate-200 text-slate-600 text-xs font-semibold">
                  {iniciales(row.empleadoNombre || "?")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate text-sm">
                    {row.empleadoNombre || "—"}
                  </span>
                  {isMe && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      tú
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {row.departamento ? <span>{row.departamento}</span> : null}
                  {row.nivel ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1.5 gap-0.5"
                      style={{ borderColor: row.nivel.badgeColor, color: row.nivel.badgeColor }}
                    >
                      {(() => {
                        const Icon =
                          (row.nivel.badgeIcon && NIVEL_ICONS[row.nivel.badgeIcon]) || Trophy;
                        return <Icon className="h-2.5 w-2.5" />;
                      })()}
                      {row.nivel.nombre}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold text-amber-600 tabular-nums leading-tight">
                  {row.total}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  points
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
