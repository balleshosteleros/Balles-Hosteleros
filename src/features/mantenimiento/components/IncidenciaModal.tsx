import { useState, useEffect } from "react";
import { Incidencia, ESTADOS, GRAVEDADES, REPARADORES } from "@/features/empresa/data/mantenimiento";
import { getEmpleadosActivos, type EmpleadoActivo } from "@/features/rrhh/actions/empleados-actions";
import { listLocales } from "@/features/ajustes/actions/locales-actions";
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
  const { user } = useAuth();

  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  const [locales, setLocales] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    getEmpleadosActivos(empresaActual.dbId).then((r) => {
      if (!alive) return;
      const lista = r.ok ? r.data : [];
      setEmpleados(lista);
      // Al crear, preseleccionar por defecto al empleado de la sesión emparejado
      // por userId (identificador fiable). Usamos SIEMPRE su nombreCompleto de la
      // lista para que el value coincida exacto con una opción (si usáramos el
      // nombre del profile, que puede diferir en tildes, saldría un duplicado
      // "huérfano" sin puesto/departamento).
      if (!item) {
        const yo = lista.find((e) => e.userId && e.userId === user?.id);
        if (yo) {
          setForm((p) => (p.apuntaDesperfecto ? p : { ...p, apuntaDesperfecto: yo.nombreCompleto }));
        }
      }
    });
    // Locales reales grabados en esta empresa (fuente única: Ajustes → Locales).
    listLocales(empresaActual.dbId).then((r) => {
      if (!alive) return;
      const nombres = r.ok ? r.data.filter((l) => l.activo).map((l) => l.nombre) : [];
      setLocales(nombres);
      // Si es alta y aún no hay local elegido, pre-seleccionar el primero de la empresa.
      if (!item && nombres.length > 0) {
        setForm((p) => (p.local ? p : { ...p, local: nombres[0] }));
      }
    });
    return () => { alive = false; };
  }, [empresaActual.dbId, item, user?.id]);

  const [form, setForm] = useState<Omit<Incidencia, "id">>({
    desperfecto: item?.desperfecto ?? "",
    local: item?.local ?? "",
    estado: item?.estado ?? "PENDIENTE",
    gravedad: item?.gravedad ?? "LEVE",
    // Vacío al crear: la preselección la fija el efecto por userId contra la
    // lista real de empleados (evita valores que no casen con ninguna opción).
    apuntaDesperfecto: item?.apuntaDesperfecto ?? "",
    reparador: item?.reparador ?? REPARADORES[0],
    fechaPublicado: item?.fechaPublicado ?? new Date().toISOString().slice(0, 10),
    comentarios: item?.comentarios ?? "",
    actualizaciones: item?.actualizaciones ?? [],
  });

  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    onSave({ ...form, id: item?.id ?? crypto.randomUUID() } as Incidencia);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{isEdit ? "Editar incidencia" : "Nueva incidencia"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="col-span-2">
            <Label>Desperfecto</Label>
            <Input value={form.desperfecto} onChange={(e) => set("desperfecto", e.target.value)} placeholder="Descripción del desperfecto..." />
          </div>
          <div>
            <Label>Local</Label>
            <Select value={form.local} onValueChange={(v) => set("local", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona local" /></SelectTrigger>
              <SelectContent>
                {form.local && !locales.includes(form.local) && (
                  <SelectItem value={form.local}>{form.local}</SelectItem>
                )}
                {locales.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ESTADOS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Gravedad</Label>
            <Select value={form.gravedad} onValueChange={(v) => set("gravedad", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GRAVEDADES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Apuntado por</Label>
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
            <Label>Reparador</Label>
            <Select value={form.reparador} onValueChange={(v) => set("reparador", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REPARADORES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha publicado</Label>
            <Input type="date" value={form.fechaPublicado} onChange={(e) => set("fechaPublicado", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Comentarios</Label>
            <Textarea value={form.comentarios} onChange={(e) => set("comentarios", e.target.value)} rows={3} placeholder="Notas adicionales..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>{isEdit ? "Guardar cambios" : "Crear incidencia"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
