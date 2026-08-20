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
import { Loader2, Shirt, Package, Mail } from "lucide-react";
import { toast } from "sonner";
import { crearEntrega } from "@/features/rrhh/actions/entregas-actions";
import { listTiposMaterial } from "@/features/rrhh/actions/entregas-tipos-actions";
import { getEmpleadosActivos } from "@/features/rrhh/actions/empleados-actions";
import { TALLAS_ROPA, type TipoMaterial } from "@/features/rrhh/data/entregas";

/**
 * Registrar la entrega de UNA pieza.
 *
 * No hay cantidades ni varias cosas a la vez: si le das tres camisetas, son tres
 * entregas. Así el acta que firma el trabajador dice exactamente qué recibió, y
 * la devolución de una pieza no arrastra a las demás.
 *
 * Al guardar se le manda el correo para que la firme.
 */

type EmpleadoOpcion = { id: string; nombre: string };

function hoyISO(): string {
  // Fecha local del navegador, no UTC: la entrega es un hecho del día de aquí.
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
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
  const [tipoId, setTipoId] = useState("");
  const [talla, setTalla] = useState("");

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
    setTipoId("");
    setTalla("");
  }, [open, empleadoFijo?.id]);

  const tiposPorId = useMemo(() => {
    const m = new Map<string, TipoMaterial>();
    for (const t of tipos) m.set(t.id, t);
    return m;
  }, [tipos]);

  const tipoElegido = tipoId ? tiposPorId.get(tipoId) : undefined;

  async function guardar() {
    if (!empleadoId) {
      toast.error("Elige un trabajador");
      return;
    }
    if (!tipoElegido) {
      toast.error("Elige qué se entrega");
      return;
    }
    // Sin la talla, el acta no dice qué talla se dio.
    if (tipoElegido.requiereTalla && !talla.trim()) {
      toast.error(`Falta la talla de ${tipoElegido.nombre}`);
      return;
    }

    setGuardando(true);
    const res = await crearEntrega({
      empleadoId,
      fecha,
      nota: nota || null,
      item: {
        tipoId: tipoElegido.id,
        tipoNombre: tipoElegido.nombre,
        categoria: tipoElegido.categoria,
        talla: talla.trim() || null,
        requiereDevolucion: tipoElegido.requiereDevolucion,
      },
    });
    setGuardando(false);
    if (!res.ok) { toast.error(res.error); return; }

    // La entrega queda grabada aunque el correo falle: el aviso distingue las
    // dos cosas para que RRHH sepa si tiene que reenviarla.
    if (res.firmaEnviada) {
      toast.success("Entrega registrada. Le hemos mandado el correo para firmarla.");
    } else {
      toast.warning(
        `Entrega registrada, pero el correo de firma no salió: ${res.errorFirma ?? "error desconocido"}. Puedes reenviarlo desde la lista.`,
      );
    }
    onOpenChange(false);
    onCreada();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva entrega</DialogTitle>
          <DialogDescription>
            Una entrega por cosa. Si le das tres camisetas, registra tres entregas.
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

            {/* Qué se entrega */}
            {tipos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No hay tipos de material configurados todavía. Créalos desde el
                engranaje de la barra de herramientas.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="entrega-tipo">Qué se entrega</Label>
                  <Select
                    value={tipoId}
                    onValueChange={(v) => {
                      setTipoId(v);
                      setTalla("");
                    }}
                  >
                    <SelectTrigger id="entrega-tipo">
                      <SelectValue placeholder="Selecciona…" />
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
                  {tipoElegido?.requiereDevolucion && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                    >
                      Hay que devolverlo al salir
                    </Badge>
                  )}
                </div>

                {tipoElegido?.requiereTalla && (
                  <div className="space-y-2">
                    <Label htmlFor="entrega-talla">Talla</Label>
                    <Select value={talla} onValueChange={setTalla}>
                      <SelectTrigger id="entrega-talla" className="w-28">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {TALLAS_ROPA.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="entrega-nota">Nota</Label>
              <Textarea
                id="entrega-nota"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Opcional: estado de la pieza, observaciones…"
                rows={3}
              />
            </div>

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Al guardar le llegará un correo para que firme que lo ha recibido.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || cargando || tipos.length === 0}>
            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
