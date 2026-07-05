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
  FileQuestion,
  Inbox,
  Megaphone,
  Files,
  FileSearch,
  Network,
  PackageCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Tono azulado de marca. `hue` se usa para teñir el icono y el recuadro;
 * todos viven en el rango azul→violeta para mantener el aire futurista. El
 * color agrupa visualmente los accesos afines sin necesidad de títulos.
 */
type Item = { href: string; label: string; icon: LucideIcon; hue: number };

// Mismo orden de antes, ahora en una sola rejilla plana. El `hue` agrupa por
// color: día (azul), nómina (cian), comunicación (índigo), equipo (violeta).
const ITEMS: Item[] = [
  { href: "/m/fichajes", label: "Fichajes", icon: Fingerprint, hue: 211 },
  { href: "/m/cronograma", label: "Cronograma", icon: CalendarClock, hue: 211 },
  { href: "/m/horario", label: "Horario", icon: Timer, hue: 211 },
  { href: "/m/calendario", label: "Calendario", icon: CalendarDays, hue: 211 },
  { href: "/m/condiciones", label: "Condiciones", icon: ClipboardCheck, hue: 192 },
  { href: "/m/documentos", label: "Documentos", icon: Files, hue: 192 },
  { href: "/m/solicitudes", label: "Solicitudes", icon: Inbox, hue: 192 },
  { href: "/m/albaranes", label: "Albaranes", icon: PackageCheck, hue: 192 },
  { href: "/m/comunicados", label: "Comunicados", icon: Megaphone, hue: 231 },
  { href: "/m/cuestionarios", label: "Cuestionarios", icon: FileQuestion, hue: 231 },
  { href: "/m/inspecciones", label: "Inspecciones", icon: FileSearch, hue: 231 },
  { href: "/m/equipo", label: "Equipo", icon: Network, hue: 252 },
  { href: "/m/formacion", label: "Formación", icon: GraduationCap, hue: 252 },
  { href: "/m/perfil", label: "Perfil", icon: UserCircle, hue: 252 },
  { href: "/m/points", label: "Points", icon: Trophy, hue: 252 },
];

export function MasGrid() {
  return (
    <div className="grid grid-cols-3 gap-2.5 px-5 pt-2">
      {ITEMS.map((it) => {
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className="group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border text-center text-xs font-medium shadow-sm transition-all active:scale-[0.97]"
            style={{
              borderColor: `hsl(${it.hue} 60% 60% / 0.25)`,
              background: `linear-gradient(160deg, hsl(${it.hue} 70% 97%) 0%, hsl(${it.hue} 65% 92%) 100%)`,
              boxShadow: `0 1px 8px -2px hsl(${it.hue} 60% 50% / 0.18)`,
            }}
          >
            {/* Brillo futurista superior */}
            <span
              aria-hidden
              className="pointer-events-none absolute -top-6 left-1/2 h-12 w-20 -translate-x-1/2 rounded-full blur-xl"
              style={{ background: `hsl(${it.hue} 80% 70% / 0.35)` }}
            />
            <span
              className="relative flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
              style={{
                background: `linear-gradient(145deg, hsl(${it.hue} 75% 58%) 0%, hsl(${it.hue} 70% 46%) 100%)`,
                boxShadow: `0 3px 10px -2px hsl(${it.hue} 70% 45% / 0.5)`,
              }}
            >
              <Icon className="h-5 w-5" strokeWidth={2.1} />
            </span>
            <span
              className="relative px-1 leading-tight"
              style={{ color: `hsl(${it.hue} 45% 28%)` }}
            >
              {it.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
