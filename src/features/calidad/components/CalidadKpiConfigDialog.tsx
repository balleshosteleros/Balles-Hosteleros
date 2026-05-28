"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings, Save, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCalidadKpiThresholds } from "@/features/calidad/actions/dashboard-actions";
import type { KpiThresholds } from "@/features/calidad/types/dashboard";

type FieldKey = keyof KpiThresholds;

interface RowSpec {
  group: string;
  groupHint: string;
  ok: FieldKey;
  warning: FieldKey;
  label: string;
  unidad: string;
  // Si "asc": valores mayores = mejor (OK = umbral inferior bueno, Warning = límite inferior atención)
  // Si "desc": valores menores = mejor (OK = umbral superior bueno, Warning = límite superior atención)
  direccion: "asc" | "desc";
  okHint: string;
  warningHint: string;
  step?: number;
}

const ROWS: RowSpec[] = [
  {
    group: "Auditorías",
    groupHint: "Auditorías internas por trimestre",
    ok: "auditoriasTrimestreOk",
    warning: "auditoriasTrimestreWarning",
    label: "Nº mínimo de auditorías por trimestre",
    unidad: "audit.",
    direccion: "asc",
    okHint: "≥ valor OK → verde",
    warningHint: "≥ valor Aviso → ámbar; menos → rojo",
  },
  {
    group: "Auditorías",
    groupHint: "Auditorías internas por trimestre",
    ok: "auditoriasNotaOk",
    warning: "auditoriasNotaWarning",
    label: "Nota media de auditorías",
    unidad: "/10",
    direccion: "asc",
    okHint: "≥ valor OK → verde",
    warningHint: "≥ valor Aviso → ámbar",
    step: 0.1,
  },
  {
    group: "Inspecciones",
    groupHint: "Inspecciones externas (bolsa pública)",
    ok: "inspeccionesTrimestreOk",
    warning: "inspeccionesTrimestreWarning",
    label: "Nº mínimo de inspecciones por trimestre",
    unidad: "insp.",
    direccion: "asc",
    okHint: "≥ valor OK → verde",
    warningHint: "≥ valor Aviso → ámbar",
  },
  {
    group: "Inspecciones",
    groupHint: "Inspecciones externas (bolsa pública)",
    ok: "inspeccionesNotaOk",
    warning: "inspeccionesNotaWarning",
    label: "Nota media de inspecciones",
    unidad: "/10",
    direccion: "asc",
    okHint: "≥ valor OK → verde",
    warningHint: "≥ valor Aviso → ámbar",
    step: 0.1,
  },
  {
    group: "Reseñas",
    groupHint: "Rating Google + reseñas internas",
    ok: "resenasRatingOk",
    warning: "resenasRatingWarning",
    label: "Rating medio mínimo",
    unidad: "/5",
    direccion: "asc",
    okHint: "≥ valor OK → verde",
    warningHint: "≥ valor Aviso → ámbar",
    step: 0.1,
  },
  {
    group: "Reseñas",
    groupHint: "Rating Google + reseñas internas",
    ok: "resenasPendientesPctOk",
    warning: "resenasPendientesPctWarning",
    label: "% máximo de reseñas sin responder",
    unidad: "%",
    direccion: "desc",
    okHint: "≤ valor OK → verde",
    warningHint: "≤ valor Aviso → ámbar; más → rojo",
  },
  {
    group: "Cuestionarios",
    groupHint: "Campañas activas de RRHH/operativa",
    ok: "cuestionariosRespuestaPctOk",
    warning: "cuestionariosRespuestaPctWarning",
    label: "% mínimo de respuesta en campañas activas",
    unidad: "%",
    direccion: "asc",
    okHint: "≥ valor OK → verde",
    warningHint: "≥ valor Aviso → ámbar",
  },
];

export function CalidadKpiConfigDialog({
  initialThresholds,
}: {
  initialThresholds: KpiThresholds;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<KpiThresholds>(initialThresholds);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const groups = Array.from(new Set(ROWS.map((r) => r.group)));

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const res = await updateCalidadKpiThresholds(values);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setValues(res.thresholds);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          title="Configurar rangos de KPIs"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar rangos de KPIs</DialogTitle>
          <DialogDescription>
            Define para cada indicador el valor mínimo para que se considere{" "}
            <span className="text-emerald-600 font-medium">verde (OK)</span> y el
            umbral{" "}
            <span className="text-amber-600 font-medium">ámbar (aviso)</span>.
            Por debajo de aviso se marcará en rojo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {groups.map((group) => {
            const rows = ROWS.filter((r) => r.group === group);
            return (
              <div key={group} className="rounded-lg border bg-card p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold">{group}</h3>
                  <p className="text-xs text-muted-foreground">{rows[0]?.groupHint}</p>
                </div>
                <div className="space-y-3">
                  {rows.map((row) => (
                    <div key={row.label} className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                      <div>
                        <Label className="text-xs font-medium">{row.label}</Label>
                        <p className="text-[11px] text-muted-foreground">
                          {row.direccion === "asc"
                            ? "Más alto = mejor"
                            : "Más bajo = mejor"}
                        </p>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="w-28">
                          <Label className="text-[10px] uppercase text-emerald-600 font-bold tracking-wide">
                            OK
                          </Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step={row.step ?? 1}
                              value={values[row.ok] ?? 0}
                              onChange={(e) =>
                                setValues((prev) => ({
                                  ...prev,
                                  [row.ok]: Number(e.target.value),
                                }))
                              }
                              className="h-8"
                            />
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {row.unidad}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{row.okHint}</p>
                        </div>
                        <div className="w-28">
                          <Label className="text-[10px] uppercase text-amber-600 font-bold tracking-wide">
                            Aviso
                          </Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step={row.step ?? 1}
                              value={values[row.warning] ?? 0}
                              onChange={(e) =>
                                setValues((prev) => ({
                                  ...prev,
                                  [row.warning]: Number(e.target.value),
                                }))
                              }
                              className="h-8"
                            />
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {row.unidad}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {row.warningHint}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
