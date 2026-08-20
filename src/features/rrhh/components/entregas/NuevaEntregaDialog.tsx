"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, Shirt, Package } from "lucide-react";
import { toast } from "sonner";
import { crearEntrega, type NuevaEntregaItem } from "@/features/rrhh/actions/entregas-actions";
import { listTiposMaterial } from "@/features/rrhh/actions/entregas-tipos-actions";
import { getEmpleadosActivos } from "@/features/rrhh/actions/empleados-actions";
import { TALLAS_ROPA, type TipoMaterial } from "@/features/rrhh/data/entregas";

/**
 * Registrar una entrega: a quién, qué cosas, y una nota libre a mano.
 * Se crea en borrador; el envío a firma es un paso aparte.
 */

interface LineaForm {
  /** Clave local para el key de React (los ids reales aún no existen). */
  key: string;
  tipoId: string;
  cantidad: number;
  talla: string;
}

type EmpleadoOpcion = { id: string; nombre: string };

function hoyISO(): string {
  // Fecha local del navegador, no UTC: la entrega es un hecho del día de aquí.
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

let contadorLineas = 0;
function nuevaLinea(): LineaForm {
  contadorLineas += 1;
  return { key: `l${contadorLineas}`, tipoId: "", cantidad: 1, talla: "" };
}

export function NuevaEntregaDialog({
  open,
  onOpenChange,
  empleadoFijo,
  onCreada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Si viene, la entrega es para ese trabajador y no se puede cambiar. */
  empleadoFijo?: { id: string; nombre: string };
  onCreada: () => void;
}) {
  const [tipos, setTipos] = useState<TipoMaterial[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoOpcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [empleadoId, setEmpleadoId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState("");
  const [lineas, setLineas] = useState<LineaForm[]>([nuevaLinea()]);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setCargando(true);

    void Promise.all([listTiposMaterial(false), getEmpleadosActivos()]).then(
      ([tiposData, empleadosRes]) => {
        if (cancel) return;
        setTipos(tiposData);
        const lista = (empleadosRes.data ?? []).map((e) => ({
          id: e.empleadoId,
          nombre: e.nombreCompleto || `${e.nombre} ${e.apellidos}`.trim(),
        }));
        setEmpleados(lista.filter((e) => e.nombre));
        setCargando(false);
      },
    );
    return () => { cancel = true; };
  }, [open]);

  // Al abrir, formulario limpio.
  useEffect(() => {
    if (!open) return;
    setEmpleadoId(empleadoFijo?.id ?? "");
    setFecha(hoyISO());
    setNota("");
    setLineas([nuevaLinea()]);
  }, [open, empleadoFijo?.id]);

  const tiposPorId = useMemo(() => {
    const m = new Map<string, TipoMaterial>();
    for (const t of tipos) m.set(t.id, t);
    return m;
  }, [tipos]);

  function cambiarLinea(key: string, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...cambios } : l)));
  }

  async function guardar() {
    if (!empleadoId) {
      toast.error("Elige un trabajador");
      return;
    }
    const conTipo = lineas.filter((l) => l.tipoId);
    if (conTipo.length === 0) {
      toast.error("Añade al menos una cosa a la entrega");
      return;
    }
    // Toda línea de un tipo con talla tiene que traerla: si no, la entrega
    // queda sin decir qué talla se dio.
    const sinTalla = conTipo.find((l) => tiposPorId.get(l.tipoId)?.requiereTalla && !l.talla.trim());
    if (sinTalla) {
      toast.error(`Falta la talla de ${tiposPorId.get(sinTalla.tipoId)?.nombre ?? "una línea"}`);
      return;
    }

    const items: NuevaEntregaItem[] = conTipo.map((l) => {
      const t = tiposPorId.get(l.tipoId);
      return {
        tipoId: l.tipoId,
        tipoNombre: t?.nombre ?? "",
        categoria: t?.categoria ?? "material",
        cantidad: l.cantidad,
        talla: l.talla.trim() || null,
        requiereDevolucion: t?.requiereDevolucion ?? false,
      };
    });

    setGuardando(true);
    const res = await crearEntrega({ empleadoId, fecha, nota: nota || null, items });
    setGuardando(false);
    if (!res.ok) { toast.error(res.error); return; }

    toast.success("Entrega registrada");
    onOpenChange(false);
    onCreada();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva entrega</DialogTitle>
          <DialogDescription>
            Registra el uniforme y el material que le das al trabajador.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entrega-empleado">Trabajador</Label>
                {empleadoFijo ? (
                  <Input id="entrega-empleado" value={empleadoFijo.nombre} readOnly disabled />
                ) : (
                  <Select value={empleadoId} onValueChange={setEmpleadoId}>
                    <SelectTrigger id="entrega-empleado">
                      <SelectValue placeholder="Selecciona…" />
                    </SelectTrigger>
                    <SelectContent>
                      {empleados.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          No hay trabajadores activos
                        </SelectItem>
                      ) : (
                        empleados.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="entrega-fecha">Fecha</Label>
                <Input
                  id="entrega-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Qué se entrega</Label>
                <Button size="sm" variant="outline" onClick={() => setLineas((p) => [...p, nuevaLinea()])}>
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir
                </Button>
              </div>

              {tipos.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-3 py-6 text-center">
                  No hay tipos configurados. Créalos en el engranaje de
                  configuración de este submódulo.
                </p>
              ) : (
                <div className="space-y-2">
                  {lineas.map((l) => {
                    const tipo = tiposPorId.get(l.tipoId);
                    return (
                      <div key={l.key} className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <Select
                            value={l.tipoId}
                            onValueChange={(v) => cambiarLinea(l.key, { tipoId: v, talla: "" })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Elige qué entregas…" />
                            </SelectTrigger>
                            <SelectContent>
                              {tipos.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  <span className="flex items-center gap-2">
                                    {t.categoria === "uniforme" ? (
                                      <Shirt className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    {t.nombre}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {tipo?.requiereDevolucion && (
                            <Badge variant="outline" className="mt-1.5 text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                              Hay que devolverlo al salir
                            </Badge>
                          )}
                        </div>

                        {tipo?.requiereTalla && (
                          <div className="w-28 shrink-0">
                            <Select
                              value={l.talla}
                              onValueChange={(v) => cambiarLinea(l.key, { talla: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Talla" />
                              </SelectTrigger>
                              <SelectContent>
                                {TALLAS_ROPA.map((t) => (
                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <Input
                          type="number"
                          min={1}
                          className="w-20 shrink-0"
                          value={l.cantidad}
                          onChange={(e) =>
                            cambiarLinea(l.key, { cantidad: Math.max(1, Number(e.target.value) || 1) })
                          }
                          aria-label="Cantidad"
                        />

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setLineas((p) => (p.length === 1 ? [nuevaLinea()] : p.filter((x) => x.key !== l.key)))}
                          title="Quitar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entrega-nota">Nota</Label>
              <Textarea
                id="entrega-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Lo que quieras dejar anotado sobre esta entrega."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} disabled={guardando || cargando}>
            {guardando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
