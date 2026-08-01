import { useState, useEffect } from "react";
import { Incidencia, LOCALES, ESTADOS, GRAVEDADES, REPARADORES } from "@/features/empresa/data/mantenimiento";
import { getEmpleadosActivos, type EmpleadoActivo } from "@/features/rrhh/actions/empleados-actions";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (item: Incidencia) => void;
  item?: Incidencia | null;
}

export function IncidenciaModal({ open, onClose, onSave, item }: Props) {
  const isEdit = !!item;
  const { empresaActual } = useEmpresa();
  const { profile } = useAuth();
  const miNombre = `${profile?.nombre ?? ""} ${profile?.apellidos ?? ""}`.trim();

  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  useEffect(() => {
    let alive = true;
    getEmpleadosActivos(empresaActual.dbId).then((r) => {
      if (alive) setEmpleados(r.ok ? r.data : []);
    });
    return () => { alive = false; };
  }, [empresaActual.dbId]);

  const [form, setForm] = useState<Omit<Incidencia, "id">>({
    desperfecto: item?.desperfecto ?? "",
    local: item?.local ?? LOCALES[0],
    estado: item?.estado ?? "PENDIENTE",
    gravedad: item?.gravedad ?? "LEVE",
    apuntaDesperfecto: item?.apuntaDesperfecto ?? miNombre,
    reparador: item?.reparador ?? REPARADORES[0],
    fechaPublicado: item?.fechaPublicado ?? new Date().toISOString().slice(0, 10),
    comentarios: item?.comentarios ?? "",
    actualizaciones: item?.actualizaciones ?? [],
  });

  // Al crear (no edición), fijar por defecto el empleado de la sesión cuando el perfil ya esté cargado.
  useEffect(() => {
    if (!item && miNombre && !form.apuntaDesperfecto) {
      setForm((p) => ({ ...p, apuntaDesperfecto: miNombre }));
    }
  }, [miNombre, item, form.apuntaDesperfecto]);

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    onSave({ ...form, id: item?.id ?? crypto.randomUUID() } as Incidencia);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{isEdit ? "EDITAR INCIDENCIA" : "NUEVA INCIDENCIA"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="col-span-2">
            <Label>DESPERFECTO</Label>
            <Input value={form.desperfecto} onChange={(e) => set("desperfecto", e.target.value)} placeholder="Descripción del desperfecto..." />
          </div>
          <div>
            <Label>LOCAL</Label>
            <Select value={form.local} onValueChange={(v) => set("local", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LOCALES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>ESTADO</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>GRAVEDAD</Label>
            <Select value={form.gravedad} onValueChange={(v) => set("gravedad", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GRAVEDADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>APUNTA DESPERFECTO</Label>
            <Select value={form.apuntaDesperfecto} onValueChange={(v) => set("apuntaDesperfecto", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger>
              <SelectContent>
                {form.apuntaDesperfecto && !empleados.some((e) => e.nombreCompleto === form.apuntaDesperfecto) && (
                  <SelectItem value={form.apuntaDesperfecto}>{form.apuntaDesperfecto}</SelectItem>
                )}
                {empleados.map((e) => (
                  <SelectItem key={e.empleadoId} value={e.nombreCompleto}>
                    {e.nombreCompleto}
                    {(e.puesto || e.departamento) && (
                      <span className="text-muted-foreground">
                        {" — "}{[e.puesto, e.departamento].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>REPARADOR</Label>
            <Select value={form.reparador} onValueChange={(v) => set("reparador", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REPARADORES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>FECHA PUBLICADO</Label>
            <Input type="date" value={form.fechaPublicado} onChange={(e) => set("fechaPublicado", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>COMENTARIOS</Label>
            <Textarea value={form.comentarios} onChange={(e) => set("comentarios", e.target.value)} rows={3} placeholder="Notas adicionales..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>CANCELAR</Button>
          <Button onClick={handleSave}>{isEdit ? "GUARDAR CAMBIOS" : "CREAR INCIDENCIA"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
