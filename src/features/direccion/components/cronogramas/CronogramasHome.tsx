"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Briefcase, Utensils, ClipboardCheck, Users, Megaphone, Truck,
  Calculator, FileText, Scale, Shield, ChevronRight, Plus, Video, BarChart3,
} from "lucide-react";
import type { CronogramaOperativo } from "../../hooks/useCronogramasOperativos";
import { cn } from "@/lib/utils";

interface Props {
  data: CronogramaOperativo[];
  onSelect: (rol: string) => void;
  onCrearCronograma: () => void;
  onIrProductividad: () => void;
  isLoading: boolean;
}

// Mapeo visual de departamentos
const DEPTO_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  DIRECCION:   { icon: Briefcase,     color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  DIRECCIÓN:   { icon: Briefcase,     color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  COCINA:      { icon: Utensils,      color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  SALA:        { icon: Users,         color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  CALIDAD:     { icon: ClipboardCheck,color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  RRHH:        { icon: Users,         color: "text-pink-600",   bg: "bg-pink-50 border-pink-200" },
  "RECURSOS HUMANOS": { icon: Users,  color: "text-pink-600",   bg: "bg-pink-50 border-pink-200" },
  MARKETING:   { icon: Megaphone,     color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  LOGISTICA:   { icon: Truck,         color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  LOGÍSTICA:   { icon: Truck,         color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  CONTABILIDAD:{ icon: Calculator,    color: "text-teal-600",   bg: "bg-teal-50 border-teal-200" },
  GESTORIA:    { icon: FileText,      color: "text-slate-600",  bg: "bg-slate-50 border-slate-200" },
  GESTORÍA:    { icon: FileText,      color: "text-slate-600",  bg: "bg-slate-50 border-slate-200" },
  JURIDICO:    { icon: Scale,         color: "text-zinc-700",   bg: "bg-zinc-50 border-zinc-200" },
  JURÍDICO:    { icon: Scale,         color: "text-zinc-700",   bg: "bg-zinc-50 border-zinc-200" },
  GERENCIA:    { icon: Shield,        color: "text-rose-600",   bg: "bg-rose-50 border-rose-200" },
};

function getDeptoConfig(rol: string) {
  const key = rol.toUpperCase().trim();
  return DEPTO_CONFIG[key] ?? {
    icon: Briefcase,
    color: "text-muted-foreground",
    bg: "bg-muted/40 border-border",
  };
}

const FREQ_COLORS: Record<string, string> = {
  DIARIO:          "bg-red-500",
  SEMANAL:         "bg-blue-500",
  MENSUAL:         "bg-emerald-500",
  TRIMESTRAL:      "bg-purple-500",
  ANUAL:           "bg-amber-500",
  "POR NECESIDAD": "bg-slate-400",
  OTRO:            "bg-muted",
};

function FrecuenciaBar({
  counts, total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  if (total === 0) return <div className="h-1.5 bg-muted rounded-full" />;
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-muted">
      {Object.entries(counts).map(([freq, n]) => {
        if (n === 0) return null;
        const pct = (n / total) * 100;
        return (
          <div
            key={freq}
            className={cn("h-full", FREQ_COLORS[freq] ?? "bg-muted")}
            style={{ width: `${pct}%` }}
            title={`${freq}: ${n}`}
          />
        );
      })}
    </div>
  );
}

export function CronogramasHome({ data, onSelect, onCrearCronograma, onIrProductividad, isLoading }: Props) {
  const grupos = useMemo(() => {
    const byRol = new Map<string, CronogramaOperativo[]>();
    for (const t of data) {
      if (!t.rol) continue;
      const arr = byRol.get(t.rol) ?? [];
      arr.push(t);
      byRol.set(t.rol, arr);
    }
    return Array.from(byRol.entries())
      .map(([rol, tareas]) => {
        const mains = tareas.filter((t) => !t.parent_id);
        const counts: Record<string, number> = {
          DIARIO: 0, SEMANAL: 0, MENSUAL: 0, TRIMESTRAL: 0, ANUAL: 0, "POR NECESIDAD": 0, OTRO: 0,
        };
        for (const t of mains) {
          const f = (t.frecuencia ?? "OTRO") as string;
          counts[f] = (counts[f] ?? 0) + 1;
        }
        const conVideo = tareas.filter((t) => t.video_url).length;
        return {
          rol,
          total: mains.length,
          totalConSubs: tareas.length,
          counts,
          pctVideo: tareas.length > 0 ? Math.round((conVideo / tareas.length) * 100) : 0,
        };
      })
      .sort((a, b) => a.rol.localeCompare(b.rol));
  }, [data]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Cronogramas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organiza las tareas operativas de cada departamento por día.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="lg" onClick={onIrProductividad}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Productividad
          </Button>
          <Button variant="primary" size="lg" onClick={onCrearCronograma}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo cronograma
          </Button>
        </div>
      </div>

      {/* Grid de cards */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-20">Cargando cronogramas…</div>
        ) : grupos.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">
            <p className="mb-3">Aún no has creado ningún cronograma.</p>
            <Button variant="primary" size="lg" onClick={onCrearCronograma}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primero
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {grupos.map(({ rol, total, totalConSubs, counts, pctVideo }) => {
              const { icon: Icon, color, bg } = getDeptoConfig(rol);
              return (
                <Card
                  key={rol}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(rol)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(rol);
                    }
                  }}
                  className={cn(
                    "p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 group border",
                    bg
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("p-2.5 rounded-lg bg-background/70", color)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  </div>

                  <h3 className="font-bold text-base uppercase tracking-wide mb-1">{rol}</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {total} {total === 1 ? "tarea principal" : "tareas principales"}
                    {totalConSubs > total && ` · ${totalConSubs - total} subtareas`}
                  </p>

                  <FrecuenciaBar counts={counts} total={total} />

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(counts)
                      .filter(([, n]) => n > 0)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([freq, n]) => (
                        <Badge
                          key={freq}
                          variant="outline"
                          className="text-[10px] font-mono px-1.5 py-0 gap-1"
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full", FREQ_COLORS[freq])} />
                          {freq.slice(0, 4)} {n}
                        </Badge>
                      ))}
                  </div>

                  {pctVideo > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
                      <Video className="h-3 w-3" />
                      {pctVideo}% con vídeo formativo
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
