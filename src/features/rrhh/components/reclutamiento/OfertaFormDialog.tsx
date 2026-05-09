"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createVacante, updateVacante, getVacanteById,
  listPuestosCatalogo, listDepartamentosCatalogo,
} from "@/features/rrhh/actions/vacantes-actions";
import { useReglasSubmodulo } from "@/features/ajustes/hooks/use-reglas-submodulo";
import { ValidacionFaltantesDialog } from "@/features/ajustes/components/ValidacionFaltantesDialog";

type EstadoPub = "publicada" | "borrador" | "cerrada" | "archivada";

interface PuestoRef { id: string; nombre: string; departamento_id?: string | null }
interface DepartamentoRef { id: string; nombre: string }

interface FormState {
  titulo: string;
  descripcion: string;
  puesto_id: string;
  departamento_id: string;
  ubicacion: string;
  tipo_jornada: string;
  salario_rango: string;
  estado_publicacion: EstadoPub;
  visible_publicamente: boolean;
}

const FORM_VACIO: FormState = {
  titulo: "",
  descripcion: "",
  puesto_id: "",
  departamento_id: "",
  ubicacion: "",
  tipo_jornada: "",
  salario_rango: "",
  estado_publicacion: "borrador",
  visible_publicamente: false,
};

const JORNADA_OPCIONES = [
  { value: "completa", label: "Jornada completa" },
  { value: "parcial", label: "Jornada parcial" },
  { value: "temporal", label: "Temporal" },
  { value: "indefinido", label: "Indefinido" },
  { value: "practicas", label: "Prácticas" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Si se proporciona, edita esa vacante; si no, crea nueva. */
  vacanteId?: string | null;
  /** Título inicial al crear desde un nodo del organigrama. */
  tituloPrefill?: string | null;
  onSaved?: () => void;
}

export function OfertaFormDialog({ open, onOpenChange, vacanteId, tituloPrefill, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [puestos, setPuestos] = useState<PuestoRef[]>([]);
  const [departamentos, setDepartamentos] = useState<DepartamentoRef[]>([]);
  const [pending, startTransition] = useTransition();
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const { validar } = useReglasSubmodulo("rrhh", "reclutamiento");

  useEffect(() => {
    if (!open) return;
    void Promise.all([listPuestosCatalogo(), listDepartamentosCatalogo()]).then(([p, d]) => {
      setPuestos((p.data ?? []) as PuestoRef[]);
      setDepartamentos((d.data ?? []) as DepartamentoRef[]);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!vacanteId) {
      setForm({ ...FORM_VACIO, titulo: tituloPrefill?.trim() ?? "" });
      return;
    }
    setLoadingExisting(true);
    void getVacanteById(vacanteId).then((res) => {
      const v = res.data as {
        titulo?: string; descripcion?: string | null;
        puesto_id?: string | null; departamento_id?: string | null;
        ubicacion?: string | null; tipo_jornada?: string | null;
        salario_rango?: string | null;
        estado_publicacion?: EstadoPub; visible_publicamente?: boolean;
      } | null;
      if (v) {
        setForm({
          titulo: v.titulo ?? "",
          descripcion: v.descripcion ?? "",
          puesto_id: v.puesto_id ?? "",
          departamento_id: v.departamento_id ?? "",
          ubicacion: v.ubicacion ?? "",
          tipo_jornada: v.tipo_jornada ?? "",
          salario_rango: v.salario_rango ?? "",
          estado_publicacion: v.estado_publicacion ?? "borrador",
          visible_publicamente: !!v.visible_publicamente,
        });
      }
      setLoadingExisting(false);
    });
  }, [open, vacanteId, tituloPrefill]);

  function guardar() {
    // Solo validamos al CREAR. Al editar dejamos pasar (puede haber sido creada
    // con reglas distintas y queremos permitir editar lo que ya existe).
    if (!vacanteId) {
      const { labelsFaltantes } = validar({
        titulo: form.titulo,
        descripcion: form.descripcion,
        puesto_id: form.puesto_id,
        departamento_id: form.departamento_id,
        ubicacion: form.ubicacion,
        tipo_jornada: form.tipo_jornada,
        salario_rango: form.salario_rango,
        estado_publicacion: form.estado_publicacion,
      });
      if (labelsFaltantes.length > 0) {
        setFaltantes(labelsFaltantes);
        return;
      }
    }
    startTransition(async () => {
      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || null,
        puesto_id: form.puesto_id || null,
        departamento_id: form.departamento_id || null,
        ubicacion: form.ubicacion.trim() || null,
        tipo_jornada: form.tipo_jornada || null,
        salario_rango: form.salario_rango.trim() || null,
        estado_publicacion: form.estado_publicacion,
        visible_publicamente: form.visible_publicamente,
      };
      const res = vacanteId
        ? await updateVacante(vacanteId, payload)
        : await createVacante(payload);
      if (res.ok) {
        toast.success(vacanteId ? "Oferta actualizada" : "Oferta creada");
        onOpenChange(false);
        onSaved?.();
      } else {
        toast.error(("error" in res && res.error) || "Error al guardar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{vacanteId ? "Editar oferta" : "Nueva oferta de empleo"}</DialogTitle>
          <DialogDescription>
            Las ofertas marcadas como visibles aparecen en el portal público de empleo de la empresa.
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Cargando…
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej. Camarero/a turno tarde"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Departamento</Label>
                <Select value={form.departamento_id} onValueChange={(v) => setForm({ ...form, departamento_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {departamentos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Puesto</Label>
                <Select value={form.puesto_id} onValueChange={(v) => setForm({ ...form, puesto_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {puestos.length === 0 ? (
                      <SelectItem value="__none__" disabled>Sin puestos creados</SelectItem>
                    ) : (
                      puestos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ubicación</Label>
                <Input
                  value={form.ubicacion}
                  onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                  placeholder="Ej. Madrid centro"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de jornada</Label>
                <Select value={form.tipo_jornada} onValueChange={(v) => setForm({ ...form, tipo_jornada: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {JORNADA_OPCIONES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Rango salarial (opcional)</Label>
              <Input
                value={form.salario_rango}
                onChange={(e) => setForm({ ...form, salario_rango: e.target.value })}
                placeholder="Ej. 18.000 - 22.000 € brutos/año"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={5}
                placeholder="Tareas, requisitos, beneficios…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 items-start">
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={form.estado_publicacion}
                  onValueChange={(v) => setForm({ ...form, estado_publicacion: v as EstadoPub })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="borrador">Borrador (no visible)</SelectItem>
                    <SelectItem value="publicada">Publicada</SelectItem>
                    <SelectItem value="cerrada">Cerrada</SelectItem>
                    <SelectItem value="archivada">Archivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Visibilidad pública</Label>
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <Switch
                    checked={form.visible_publicamente}
                    onCheckedChange={(n) => setForm({ ...form, visible_publicamente: n })}
                    disabled={form.estado_publicacion !== "publicada"}
                  />
                  <span className="text-sm">
                    {form.visible_publicamente ? "Aparece en el portal" : "Oculta"}
                  </span>
                </div>
                {form.estado_publicacion !== "publicada" && (
                  <p className="text-[11px] text-muted-foreground">
                    Activa <b>Publicada</b> para hacerla visible.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={pending || loadingExisting}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {vacanteId ? "Guardar cambios" : "Crear oferta"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ValidacionFaltantesDialog
        open={faltantes.length > 0}
        onClose={() => setFaltantes([])}
        campos={faltantes}
        submoduloLabel="Vacantes"
      />
    </Dialog>
  );
}
