import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Layers, Mail, Phone, MapPin, CalendarDays } from "lucide-react";

export function ResumenGeneral() {
  const { ajustes, empresaActual } = useEmpresa();
  const d = ajustes.datosGenerales;

  const cards = [
    { label: "Empresa", value: d.nombreComercial || empresaActual.nombre, icon: Building2, color: "text-primary" },
    { label: "Usuarios con acceso", value: String(ajustes.usuarios.length), icon: Users, color: "text-blue-500" },
    { label: "Departamentos", value: String(ajustes.departamentos.filter((dp) => dp.estado === "Activo").length), icon: Layers, color: "text-purple-500" },
    { label: "Correo principal", value: d.correoGeneral || "Sin configurar", icon: Mail, color: "text-orange-500" },
    { label: "Teléfono principal", value: d.telefonoPrincipal || "Sin configurar", icon: Phone, color: "text-teal-500" },
    { label: "Dirección", value: d.direccionLocal || "Sin configurar", icon: MapPin, color: "text-rose-500" },
    { label: "Última actualización", value: ajustes.auditoria.length > 0 ? ajustes.auditoria[ajustes.auditoria.length - 1].fecha : "—", icon: CalendarDays, color: "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4 flex items-start gap-3">
            <c.icon className={`h-5 w-5 mt-0.5 shrink-0 ${c.color}`} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{c.label}</p>
              <p className="text-sm font-semibold text-foreground truncate">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
