import Link from "next/link";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  FileSignature,
  UserPlus,
  Users,
} from "lucide-react";
import { getRrhhDashboard } from "@/features/rrhh/actions/dashboard-actions";

const metricToneClass = {
  default: "text-foreground",
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
  blue: "text-blue-600 dark:text-blue-400",
};

const alertToneClass = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
  amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
  red: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100",
  blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100",
};

const modules = [
  {
    href: "/rrhh/empleados",
    icon: Users,
    title: "Empleados",
    description: "Alta, estados, pertenencia multiempresa y ficha laboral.",
  },
  {
    href: "/rrhh/fichajes",
    icon: CalendarClock,
    title: "Fichajes",
    description: "Supervisión, cierre manual e incidencias de jornada.",
  },
  {
    href: "/rrhh/horarios",
    icon: ClipboardList,
    title: "Horarios",
    description: "Patrones, turnos, descansos y tipos de ausencia.",
  },
  {
    href: "/rrhh/solicitudes",
    icon: BadgeCheck,
    title: "Solicitudes",
    description: "Revisión de vacaciones, permisos y trabajo extra.",
  },
  {
    href: "/rrhh/firmas",
    icon: FileSignature,
    title: "Firmas",
    description: "Documentos, tokens, expiración y trazabilidad.",
  },
  {
    href: "/rrhh/reclutamiento",
    icon: BriefcaseBusiness,
    title: "Reclutamiento",
    description: "Vacantes, candidatos, pipeline y promoción a empleado.",
  },
];

function formatDate(value: string): string {
  if (!value) return "Sin fecha";
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export default async function RRHHPage() {
  const dashboard = await getRrhhDashboard();
  const metrics = Object.values(dashboard.metrics);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Recursos Humanos</h1>
            <p className="text-sm text-muted-foreground">
              Cuadro operativo{dashboard.empresaNombre ? ` · ${dashboard.empresaNombre}` : ""}
            </p>
          </div>
        </div>
        <Link
          href="/rrhh/empleados/nuevo"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:ml-auto"
        >
          <UserPlus className="h-4 w-4" />
          Alta empleado
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border bg-card p-4">
            <div className={`text-3xl font-black ${metricToneClass[metric.tone]}`}>
              {metric.value}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {metric.label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {dashboard.alerts.map((alert) => (
          <Link
            key={alert.title}
            href={alert.href}
            className={`rounded-lg border p-3 transition-colors hover:brightness-95 ${alertToneClass[alert.tone]}`}
          >
            <div className="text-sm font-semibold">{alert.title}</div>
            <div className="mt-1 text-xs opacity-80">{alert.detail}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Módulos operativos
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {modules.map(({ href, icon: Icon, title, description }) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{title}</span>
                </div>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
              </Link>
            ))}
          </div>
        </section>

        <aside className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Altas recientes
            </h2>
            <Link href="/rrhh/empleados" className="text-xs font-medium text-primary hover:underline">
              Ver empleados
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {dashboard.recentEmployees.length > 0 ? (
              dashboard.recentEmployees.map((employee) => (
                <Link
                  key={employee.id}
                  href={`/rrhh/empleados/${employee.id}`}
                  className="block rounded-md border p-3 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{employee.nombre}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{employee.puesto}</div>
                    </div>
                    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {employee.estado}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Alta: {formatDate(employee.fechaAlta)}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No hay altas recientes para la empresa activa.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
