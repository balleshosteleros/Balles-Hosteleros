"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarClock, CheckCircle2, Flame, ListTodo, RefreshCw, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listTareasMias,
  seedTareasCronogramaHoy,
  toggleTareaHecha,
  type TareaRow,
} from "@/features/tareas/actions/tareas-actions";

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function MisTareasCronogramaWidget() {
  const [tareas, setTareas] = useState<TareaRow[]>([]);
  const [rol, setRol] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async (mostrarSpinner = false) => {
    if (mostrarSpinner) setRefreshing(true);
    const seed = await seedTareasCronogramaHoy();
    if (seed.ok) setRol(seed.data.rol);
    const list = await listTareasMias();
    if (list.ok) setTareas(list.data);
    setIsLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    cargar(false);
  }, [cargar]);

  const hoyIso = useMemo(() => ymdLocal(new Date()), []);
  const tareasHoy = useMemo(
    () => tareas.filter((t) => t.tipo === "cronograma" && t.fecha === hoyIso),
    [tareas, hoyIso]
  );

  const hechas = tareasHoy.filter((t) => t.hecha).length;
  const total = tareasHoy.length;
  const pct = total > 0 ? Math.round((hechas / total) * 100) : 0;

  const handleToggle = async (id: string) => {
    // Optimista
    setTareas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, hecha: !t.hecha } : t))
    );
    const res = await toggleTareaHecha(id);
    if (!res.ok) {
      toast.error("No se pudo guardar: " + res.error);
      // Revertir
      setTareas((prev) =>
        prev.map((t) => (t.id === id ? { ...t, hecha: !t.hecha } : t))
      );
    }
  };

  if (isLoading) {
    return (
      <Card className="p-4 bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Cargando tareas del cronograma…
        </div>
      </Card>
    );
  }

  if (!rol) {
    return (
      <Card className="p-5 border-dashed">
        <div className="flex items-start gap-3">
          <ListTodo className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Tareas del cronograma</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Aún no tienes un rol asignado. Pide a Dirección que te asigne uno
              para ver las tareas de tu cronograma cada día.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (total === 0) {
    return (
      <Card className="overflow-hidden border-violet-200">
        <div className="bg-gradient-to-r from-violet-50 via-violet-50/60 to-transparent border-b border-violet-100 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-violet-700" />
            <h3 className="text-sm font-bold tracking-tight">
              Tareas del cronograma · {rol}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-violet-700 hover:text-violet-900"
            onClick={() => cargar(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", refreshing && "animate-spin")} />
            Refrescar
          </Button>
        </div>
        <div className="p-6 text-center text-sm text-muted-foreground">
          No tienes tareas de cronograma para hoy. ¡Buen día!
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-violet-200 shadow-sm">
      <div className="bg-gradient-to-r from-violet-100 via-violet-50 to-transparent border-b border-violet-100 px-5 py-4 flex items-center justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-violet-700" />
            <h3 className="text-base font-bold tracking-tight">
              Tareas del cronograma
            </h3>
          </div>
          <p className="text-xs text-violet-800/80 mt-0.5 font-medium uppercase tracking-wider">
            {rol}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums text-violet-900">
              {hechas}
              <span className="text-violet-400">/{total}</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-violet-700/80">
              {pct}% completado
            </div>
          </div>
          {pct === 100 && total > 0 && (
            <Flame className="h-7 w-7 text-amber-500" />
          )}
        </div>
      </div>

      <div className="divide-y">
        {tareasHoy.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 px-5 py-3 hover:bg-muted/30 transition-colors",
              t.hecha && "bg-emerald-50/40"
            )}
          >
            <Checkbox
              checked={t.hecha}
              onCheckedChange={() => handleToggle(t.id)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-sm font-medium leading-snug",
                  t.hecha && "line-through text-muted-foreground"
                )}
              >
                {t.titulo}
              </p>
              {t.descripcion && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {t.descripcion}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1.5 border-violet-200 text-violet-700"
                >
                  Cronograma
                </Badge>
              </div>
            </div>
            {t.hecha && (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
            )}
          </div>
        ))}
      </div>

      <div className="border-t bg-muted/20 px-4 py-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => cargar(true)}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1", refreshing && "animate-spin")} />
          Refrescar
        </Button>
        <Link
          href="/direccion/cronogramas"
          className="text-xs text-violet-700 hover:text-violet-900 font-medium inline-flex items-center gap-1"
        >
          Ver cronograma completo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}
