import Link from "next/link";
import {
  UserCircle,
  Trophy,
  CalendarDays,
  CalendarClock,
  Timer,
  Fingerprint,
  GraduationCap,
  ClipboardCheck,
  ClipboardList,
  FileQuestion,
  Inbox,
  Megaphone,
  Files,
  FileSearch,
  Network,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };
type Grupo = { titulo: string; items: Item[] };

const GRUPOS: Grupo[] = [
  {
    titulo: "Mi día",
    items: [
      { href: "/m/fichajes", label: "Fichajes", icon: Fingerprint },
      { href: "/m/cronograma", label: "Cronograma", icon: CalendarClock },
      { href: "/m/horario", label: "Horario", icon: Timer },
      { href: "/m/calendario", label: "Calendario", icon: CalendarDays },
    ],
  },
  {
    titulo: "Mi nómina",
    items: [
      { href: "/m/condiciones", label: "Condiciones", icon: ClipboardCheck },
      { href: "/m/documentos", label: "Documentos", icon: Files },
      { href: "/m/solicitudes", label: "Solicitudes", icon: Inbox },
    ],
  },
  {
    titulo: "Comunicación",
    items: [
      { href: "/m/comunicados", label: "Comunicados", icon: Megaphone },
      { href: "/m/encuestas", label: "Encuestas", icon: ClipboardList },
      { href: "/m/cuestionarios", label: "Cuestionarios", icon: FileQuestion },
      { href: "/m/inspecciones", label: "Inspecciones", icon: FileSearch },
    ],
  },
  {
    titulo: "Equipo",
    items: [
      { href: "/m/equipo", label: "Equipo", icon: Network },
      { href: "/m/formacion", label: "Formación", icon: GraduationCap },
      { href: "/m/perfil", label: "Perfil", icon: UserCircle },
      { href: "/m/points", label: "Points", icon: Trophy },
    ],
  },
];

export function MasGrid() {
  return (
    <div className="space-y-5 px-5 pt-3">
      {GRUPOS.map((grupo) => (
        <section key={grupo.titulo}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {grupo.titulo}
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            {grupo.items.map((it) => {
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card text-center text-xs font-medium active:opacity-70"
                >
                  <Icon className="h-6 w-6" strokeWidth={2} />
                  <span className="px-1 leading-tight">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
