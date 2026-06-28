"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPlantillaPuesto, guardarPlantillaPuesto, crearVersionPlantillaPuesto, type PatronAplicable } from "@/features/rrhh/actions/puesto-horario-actions";
import type { Turno } from "@/features/rrhh/data/horarios";
import type { PuestoSalarial } from "@/features/rrhh/data/puestos";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  puesto: PuestoSalarial | null;
  onSaved?: () => void;
}

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function PuestoHorarioDialog({ open, onOpenChange, puesto, onSaved }: Props) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [patrones, setPatrones] = useState<PatronAplicable[]>([]);
  const [dias, setDias] = useState<(string | null)[]>([null, null, null, null, null, null, null]);
  const [activeTurno, setActiveTurno] = useState<string | null>(null);
  const [tienePlantilla, setTienePlantilla] = useState(false);
  const [versionDesde, setVersionDesde] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !puesto) return;
    setLoading(true);
    setActiveTurno(null);
    getPlantillaPuesto(puesto.id)
      .then((res) => {
        setTurnos(res.turnos);
        setPatrones(res.patrones);
        setDias(res.dias);
        setTienePlantilla(res.plantillaId !== null);
      })
      .finally(() => setLoading(false));
  }, [open, puesto]);

  const handleNuevaVersion = async () => {
    if (!puesto) return;
    setSaving(true);
    try {
      const res = await crearVersionPlantillaPuesto(puesto.id, dias, versionDesde);
      if (!res.ok) { toast.error(("error" in res ? res.error : undefined) ?? "No se pudo crear la versión"); return; }
      toast.success("Nueva versión de la plantilla creada");
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const aplicarPatron = (p: PatronAplicable) => {
    setDias([...p.dias]);
    toast.success(`Patrón "${p.nombre}" aplicado a la plantilla`);
  };

  const turnoById = useMemo(() => {
    const m = new Map<string, Turno>();
    turnos.forEach((t) => m.set(t.id, t));
    return m;
  }, [turnos]);

  const fijos = turnos.filter((t) => t.tipoJornada === "fijo");
  const flexibles = turnos.filter((t) => t.tipoJornada === "flexible");

  const pintarDia = (i: number) => {
    setDias((prev) => {
      const next = [...prev];
      next[i] = activeTurno; // si activeTurno es null, limpia
      return next;
    });
  };

  const limpiarDia = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDias((prev) => { const next = [...prev]; next[i] = null; return next; });
  };

  const handleSave = async () => {
    if (!puesto) return;
    setSaving(true);
    try {
      const res = await guardarPlantillaPuesto(puesto.id, dias);
      if (!res.ok) { toast.error(res.error ?? "No se pudo guardar"); return; }
      toast.success("Plantilla del puesto guardada");
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const TurnoCard = ({ t }: { t: Turno }) => (
    <button
      type="button"
      onClick={() => setActiveTurno((cur) => (cur === t.id ? null : t.id))}
      className={cn(
        "w-full flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors",
        activeTurno === t.id ? "ring-2 ring-primary border-primary" : "hover:bg-muted/50",
      )}
    >
      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: t.colorHex }} />
      <span className="font-semibold">{t.codigo}</span>
      <span className="text-muted-foreground truncate">{t.nombre}</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Horario · {puesto?.puesto}</DialogTitle>
          <DialogDescription>
            Monta la plantilla semanal del puesto. Elige un turno del lateral y pincha los días.
            Los turnos se crean en Horarios; aquí solo se asignan.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4 py-2">
            {/* Rejilla 7 días */}
            <div className="grid grid-cols-7 gap-1.5">
              {DIAS.map((d, i) => {
                const t = dias[i] ? turnoById.get(dias[i]!) : null;
                return (
                  <div key={d} className="space-y-1">
                    <div className="text-[11px] font-medium text-center text-muted-foreground">{d}</div>
                    <button
                      type="button"
                      onClick={() => pintarDia(i)}
                      className={cn(
                        "group relative h-20 w-full rounded-md border text-xs flex items-center justify-center px-1 text-center transition-colors",
                        t ? "border-transparent text-white font-semibold" : "border-dashed hover:bg-muted/50 text-muted-foreground",
                      )}
                      style={t ? { backgroundColor: t.colorHex } : undefined}
                      title={t ? `${t.codigo} · ${t.nombre}` : "Asignar"}
                    >
                      {t ? (
                        <>
                          <span className="leading-tight">{t.codigo}</span>
                          <span
                            role="button"
                            onClick={(e) => limpiarDia(i, e)}
                            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 rounded-full bg-black/20 p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </span>
                        </>
                      ) : (
                        <span className="text-lg">+</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Lateral de turnos */}
            <div className="space-y-3 md:border-l md:pl-4">
              {turnos.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay turnos. Créalos en Horarios → Turnos.</p>
              )}
              {fijos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fijos</p>
                  {fijos.map((t) => <TurnoCard key={t.id} t={t} />)}
                </div>
              )}
              {flexibles.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Flexibles</p>
                  {flexibles.map((t) => <TurnoCard key={t.id} t={t} />)}
                </div>
              )}
              {patrones.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Patrones</p>
                  <p className="text-[10px] text-muted-foreground -mt-1">Aplican su semana completa a la plantilla.</p>
                  {patrones.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => aplicarPatron(p)}
                      className="w-full flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs hover:bg-muted/50"
                    >
                      <span className="font-semibold truncate">{p.nombre}</span>
                    </button>
                  ))}
                </div>
              )}
              {activeTurno && (
                <button
                  type="button"
                  onClick={() => setActiveTurno(null)}
                  className="w-full rounded-md border border-dashed px-2.5 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50"
                >
                  Modo borrar (pincha un día para vaciarlo)
                </button>
              )}
            </div>
          </div>
        )}

        {tienePlantilla && !loading && (
          <div className="rounded-md border border-dashed p-3 space-y-2 text-xs">
            <p className="font-medium">¿Cambió el horario del puesto?</p>
            <p className="text-muted-foreground">
              Crea una nueva versión desde una fecha: la anterior queda en histórico y los empleados pasan a la nueva.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={versionDesde}
                onChange={(e) => setVersionDesde(e.target.value)}
                className="flex h-9 w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              />
              <Button size="sm" variant="secondary" onClick={handleNuevaVersion} disabled={saving}>
                Crear nueva versión
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Guardando…" : tienePlantilla ? "Guardar (versión actual)" : "Guardar plantilla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
