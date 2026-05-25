import { useEffect, useState } from "react";
import { useEmpresa, type Empresa } from "@/features/empresa/contexts/empresa-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Building2, Plus, Trash2, Image, Info, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ConfiguracionTab } from "@/features/ajustes/components/ConfiguracionTab";
import { LocalesEmpresaTab } from "@/features/ajustes/components/locales/LocalesEmpresaTab";

interface EmpresaFormData {
  nombre: string;
  iniciales: string;
  color: string;
}

const EMPTY_FORM: EmpresaFormData = {
  nombre: "",
  iniciales: "",
  color: "hsl(210 70% 50%)",
};

export function EmpresasTab() {
  // Avatar 40x40 = ISOTIPO (icono sin texto). Fallback al logotipo si no hay isotipo.
  const { empresas, empresaActual, addEmpresa, deleteEmpresa, getIsotipoUrl, setEmpresaId } = useEmpresa();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EmpresaFormData>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Empresa | null>(null);
  const [editTarget, setEditTarget] = useState<Empresa | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const openEdit = (emp: Empresa) => {
    if (emp.id !== empresaActual.id) setEmpresaId(emp.id);
    setEditTarget(emp);
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
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

    const id = form.nombre.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    addEmpresa({
      id,
      nombre: form.nombre.toUpperCase(),
      iniciales: form.iniciales.toUpperCase().slice(0, 2),
      color: form.color,
    });
    toast.success("Nueva empresa creada. Se ha generado toda la estructura base.");
    setModalOpen(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === empresaActual.id) {
      toast.error("No puedes borrar la empresa activa");
      setDeleteTarget(null);
      return;
    }
    deleteEmpresa(deleteTarget.id);
    toast.success(`Empresa "${deleteTarget.nombre}" eliminada`);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="h-4 w-4" />Nuevo
        </Button>
      </div>

      <div className="grid gap-3">
        {empresas.map((emp) => {
          const logoUrl = mounted ? getIsotipoUrl(emp.id) : "";
          return (
            <Card key={emp.id} className={emp.id === empresaActual.id ? "border-primary/40 shadow-sm" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt={emp.nombre}
                        className="h-10 w-10 rounded-lg object-contain bg-muted/40 border shrink-0"
                      />
                    ) : (
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0"
                        style={{ backgroundColor: emp.color }}
                      >
                        {emp.iniciales}
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-foreground">{emp.nombre}</h4>
                      <p className="text-xs text-muted-foreground">ID: {emp.id}</p>
                    </div>
                    {emp.id === empresaActual.id && (
                      <Badge variant="default" className="text-[10px]">Activa</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => openEdit(emp)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(emp)}
                      disabled={emp.id === empresaActual.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Borrar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal nueva empresa */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Nueva empresa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Crear empresa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal editar empresa (toda la configuración) */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Editar empresa — {editTarget?.nombre}
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              <ConfiguracionTab />
              <LocalesEmpresaTab empresaId={editTarget.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmación borrar */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.nombre}</strong> y todos sus datos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
