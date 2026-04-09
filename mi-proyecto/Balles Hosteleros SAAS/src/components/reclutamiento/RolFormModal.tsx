import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  RolEmpresa, DatosVacante, crearRolVacio, validarRol, validarVacante,
  DEPARTAMENTOS, TIPO_CONTRATO_LABELS, ESTADO_ROL_LABELS,
  type TipoContrato, type EstadoRol,
} from "@/data/roles-empresa";
import { TIPO_JORNADA_LABELS, type TipoJornada } from "@/data/reclutamiento";
import {
  Building2, User, MapPin, Clock, DollarSign, FileText,
  Briefcase, Globe, AlertCircle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface RolFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rol?: RolEmpresa | null;
  empresaId: string;
  onSave: (rol: RolEmpresa) => void;
}

function FieldError({ errors, campo }: { errors: { campo: string; mensaje: string }[]; campo: string }) {
  const err = errors.find((e) => e.campo === campo);
  if (!err) return null;
  return <p className="text-[11px] text-destructive flex items-center gap-1 mt-1"><AlertCircle className="h-3 w-3" />{err.mensaje}</p>;
}

export function RolFormModal({ open, onOpenChange, rol, empresaId, onSave }: RolFormModalProps) {
  const [form, setForm] = useState<RolEmpresa>(() => rol || crearRolVacio(empresaId));
  const [errors, setErrors] = useState<{ campo: string; mensaje: string }[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(rol || crearRolVacio(empresaId));
      setErrors([]);
      setSubmitted(false);
    }
  }, [open, rol, empresaId]);

  const updateField = <K extends keyof RolEmpresa>(key: K, value: RolEmpresa[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateVacante = <K extends keyof DatosVacante>(key: K, value: DatosVacante[K]) => {
    setForm((prev) => ({ ...prev, vacante: { ...prev.vacante, [key]: value } }));
  };

  const handleSave = () => {
    setSubmitted(true);
    const rolErrors = validarRol(form);
    const vacanteErrors = validarVacante(form.vacante);
    const allErrors = [...rolErrors, ...vacanteErrors];
    setErrors(allErrors);

    if (allErrors.length > 0) {
      toast.error("Hay campos obligatorios sin completar", { description: `${allErrors.length} errores encontrados` });
      return;
    }

    onSave(form);
    onOpenChange(false);
    toast.success(rol ? "Rol actualizado correctamente" : "Rol y vacante creados correctamente");
  };

  const isEdit = !!rol;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5 text-primary" />
            {isEdit ? "Editar rol y vacante" : "Nuevo rol y vacante"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)]">
          <div className="px-6 py-5 space-y-6">

            {/* ── BLOQUE 1: Datos generales ──────────────── */}
            <section>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                <Building2 className="h-4 w-4 text-primary" /> DATOS GENERALES DEL ROL
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Nombre del rol *</Label>
                  <Input value={form.nombre} onChange={(e) => updateField("nombre", e.target.value)} placeholder="Ej: Camarero" className="mt-1" />
                  <FieldError errors={errors} campo="nombre" />
                </div>
                <div>
                  <Label className="text-xs">Departamento *</Label>
                  <Select value={form.departamento} onValueChange={(v) => updateField("departamento", v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {DEPARTAMENTOS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldError errors={errors} campo="departamento" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Descripción del puesto *</Label>
                  <Textarea value={form.descripcionPuesto} onChange={(e) => updateField("descripcionPuesto", e.target.value)} placeholder="Descripción detallada de funciones..." className="mt-1 min-h-[80px]" />
                  <FieldError errors={errors} campo="descripcionPuesto" />
                </div>
                <div>
                  <Label className="text-xs">Responsable / Supervisor *</Label>
                  <Input value={form.responsable} onChange={(e) => updateField("responsable", e.target.value)} placeholder="Nombre del supervisor" className="mt-1" />
                  <FieldError errors={errors} campo="responsable" />
                </div>
                <div>
                  <Label className="text-xs">Estado del rol</Label>
                  <Select value={form.estado} onValueChange={(v) => updateField("estado", v as EstadoRol)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ESTADO_ROL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <Separator />

            {/* ── BLOQUE 2: Organización ─────────────────── */}
            <section>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-primary" /> ORGANIZACIÓN
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Centro / Ubicación *</Label>
                  <Input value={form.ubicacion} onChange={(e) => updateField("ubicacion", e.target.value)} placeholder="Ej: Sala principal" className="mt-1" />
                  <FieldError errors={errors} campo="ubicacion" />
                </div>
                <div>
                  <Label className="text-xs">Jornada</Label>
                  <Select value={form.jornada} onValueChange={(v) => updateField("jornada", v as TipoJornada)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_JORNADA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <Separator />

            {/* ── BLOQUE 3: Condiciones ──────────────────── */}
            <section>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                <DollarSign className="h-4 w-4 text-primary" /> CONDICIONES
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Salario / Banda salarial</Label>
                  <Input value={form.salario} onChange={(e) => updateField("salario", e.target.value)} placeholder="Ej: 1.200€ – 1.500€" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Tipo de contrato</Label>
                  <Select value={form.tipoContrato} onValueChange={(v) => updateField("tipoContrato", v as TipoContrato)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_CONTRATO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.activo} onCheckedChange={(v) => updateField("activo", v)} />
                  <Label className="text-xs">Rol activo</Label>
                </div>
              </div>
            </section>

            <Separator />

            {/* ── BLOQUE 4: VACANTE ──────────────────────── */}
            <section className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4">
                <Globe className="h-4 w-4" /> VACANTE ASOCIADA
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Configura la información pública de la vacante vinculada a este rol. Se publicará automáticamente en el portal de empleo si se activa.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Título público de la vacante *</Label>
                  <Input value={form.vacante.tituloPublico} onChange={(e) => updateVacante("tituloPublico", e.target.value)} placeholder="Ej: Camarero/a para restaurante" className="mt-1" />
                  <FieldError errors={errors} campo="tituloPublico" />
                </div>
                <div>
                  <Label className="text-xs">Ubicación de la vacante *</Label>
                  <Input value={form.vacante.ubicacion} onChange={(e) => updateVacante("ubicacion", e.target.value)} placeholder="Ej: Madrid — Zona centro" className="mt-1" />
                  <FieldError errors={errors} campo="ubicacion" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Descripción pública *</Label>
                  <Textarea value={form.vacante.descripcion} onChange={(e) => updateVacante("descripcion", e.target.value)} placeholder="Descripción de la oferta para candidatos..." className="mt-1 min-h-[80px]" />
                  <FieldError errors={errors} campo="descripcion" />
                </div>
                <div>
                  <Label className="text-xs">Tipo de jornada</Label>
                  <Select value={form.vacante.tipoJornada} onValueChange={(v) => updateVacante("tipoJornada", v as TipoJornada)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_JORNADA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tipo de contrato</Label>
                  <Select value={form.vacante.tipoContrato} onValueChange={(v) => updateVacante("tipoContrato", v as TipoContrato)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_CONTRATO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Salario mínimo</Label>
                  <Input value={form.vacante.salarioMin} onChange={(e) => updateVacante("salarioMin", e.target.value)} placeholder="1200" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Salario máximo</Label>
                  <Input value={form.vacante.salarioMax} onChange={(e) => updateVacante("salarioMax", e.target.value)} placeholder="1500" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Estado de publicación</Label>
                  <Select value={form.vacante.estadoPublicacion} onValueChange={(v) => updateVacante("estadoPublicacion", v as any)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="borrador">Borrador</SelectItem>
                      <SelectItem value="publicada">Publicada</SelectItem>
                      <SelectItem value="cerrada">Cerrada</SelectItem>
                      <SelectItem value="archivada">Archivada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Reclutador asignado *</Label>
                  <Input value={form.vacante.reclutadorAsignado} onChange={(e) => updateVacante("reclutadorAsignado", e.target.value)} placeholder="Nombre del reclutador" className="mt-1" />
                  <FieldError errors={errors} campo="reclutadorAsignado" />
                </div>
                <div>
                  <Label className="text-xs">Fecha de publicación</Label>
                  <Input type="date" value={form.vacante.fechaPublicacion} onChange={(e) => updateVacante("fechaPublicacion", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Canal de publicación</Label>
                  <Input value={form.vacante.canalPublicacion} onChange={(e) => updateVacante("canalPublicacion", e.target.value)} placeholder="Ej: Portal propio, LinkedIn" className="mt-1" />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.vacante.cuestionario} onCheckedChange={(v) => updateVacante("cuestionario", v)} />
                  <Label className="text-xs">Incluir cuestionario</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.vacante.visiblePortal} onCheckedChange={(v) => updateVacante("visiblePortal", v)} />
                  <Label className="text-xs">Visible en portal de empleo</Label>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Observaciones de la vacante</Label>
                  <Textarea value={form.vacante.observaciones} onChange={(e) => updateVacante("observaciones", e.target.value)} placeholder="Notas internas sobre esta vacante..." className="mt-1 min-h-[60px]" />
                </div>
              </div>
            </section>

            <Separator />

            {/* ── BLOQUE 5: Observaciones ────────────────── */}
            <section>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-primary" /> OBSERVACIONES
              </h3>
              <Textarea value={form.observaciones} onChange={(e) => updateField("observaciones", e.target.value)} placeholder="Observaciones internas sobre este rol..." className="min-h-[80px]" />
            </section>

            {submitted && errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive flex items-center gap-1 mb-2">
                  <AlertCircle className="h-3.5 w-3.5" /> {errors.length} campos obligatorios pendientes
                </p>
                <ul className="text-xs text-destructive/80 list-disc list-inside space-y-0.5">
                  {errors.map((e) => <li key={e.campo}>{e.mensaje}</li>)}
                </ul>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> {isEdit ? "Guardar cambios" : "Crear rol y vacante"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
