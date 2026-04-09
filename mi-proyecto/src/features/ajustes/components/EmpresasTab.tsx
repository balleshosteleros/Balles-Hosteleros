import { useState } from "react";
import { useEmpresa, type Empresa } from "@/features/empresa/contexts/empresa-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, Pencil, Image, Info } from "lucide-react";
import { toast } from "sonner";

interface EmpresaFormData {
  nombre: string;
  iniciales: string;
  color: string;
  activa: boolean;
  observaciones: string;
}

const EMPTY_FORM: EmpresaFormData = {
  nombre: "",
  iniciales: "",
  color: "hsl(210 70% 50%)",
  activa: true,
  observaciones: "",
};

export function EmpresasTab() {
  const { empresas, empresaActual, addEmpresa, updateEmpresa, setEmpresaId } = useEmpresa();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmpresaFormData>(EMPTY_FORM);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (e: Empresa) => {
    setEditingId(e.id);
    setForm({
      nombre: e.nombre,
      iniciales: e.iniciales,
      color: e.color,
      activa: true,
      observaciones: "",
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre de la empresa es obligatorio");
      return;
    }
    if (!form.iniciales.trim()) {
      toast.error("Las iniciales son obligatorias");
      return;
    }

    if (editingId) {
      updateEmpresa(editingId, {
        nombre: form.nombre.toUpperCase(),
        iniciales: form.iniciales.toUpperCase(),
        color: form.color,
      });
      toast.success("Empresa actualizada correctamente");
    } else {
      const id = form.nombre.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      addEmpresa({
        id,
        nombre: form.nombre.toUpperCase(),
        iniciales: form.iniciales.toUpperCase().slice(0, 2),
        color: form.color,
      });
      toast.success("Nueva empresa creada. Se ha generado toda la estructura base.");
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">GESTIÓN DE EMPRESAS</h3>
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nueva empresa
        </Button>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-primary/20 bg-primary/5">
        <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Al crear una nueva empresa, el sistema generará automáticamente toda la estructura base del SaaS con todos los módulos, submódulos y datos de ejemplo independientes.
        </p>
      </div>

      <div className="grid gap-3">
        {empresas.map((emp) => (
          <Card key={emp.id} className={emp.id === empresaActual.id ? "border-primary/40 shadow-sm" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0"
                    style={{ backgroundColor: emp.color }}
                  >
                    {emp.iniciales}
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{emp.nombre}</h4>
                    <p className="text-xs text-muted-foreground">ID: {emp.id}</p>
                  </div>
                  {emp.id === empresaActual.id && (
                    <Badge variant="default" className="text-[10px]">Activa</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => openEdit(emp)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  {emp.id !== empresaActual.id && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEmpresaId(emp.id)}>
                      Seleccionar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal crear/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editingId ? "Editar empresa" : "Nueva empresa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre comercial *</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre de la empresa"
                />
              </div>
              <div className="space-y-2">
                <Label>Iniciales (2 letras) *</Label>
                <Input
                  value={form.iniciales}
                  onChange={(e) => setForm({ ...form, iniciales: e.target.value.slice(0, 2) })}
                  placeholder="AB"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color identificativo</Label>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg border" style={{ backgroundColor: form.color }} />
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="hsl(210 70% 50%)"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Logotipo</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Image className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Arrastra o haz clic para subir el logotipo</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG o SVG. Máx. 2MB</p>
              </div>
              <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-md bg-muted/50">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Recomendación: se aconseja utilizar el isotipo o una versión simple del logotipo para una mejor visualización dentro del sistema.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Notas internas..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? "Guardar cambios" : "Crear empresa"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}