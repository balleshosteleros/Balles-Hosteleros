import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera } from "lucide-react";
import { ESTADOS_COLOR, ESTADOS_LABEL, type EmpleadoUI } from "@/features/rrhh/components/empleados/empleado-ui";

const AVATAR_COLORS = [
  "hsl(var(--primary))", "hsl(25 80% 55%)", "hsl(280 60% 55%)", "hsl(160 55% 42%)",
  "hsl(340 65% 50%)", "hsl(200 70% 50%)", "hsl(45 80% 48%)", "hsl(0 65% 50%)",
];

function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

interface Props {
  empleado: EmpleadoUI;
  onBack: () => void;
  empresas?: { id: string; nombre: string }[];
}

export function FichaEmpleadoHeader({ empleado, onBack, empresas = [] }: Props) {
  const iniciales = (empleado.nombre[0] + (empleado.apellidos[0] ?? "")).toUpperCase();

  return (
    <div className="flex items-center justify-between border-b bg-card px-6 py-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative group">
          <Avatar className="h-14 w-14 border-2 border-muted">
            <AvatarFallback className="text-lg font-bold text-white" style={{ backgroundColor: avatarColor(empleado.id) }}>
              {iniciales}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <Camera className="h-4 w-4 text-white" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{empleado.nombre} {empleado.apellidos}</h2>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${ESTADOS_COLOR[empleado.estado]}`} />
              <span className="text-sm text-muted-foreground">{ESTADOS_LABEL[empleado.estado]}</span>
            </div>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">{empleado.departamento}</span>
            {empresas.map((e) => (
              <span
                key={e.id}
                className="text-xs px-2 py-0.5 rounded font-medium bg-muted text-foreground"
              >
                {e.nombre}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
