import { useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Rol } from "@/features/ajustes/data/ajustes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Plus, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

const MODULOS = ["Dashboard", "Gerencia", "Contabilidad", "Gestoría", "Jurídico", "RRHH", "Logística", "Marketing", "Mantenimiento", "Ajustes"];

export function RolesTab() {
  const { ajustes, setAjustes } = useEmpresa();
  const [expandedRol, setExpandedRol] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoDesc, setNuevoDesc] = useState("");

  const togglePermiso = (rolId: string, modulo: string, campo: "ver" | "editar") => {
    setAjustes((prev) => ({
      ...prev,
      roles: prev.roles.map((r) =>
        r.id === rolId
          ? { ...r, permisos: r.permisos.map((p) => p.modulo === modulo ? { ...p, [campo]: !p[campo] } : p) }
          : r
      ),
    }));
  };

  const crearRol = () => {
    if (!nuevoNombre.trim()) return;
    const nuevoRol: Rol = {
      id: `rol-${Date.now()}`,
      nombre: nuevoNombre.trim(),
      descripcion: nuevoDesc.trim() || `Rol personalizado`,
      permisos: MODULOS.map((m) => ({ modulo: m, ver: false, editar: false })),
    };
    setAjustes((prev) => ({ ...prev, roles: [...prev.roles, nuevoRol] }));
    setNuevoNombre("");
    setNuevoDesc("");
    setShowCreateModal(false);
    setExpandedRol(nuevoRol.id);
    toast.success(`Rol "${nuevoRol.nombre}" creado. Configura sus permisos.`);
  };

  const eliminarRol = (rolId: string, nombre: string) => {
    if (nombre === "Dirección") {
      toast.error("No se puede eliminar el rol de Dirección");
      return;
    }
    if (!confirm(`¿Eliminar el rol "${nombre}"?`)) return;
    setAjustes((prev) => ({ ...prev, roles: prev.roles.filter((r) => r.id !== rolId) }));
    toast.success(`Rol "${nombre}" eliminado`);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />Nuevo
        </Button>
      </div>

      {ajustes.roles.map((rol) => {
        const isOpen = expandedRol === rol.id;
        return (
          <Card key={rol.id}>
            <CardHeader className="py-2 px-4 cursor-pointer" onClick={() => setExpandedRol(isOpen ? null : rol.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <CardTitle className="text-sm">{rol.nombre}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{rol.descripcion}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{rol.permisos.filter((p) => p.editar).length}/{rol.permisos.length} módulos editables</span>
                  {rol.nombre !== "Dirección" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); eliminarRol(rol.id, rol.nombre); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {isOpen && (
              <CardContent className="pt-0 px-4 pb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs font-bold text-muted-foreground">MÓDULO</th>
                      <th className="text-center py-2 text-xs font-bold text-muted-foreground w-24">VER</th>
                      <th className="text-center py-2 text-xs font-bold text-muted-foreground w-24">EDITAR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rol.permisos.map((p) => (
                      <tr key={p.modulo} className="border-b last:border-0">
                        <td className="py-2 font-medium">{p.modulo}</td>
                        <td className="py-2 text-center"><Switch checked={p.ver} onCheckedChange={() => togglePermiso(rol.id, p.modulo, "ver")} /></td>
                        <td className="py-2 text-center"><Switch checked={p.editar} onCheckedChange={() => togglePermiso(rol.id, p.modulo, "editar")} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        );
      })}

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo rol</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label className="text-xs font-bold">Nombre del rol</Label>
              <Input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Ej: Encargado de sala" />
            </div>
            <div>
              <Label className="text-xs font-bold">Descripción</Label>
              <Input value={nuevoDesc} onChange={(e) => setNuevoDesc(e.target.value)} placeholder="Ej: Gestión de sala y reservas" />
            </div>
            <p className="text-xs text-muted-foreground">El rol se creará sin permisos. Configúralos después expandiendo el rol.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
              <Button onClick={crearRol} disabled={!nuevoNombre.trim()}>Crear rol</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}