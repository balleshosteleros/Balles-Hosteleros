import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, Briefcase, Building } from "lucide-react";
import { ESTADOS_COLOR, ESTADOS_LABEL, type EmpleadoUI } from "@/features/rrhh/components/empleados/empleado-ui";
import { EmpresaBadge } from "@/shared/components/EmpresaBadge";

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

/** Dato de cabecera. Se omite entero cuando no hay valor, para no dejar guiones sueltos. */
function Dato({ icon, valor }: { icon: React.ReactNode; valor?: string | null }) {
  if (!valor || valor === "—") return null;
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
      <span className="text-muted-foreground/60 shrink-0">{icon}</span>
      <span className="truncate">{valor}</span>
    </span>
  );
}

export function FichaEmpleadoHeader({ empleado, onBack, empresas = [] }: Props) {
  const iniciales = ((empleado.nombre[0] ?? "") + (empleado.apellidos[0] ?? "")).toUpperCase();
  const trabajo = [empleado.puesto, empleado.departamento].filter((v) => v && v !== "—").join(" · ");

  return (
    <div className="border-b bg-card px-4 py-3 md:px-6 shrink-0">
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <Avatar className="h-16 w-16 shrink-0 border-2 border-background ring-2 ring-border">
          {empleado.avatar ? (
            <AvatarImage
              src={empleado.avatar}
              alt={`${empleado.nombre} ${empleado.apellidos}`}
              className="object-cover"
            />
          ) : null}
          <AvatarFallback
            className="text-xl font-bold text-white"
            style={{ backgroundColor: avatarColor(empleado.id) }}
          >
            {iniciales}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg md:text-xl font-bold text-foreground truncate">
              {empleado.nombre} {empleado.apellidos}
            </h2>
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 shrink-0">
              <span className={`h-1.5 w-1.5 rounded-full ${ESTADOS_COLOR[empleado.estado]}`} />
              <span className="text-xs text-muted-foreground">{ESTADOS_LABEL[empleado.estado]}</span>
            </span>
            {empresas.map((e) => (
              <EmpresaBadge key={e.id} nombre={e.nombre} />
            ))}
          </div>

          {/* Datos de contacto y trabajo en la propia cabecera: evita bajar a
              buscarlos en el formulario para una consulta rápida. */}
          <div className="mt-1 flex items-center gap-x-4 gap-y-0.5 flex-wrap">
            <Dato icon={<Briefcase className="h-3.5 w-3.5" />} valor={trabajo} />
            <Dato icon={<Phone className="h-3.5 w-3.5" />} valor={empleado.telefono} />
            <Dato
              icon={<Mail className="h-3.5 w-3.5" />}
              valor={empleado.emailEmpresa || empleado.emailPersonal}
            />
            <Dato icon={<Building className="h-3.5 w-3.5" />} valor={empleado.horarioTipo} />
          </div>
        </div>
      </div>
    </div>
  );
}
