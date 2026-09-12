"use client";

/**
 * Creador de calendarios (PRP-088). Un calendario por ESTRATEGIA: la clase
 * gratuita, la consultoría, lo que sea. Cada uno con su duración, sus normas,
 * su equipo y los días y horas en que se puede reservar.
 *
 * Vive en el engranaje de la pantalla de Citas, como el resto de configuración
 * base del software.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listarCalendarios,
  guardarCalendario,
  borrarCalendario,
  listarEmpleados,
  empleadosDelCalendario,
  asignarEmpleados,
  listarDisponibilidad,
  guardarDisponibilidad,
} from "../actions/citas-actions";
import type { CitaCalendario, EmpleadoDeCalendario } from "../types";
import { Desplegable } from "@/components/ui/desplegable";

const DIAS = [
  { n: 1, nombre: "Lunes" },
  { n: 2, nombre: "Martes" },
  { n: 3, nombre: "Miércoles" },
  { n: 4, nombre: "Jueves" },
  { n: 5, nombre: "Viernes" },
  { n: 6, nombre: "Sábado" },
  { n: 7, nombre: "Domingo" },
];

const COLORES = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

interface Franja {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

const NUEVO: Omit<CitaCalendario, "id" | "empresa_id" | "created_at" | "updated_at"> = {
  nombre: "",
  descripcion: null,
  duracion_min: 60,
  paso_min: 30,
  antelacion_min_horas: 4,
  dias_vista: 30,
  color: COLORES[0],
  activo: true,
};

interface Props {
  open: boolean;
  onOpenChange: (abierto: boolean) => void;
  onGuardado: () => void;
}

export function CalendariosConfigDialog({ open, onOpenChange, onGuardado }: Props) {
  const [calendarios, setCalendarios] = useState<CitaCalendario[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoDeCalendario[]>([]);
  const [editando, setEditando] = useState<Partial<CitaCalendario> | null>(null);
  const [equipo, setEquipo] = useState<string[]>([]);
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState<CitaCalendario | null>(null);

  const cargar = useCallback(async () => {
    const [resCal, resEmp] = await Promise.all([listarCalendarios(), listarEmpleados()]);
    if (resCal.ok) setCalendarios(resCal.data);
    else toast.error(resCal.error);
    if (resEmp.ok) setEmpleados(resEmp.data);
  }, []);

  useEffect(() => {
    if (open) void cargar();
  }, [open, cargar]);

  const abrirNuevo = () => {
    setEditando({ ...NUEVO });
    setEquipo([]);
    setFranjas([{ dia_semana: 1, hora_inicio: "10:00", hora_fin: "14:00" }]);
  };

  const abrirEdicion = async (cal: CitaCalendario) => {
    setEditando(cal);
    const [resEq, resFr] = await Promise.all([
      empleadosDelCalendario(cal.id),
      listarDisponibilidad(cal.id),
    ]);
    setEquipo(resEq.ok ? resEq.data : []);
    setFranjas(
      resFr.ok
        ? resFr.data.map((f) => ({
            dia_semana: f.dia_semana,
            hora_inicio: f.hora_inicio.slice(0, 5),
            hora_fin: f.hora_fin.slice(0, 5),
          }))
        : [],
    );
  };

  const guardar = async () => {
    if (!editando) return;
    setGuardando(true);
    const res = await guardarCalendario({
      id: editando.id,
      nombre: editando.nombre ?? "",
      descripcion: editando.descripcion ?? null,
      duracion_min: editando.duracion_min ?? 60,
      paso_min: editando.paso_min ?? 30,
      antelacion_min_horas: editando.antelacion_min_horas ?? 4,
      dias_vista: editando.dias_vista ?? 30,
      color: editando.color ?? COLORES[0],
      activo: editando.activo ?? true,
    });
    if (!res.ok) {
      setGuardando(false);
      toast.error(res.error);
      return;
    }
    // El equipo y el horario cuelgan del calendario: se guardan después de
    // tener su id (si es nuevo, no existía hasta ahora).
    await asignarEmpleados(res.data, equipo);
    await guardarDisponibilidad(
      res.data,
      franjas.map((f) => ({ ...f, empleado_id: null })),
    );
    setGuardando(false);
    toast.success("Guardado");
    setEditando(null);
    await cargar();
    onGuardado();
  };

  const borrar = async () => {
    if (!aBorrar) return;
    const res = await borrarCalendario(aBorrar.id);
    if (res.ok) {
      toast.success("Calendario borrado");
      await cargar();
      onGuardado();
    } else {
      toast.error(res.error);
    }
    setABorrar(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Calendarios</DialogTitle>
            <DialogDescription>
              Uno por estrategia. Cada calendario tiene su duración, su equipo y sus horas.
            </DialogDescription>
          </DialogHeader>

          {!editando ? (
            <div className="space-y-2">
              {calendarios.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay ningún calendario.
                </p>
              )}
              {calendarios.map((c) => (
                <Card key={c.id} className="flex items-center gap-3 p-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: c.color ?? COLORES[0] }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.duracion_min} min · huecos cada {c.paso_min} min · hasta {c.dias_vista} días
                    </p>
                  </div>
                  {!c.activo && <Badge variant="outline">Inactivo</Badge>}
                  <Button variant="ghost" size="icon" onClick={() => void abrirEdicion(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setABorrar(c)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </Card>
              ))}
              <Button variant="outline" className="w-full" onClick={abrirNuevo}>
                <Plus className="mr-1 h-4 w-4" /> Nuevo calendario
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="cal-nombre">Nombre</Label>
                  <Input
                    id="cal-nombre"
                    value={editando.nombre ?? ""}
                    placeholder="Llamada de valoración"
                    onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="cal-desc">Descripción</Label>
                  <Textarea
                    id="cal-desc"
                    rows={2}
                    value={editando.descripcion ?? ""}
                    onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
                  />
                </div>
                <Campo
                  id="cal-duracion"
                  etiqueta="Duración (minutos)"
                  valor={editando.duracion_min ?? 60}
                  onChange={(v) => setEditando({ ...editando, duracion_min: v })}
                />
                <Campo
                  id="cal-paso"
                  etiqueta="Un hueco cada (minutos)"
                  valor={editando.paso_min ?? 30}
                  onChange={(v) => setEditando({ ...editando, paso_min: v })}
                />
                <Campo
                  id="cal-antelacion"
                  etiqueta="Antelación mínima (horas)"
                  valor={editando.antelacion_min_horas ?? 4}
                  onChange={(v) => setEditando({ ...editando, antelacion_min_horas: v })}
                />
                <Campo
                  id="cal-dias"
                  etiqueta="Se puede reservar hasta (días)"
                  valor={editando.dias_vista ?? 30}
                  onChange={(v) => setEditando({ ...editando, dias_vista: v })}
                />
                <div>
                  <Label>Color</Label>
                  <div className="mt-1.5 flex gap-2">
                    {COLORES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Color ${c}`}
                        onClick={() => setEditando({ ...editando, color: c })}
                        className={`h-7 w-7 rounded-full ${
                          editando.color === c ? "ring-2 ring-offset-2 ring-foreground" : ""
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <Switch
                    id="cal-activo"
                    checked={editando.activo ?? true}
                    onCheckedChange={(v) => setEditando({ ...editando, activo: v })}
                  />
                  <Label htmlFor="cal-activo">Activo</Label>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Quién atiende</Label>
                {empleados.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay empleados activos.</p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {empleados.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={equipo.includes(e.id)}
                          onCheckedChange={(v) =>
                            setEquipo(v ? [...equipo, e.id] : equipo.filter((x) => x !== e.id))
                          }
                        />
                        <span className="truncate">{e.nombre}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Cuándo se puede reservar</Label>
                <div className="space-y-2">
                  {franjas.map((f, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Desplegable
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={f.dia_semana}
                        onChange={(e) => {
                          const copia = [...franjas];
                          copia[i] = { ...f, dia_semana: Number(e.target.value) };
                          setFranjas(copia);
                        }}
                      >
                        {DIAS.map((d) => (
                          <option key={d.n} value={d.n}>
                            {d.nombre}
                          </option>
                        ))}
                      </Desplegable>
                      <Input
                        type="time"
                        className="w-28"
                        value={f.hora_inicio}
                        onChange={(e) => {
                          const copia = [...franjas];
                          copia[i] = { ...f, hora_inicio: e.target.value };
                          setFranjas(copia);
                        }}
                      />
                      <span className="text-sm text-muted-foreground">a</span>
                      <Input
                        type="time"
                        className="w-28"
                        value={f.hora_fin}
                        onChange={(e) => {
                          const copia = [...franjas];
                          copia[i] = { ...f, hora_fin: e.target.value };
                          setFranjas(copia);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFranjas(franjas.filter((_, j) => j !== i))}
                        aria-label="Quitar franja"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFranjas([...franjas, { dia_semana: 1, hora_inicio: "10:00", hora_fin: "14:00" }])
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" /> Añadir franja
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Las horas son las de la empresa, no las de quien reserva.
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditando(null)}>
                  Volver
                </Button>
                <Button onClick={guardar} disabled={guardando}>
                  Guardar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(aBorrar)} onOpenChange={(a) => !a && setABorrar(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Borrar el calendario</DialogTitle>
            <DialogDescription>
              Se va a borrar «{aBorrar?.nombre}». Si tiene citas, no se borrará: desactívalo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setABorrar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={borrar}>
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Campo({
  id,
  etiqueta,
  valor,
  onChange,
}: {
  id: string;
  etiqueta: string;
  valor: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input
        id={id}
        inputMode="numeric"
        value={String(valor)}
        onChange={(e) => {
          const limpio = e.target.value.replace(/\D/g, "");
          onChange(limpio === "" ? 0 : Number(limpio));
        }}
      />
    </div>
  );
}
