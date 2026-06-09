import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getRolesPorEmpresa,
  ESTADO_ROL_LABELS,
  TIPO_CONTRATO_LABELS,
  DEPARTAMENTOS,
  type RolEmpresa,
  type DatosVacante,
  type EstadoRol,
  type TipoContrato,
  crearRolVacio,
  validarRol,
  validarVacante,
} from "@/features/ajustes/data/roles-empresa";
import { TIPO_JORNADA_LABELS, ESTADO_PUBLICACION_LABELS, type TipoJornada, type EstadoPublicacion } from "@/features/rrhh/data/reclutamiento";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, Plus, Briefcase, ChevronRight, Info, Building2,
  MapPin, FileText, Save, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Rol Form Modal (with VACANTE block) ────────────────────────
function RolFormDialog({
  open, onOpenChange, rol, empresaId, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rol: RolEmpresa | null;
  empresaId: string;
  onSave: (r: RolEmpresa) => void;
}) {
  const initial = rol || crearRolVacio(empresaId);
  const [form, setForm] = useState<RolEmpresa>(initial);
  const [errors, setErrors] = useState<string[]>([]);

  // Reset form when dialog opens
  const handleOpenChange = (o: boolean) => {
    if (o) setForm(rol || crearRolVacio(empresaId));
    setErrors([]);
    onOpenChange(o);
  };

  const updateField = <K extends keyof RolEmpresa>(k: K, v: RolEmpresa[K]) => setForm((p) => ({ ...p, [k]: v }));
  const updateVacante = <K extends keyof DatosVacante>(k: K, v: DatosVacante[K]) =>
    setForm((p) => ({ ...p, vacante: { ...p.vacante, [k]: v } }));

  const handleSave = () => {
    const rolErrors = validarRol(form);
    const vacErrors = validarVacante(form.vacante);
    const allErrors = [...rolErrors, ...vacErrors].map((e) => e.mensaje);
    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }
    setErrors([]);
    onSave(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            {rol ? `Editar puesto: ${rol.nombre}` : "Nuevo puesto de empresa"}
          </DialogTitle>
          <DialogDescription>
            Completa los datos del puesto y su vacante asociada. Todos los campos marcados son obligatorios.
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-destructive">{e}</p>
              ))}
            </div>
          </div>
        )}

        {/* ── BLOQUE: Datos generales ──────────────────── */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2 pt-2">
            <Building2 className="h-4 w-4 text-primary" /> Datos generales
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Nombre del puesto *</Label>
              <Input value={form.nombre} onChange={(e) => updateField("nombre", e.target.value)} className="mt-1" placeholder="Ej: Camarero" />
            </div>
            <div>
              <Label className="text-xs">Departamento *</Label>
              <Select value={form.departamento} onValueChange={(v) => updateField("departamento", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {DEPARTAMENTOS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Descripción del puesto *</Label>
            <Textarea value={form.descripcionPuesto} onChange={(e) => updateField("descripcionPuesto", e.target.value)} className="mt-1 min-h-[80px]" placeholder="Descripción detallada del puesto..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Responsable / Supervisor *</Label>
              <Input value={form.responsable} onChange={(e) => updateField("responsable", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Estado del puesto</Label>
              <Select value={form.estado} onValueChange={(v) => updateField("estado", v as EstadoRol)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ESTADO_ROL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* ── BLOQUE: Organización ─────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Organización
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Centro / Local / Ubicación *</Label>
              <Input value={form.ubicacion} onChange={(e) => updateField("ubicacion", e.target.value)} className="mt-1" placeholder="Ej: La Habana — Sala principal" />
            </div>
            <div>
              <Label className="text-xs">Tipo de jornada</Label>
              <Select value={form.jornada} onValueChange={(v) => updateField("jornada", v as TipoJornada)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_JORNADA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Salario o banda salarial</Label>
              <Input value={form.salario} onChange={(e) => updateField("salario", e.target.value)} className="mt-1" placeholder="Ej: 1.200€ – 1.500€" />
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
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.activo} onCheckedChange={(v) => updateField("activo", v)} />
            <Label className="text-xs">Puesto activo</Label>
          </div>
        </div>

        <Separator />

        {/* ── BLOQUE: VACANTE ─────────────────────────── */}
        <div className="space-y-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4" /> Vacante asociada
          </h3>
          <p className="text-xs text-muted-foreground -mt-2">
            Esta vacante se generará automáticamente en Recursos Humanos → Reclutamiento.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Título público de la vacante *</Label>
              <Input value={form.vacante.tituloPublico} onChange={(e) => updateVacante("tituloPublico", e.target.value)} className="mt-1" placeholder="Ej: Camarero/a para restaurante" />
            </div>
            <div>
              <Label className="text-xs">Ubicación de la vacante *</Label>
              <Input value={form.vacante.ubicacion} onChange={(e) => updateVacante("ubicacion", e.target.value)} className="mt-1" placeholder="Ej: Madrid — Sala principal" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Descripción de la vacante *</Label>
            <Textarea value={form.vacante.descripcion} onChange={(e) => updateVacante("descripcion", e.target.value)} className="mt-1 min-h-[80px]" placeholder="Descripción pública de la vacante..." />
          </div>
          <div className="grid grid-cols-3 gap-4">
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
              <Label className="text-xs">Estado de publicación</Label>
              <Select value={form.vacante.estadoPublicacion} onValueChange={(v) => updateVacante("estadoPublicacion", v as EstadoPublicacion)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ESTADO_PUBLICACION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Salario mínimo (€)</Label>
              <Input value={form.vacante.salarioMin} onChange={(e) => updateVacante("salarioMin", e.target.value)} className="mt-1" placeholder="1200" />
            </div>
            <div>
              <Label className="text-xs">Salario máximo (€)</Label>
              <Input value={form.vacante.salarioMax} onChange={(e) => updateVacante("salarioMax", e.target.value)} className="mt-1" placeholder="1500" />
            </div>
            <div>
              <Label className="text-xs">Fecha de publicación</Label>
              <Input type="date" value={form.vacante.fechaPublicacion} onChange={(e) => updateVacante("fechaPublicacion", e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Reclutador asignado *</Label>
              <Input value={form.vacante.reclutadorAsignado} onChange={(e) => updateVacante("reclutadorAsignado", e.target.value)} className="mt-1" placeholder="Nombre del reclutador" />
            </div>
            <div>
              <Label className="text-xs">Canal de publicación</Label>
              <Input value={form.vacante.canalPublicacion} onChange={(e) => updateVacante("canalPublicacion", e.target.value)} className="mt-1" placeholder="Ej: Portal propio, LinkedIn..." />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.vacante.cuestionario} onCheckedChange={(v) => updateVacante("cuestionario", v)} />
              <Label className="text-xs">Incluir cuestionario</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.vacante.visiblePortal} onCheckedChange={(v) => updateVacante("visiblePortal", v)} />
              <Label className="text-xs">Visible en portal de empleo</Label>
            </div>
          </div>
          <div>
            <Label className="text-xs">Observaciones de la vacante</Label>
            <Textarea value={form.vacante.observaciones} onChange={(e) => updateVacante("observaciones", e.target.value)} className="mt-1 min-h-[60px]" placeholder="Notas internas sobre la vacante..." />
          </div>
        </div>

        <Separator />

        {/* ── BLOQUE: Observaciones ────────────────────── */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Observaciones internas</h3>
          <Textarea value={form.observaciones} onChange={(e) => updateField("observaciones", e.target.value)} className="min-h-[60px]" placeholder="Notas internas sobre este puesto..." />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button className="gap-1.5" onClick={handleSave}>
            <Save className="h-4 w-4" /> {rol ? "Guardar cambios" : "Crear puesto y vacante"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export function PuestosEmpresaTab() {
  const { empresaActual } = useEmpresa();
  const roles = useMemo(() => getRolesPorEmpresa(empresaActual.id), [empresaActual.id]);

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRol, setEditingRol] = useState<RolEmpresa | null>(null);

  const filtered = useMemo(() => {
    if (!search) return roles;
    const s = search.toLowerCase();
    return roles.filter((r) => `${r.nombre} ${r.departamento} ${r.responsable}`.toLowerCase().includes(s));
  }, [roles, search]);

  const estadoColor: Record<string, string> = {
    activo: "bg-emerald-100 text-emerald-700",
    inactivo: "bg-muted text-muted-foreground",
    pendiente: "bg-amber-100 text-amber-700",
  };

  const handleNew = () => { setEditingRol(null); setModalOpen(true); };
  const handleEdit = (r: RolEmpresa) => { setEditingRol(r); setModalOpen(true); };
  const handleSave = (r: RolEmpresa) => {
    toast.success(`Puesto "${r.nombre}" guardado`, {
      description: "La vacante asociada se ha generado/actualizado automáticamente en Reclutamiento.",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">PUESTOS DE EMPRESA</h3>
        <Button size="sm" className="gap-1.5" onClick={handleNew}>
          <Plus className="h-4 w-4" /> Nuevo puesto
        </Button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Al crear un nuevo puesto, el sistema generará automáticamente una nueva vacante en Recursos Humanos → Reclutamiento
          </p>
          <p className="text-xs text-muted-foreground">
            Cada puesto incluye un bloque de datos de vacante que se utiliza para el proceso de selección. Los candidatos se gestionan desde RRHH → Reclutamiento.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar puesto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <span className="text-xs text-muted-foreground">{roles.length} puestos · {empresaActual.nombre}</span>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Puesto</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Vacante</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  No se encontraron puestos
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleEdit(r)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">{r.nombre}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.departamento}</TableCell>
                <TableCell className="text-muted-foreground">{r.responsable}</TableCell>
                <TableCell className="text-muted-foreground">{r.ubicacion}</TableCell>
                <TableCell className="text-muted-foreground">{TIPO_CONTRATO_LABELS[r.tipoContrato]}</TableCell>
                <TableCell>
                  <Badge className={`text-[11px] border-0 ${estadoColor[r.estado] || ""}`}>{ESTADO_ROL_LABELS[r.estado]}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {ESTADO_PUBLICACION_LABELS[r.vacante.estadoPublicacion as EstadoPublicacion]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Form Modal */}
      <RolFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        rol={editingRol}
        empresaId={empresaActual.id}
        onSave={handleSave}
      />
    </div>
  );
}
