import { useState } from "react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Rol } from "@/data/ajustes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, Info, AlertTriangle } from "lucide-react";

export function RolesTab() {
  const { ajustes, setAjustes } = useEmpresa();
  const [expandedRol, setExpandedRol] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">ROLES Y PERMISOS</h3>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo rol
        </Button>
      </div>

      {/* Info banner: auto-generation notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Vinculación automática con Reclutamiento</p>
          <p className="text-sm text-muted-foreground">
            Al crear un nuevo rol, el sistema generará automáticamente una nueva vacante en <strong>Recursos Humanos → Reclutamiento</strong>.
            Cada rol está vinculado a su vacante correspondiente. No es posible crear vacantes sin un rol asociado.
          </p>
        </div>
      </div>

      {ajustes.roles.map((rol) => {
        const isOpen = expandedRol === rol.id;
        return (
          <Card key={rol.id}>
            <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setExpandedRol(isOpen ? null : rol.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <CardTitle className="text-sm">{rol.nombre}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{rol.descripcion}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{rol.permisos.filter((p) => p.editar).length}/{rol.permisos.length} módulos editables</span>
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
    </div>
  );
}