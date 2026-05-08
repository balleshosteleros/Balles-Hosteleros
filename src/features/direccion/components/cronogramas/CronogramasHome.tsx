"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Briefcase, Crown, User, Camera, Package, CheckCircle2,
  Calculator, FileText, Scale, ChevronRight, Plus, Video, BarChart3,
  ChefHat, UtensilsCrossed,
  CheckSquare2,
} from "lucide-react";
import type { CronogramaOperativo } from "../../hooks/useCronogramasOperativos";
import {
  CRONOGRAMA_ROLES,
  AREA_LABEL,
  AREA_BADGE_CLASS,
  getAreaForRol,
  type AreaCronograma,
} from "../../data/cronogramaAreas";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

interface Props {
  data: CronogramaOperativo[];
  onSelect: (rol: string) => void;
  onCrearCronograma: () => void;
  onIrProductividad: () => void;
  isLoading: boolean;
  /**
   * Filtra qué cards se muestran. Recibe el rol y devuelve true si el usuario
   * actual tiene acceso al módulo asociado (según `permisos` de su rol en
   * empresa_roles). Si no se pasa, no filtra (acceso total). Las áreas/badges
   * que queden sin cards visibles desaparecen automáticamente.
   */
  isRolAccesible?: (rol: string) => boolean;
}

// Mapeo visual de departamentos — iconos alineados con el sidebar.
// Cada rol hereda el icono del módulo padre (ver CRONOGRAMA_TO_MODULO).
const DEPTO_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  // Administrativa — coinciden con sidebar
  DIRECCION:          { icon: Crown,           color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  DIRECCIÓN:          { icon: Crown,           color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  GERENCIA:           { icon: Briefcase,       color: "text-rose-600",   bg: "bg-rose-50 border-rose-200" },
  GERENTE:            { icon: Briefcase,       color: "text-rose-600",   bg: "bg-rose-50 border-rose-200" },
  RRHH:               { icon: User,            color: "text-pink-600",   bg: "bg-pink-50 border-pink-200" },
  "RECURSOS HUMANOS": { icon: User,            color: "text-pink-600",   bg: "bg-pink-50 border-pink-200" },
  CALIDAD:            { icon: CheckCircle2,    color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  CONTABILIDAD:       { icon: Calculator,      color: "text-teal-600",   bg: "bg-teal-50 border-teal-200" },
  LOGISTICA:          { icon: Package,         color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  LOGÍSTICA:          { icon: Package,         color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
  MARKETING:          { icon: Camera,          color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  GESTORIA:           { icon: FileText,        color: "text-sky-600",    bg: "bg-sky-50 border-sky-200" },
  GESTORÍA:           { icon: FileText,        color: "text-sky-600",    bg: "bg-sky-50 border-sky-200" },
  JURIDICO:           { icon: Scale,           color: "text-fuchsia-600", bg: "bg-fuchsia-50 border-fuchsia-200" },
  JURÍDICO:           { icon: Scale,           color: "text-fuchsia-600", bg: "bg-fuchsia-50 border-fuchsia-200" },

  // Operativa — heredan icono del módulo padre (SALA / COCINA en sidebar)
  SALA:               { icon: UtensilsCrossed, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  "JEFE DE SALA":     { icon: UtensilsCrossed, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  CAMARERO:           { icon: UtensilsCrossed, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  SEGURIDAD:          { icon: UtensilsCrossed, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  ARTISTA:            { icon: UtensilsCrossed, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  COCINA:             { icon: ChefHat,         color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  "JEFE DE COCINA":   { icon: ChefHat,         color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  COCINERO:           { icon: ChefHat,         color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  OFFICE:             { icon: ChefHat,         color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  LIMPIEZA:           { icon: ChefHat,         color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
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

type FiltroArea = "TODAS" | AreaCronograma;

export function CronogramasHome({ data, onSelect, onCrearCronograma, onIrProductividad, isLoading, isRolAccesible }: Props) {
  const [filtroArea, setFiltroArea] = useState<FiltroArea>("TODAS");

  const grupos = useMemo(() => {
    const byRol = new Map<string, CronogramaOperativo[]>();
    for (const t of data) {
      if (!t.rol) continue;
      const arr = byRol.get(t.rol) ?? [];
      arr.push(t);
      byRol.set(t.rol, arr);
    }
    // Sembrar cronogramas canónicos aunque no tengan tareas en BD todavía.
    for (const r of CRONOGRAMA_ROLES) {
      if (!byRol.has(r.rol)) byRol.set(r.rol, []);
    }
    // Aplicar filtro de acceso del usuario actual: si la prop está definida,
    // descartamos los rols a los que no tiene `ver: true` en su rol de empresa.
    if (isRolAccesible) {
      for (const rol of Array.from(byRol.keys())) {
        if (!isRolAccesible(rol)) byRol.delete(rol);
      }
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
          area: getAreaForRol(rol),
          total: mains.length,
          totalConSubs: tareas.length,
          counts,
          pctVideo: tareas.length > 0 ? Math.round((conVideo / tareas.length) * 100) : 0,
        };
      })
      .sort((a, b) => {
        if (a.area !== b.area) return a.area === "OPERATIVA" ? -1 : 1;
        return a.rol.localeCompare(b.rol);
      });
  }, [data, isRolAccesible]);

  const gruposFiltrados = useMemo(
    () => (filtroArea === "TODAS" ? grupos : grupos.filter((g) => g.area === filtroArea)),
    [grupos, filtroArea],
  );

  const counts = useMemo(() => ({
    TODAS: grupos.length,
    OPERATIVA: grupos.filter((g) => g.area === "OPERATIVA").length,
    ADMINISTRATIVA: grupos.filter((g) => g.area === "ADMINISTRATIVA").length,
  }), [grupos]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-muted/20">
      {/* Filtro por área + acciones */}
      <div className="flex items-center justify-between gap-2 px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
            Área
          </span>
          {(["TODAS", "OPERATIVA", "ADMINISTRATIVA"] as const).map((opt) => {
            const active = filtroArea === opt;
            const label = opt === "TODAS" ? "Todas" : AREA_LABEL[opt];
            // Ocultamos áreas vacías para el usuario actual: si tras filtrar
            // por sus permisos no le queda ningún puesto en esa área, no
            // tiene sentido mostrar el botón de filtro. "Todas" siempre se ve.
            if (opt !== "TODAS" && counts[opt] === 0) return null;
            return (
              <Button
                key={opt}
                type="button"
                variant={active ? "primary" : "outline"}
                size="sm"
                onClick={() => setFiltroArea(opt)}
                className="gap-2"
              >
                {label}
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded",
                    active ? "bg-background/30" : "bg-muted",
                  )}
                >
                  {counts[opt]}
                </span>
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onIrProductividad}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Productividad
          </Button>
          <Button variant="primary" size="sm" onClick={onCrearCronograma}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo
          </Button>
        </div>
      </div>

      {/* Grid de cards */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : gruposFiltrados.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">
            <p className="mb-3">
              No hay cronogramas en el área seleccionada.
            </p>
            <Button variant="primary" size="lg" onClick={onCrearCronograma}>
              <Plus className="h-4 w-4 mr-2" />
              Crear cronograma
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {gruposFiltrados.map(({ rol, area, total, totalConSubs, counts: freqCounts, pctVideo }) => {
              const { icon: Icon, color, bg } = getDeptoConfig(rol);
              const isEmpty = total === 0;
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
                    bg,
                    isEmpty && "opacity-80 border-dashed",
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("p-2.5 rounded-lg bg-background/70", color)}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-violet-600 hover:bg-violet-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.dispatchEvent(new CustomEvent("open-tasks-drawer", { detail: { rol } }));
                        }}
                        title="Ver en Mis Tareas"
                      >
                        <CheckSquare2 className="h-5 w-5" />
                      </Button>
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0 mb-1.5", AREA_BADGE_CLASS[area])}
                  >
                    {AREA_LABEL[area]}
                  </Badge>
                  <h3 className="font-bold text-base uppercase tracking-wide mb-1">{rol}</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {isEmpty ? (
                      <span className="italic">Sin tareas todavía — pulsa para configurar</span>
                    ) : (
                      <>
                        {total} {total === 1 ? "tarea principal" : "tareas principales"}
                        {totalConSubs > total && ` · ${totalConSubs - total} subtareas`}
                      </>
                    )}
                  </p>

                  <FrecuenciaBar counts={freqCounts} total={total} />

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(freqCounts)
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
