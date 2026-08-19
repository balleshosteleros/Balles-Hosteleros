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
  Euro,
  Scale,
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
  { href: "/m/pagos", label: "Pagos", icon: Euro, hue: 192 },
  { href: "/m/documentos", label: "Documentos", icon: Files, hue: 192 },
  { href: "/m/solicitudes", label: "Solicitudes", icon: Inbox, hue: 192 },
  { href: "/m/igualdad", label: "Igualdad", icon: Scale, hue: 231 },
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
    // `cqi` = 1% del ancho de ESTE contenedor (lo habilita `containerType`).
    // Es lo que arregla que en móviles anchos (Android de 720px) los cuadros
    // salieran enormes con el icono diminuto en medio: el cuadro escalaba con
    // la pantalla pero el icono era fijo (`h-11 w-11`) y el texto `text-xs`.
    // Ahora todo crece a la vez y la proporción se ve igual en cualquier
    // teléfono (Iván, 07-ago). Va en estilo inline porque el proyecto usa
    // Tailwind 3.4 SIN el plugin de container queries: la clase `@container`
    // no generaría ninguna regla.
    // COLUMNAS: siempre 3 en cualquier teléfono (decisión de Iván, 07-ago: el
    // móvil ancho de un empleado debe verse igual que el suyo, no con 4 en
    // fila). A partir de tablet sí se añaden columnas, porque ahí sobra ancho y
    // con 3 quedaban cuadros enormes en una banda estrecha.
    <div
      className="grid grid-cols-3 gap-2.5 px-5 pt-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      style={{ containerType: "inline-size" }}
    >
      {ITEMS.map((it) => {
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className="group relative flex aspect-square flex-col items-center justify-center gap-[4cqi] overflow-hidden rounded-2xl border text-center font-medium shadow-sm transition-all active:scale-[0.97]"
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
            {/* Medidas en `cqi` (proporcionales al ancho de la rejilla) con
                `clamp` para que no se queden ridículas en pantallas estrechas
                ni desproporcionadas en tablets. */}
            <span
              className="relative flex items-center justify-center rounded-xl text-white shadow-sm"
              style={{
                width: "clamp(2.75rem, 12cqi, 4rem)",
                height: "clamp(2.75rem, 12cqi, 4rem)",
                background: `linear-gradient(145deg, hsl(${it.hue} 75% 58%) 0%, hsl(${it.hue} 70% 46%) 100%)`,
                boxShadow: `0 3px 10px -2px hsl(${it.hue} 70% 45% / 0.5)`,
              }}
            >
              <Icon
                className="h-1/2 w-1/2"
                strokeWidth={2.1}
              />
            </span>
            <span
              className="relative px-1 leading-tight"
              style={{
                color: `hsl(${it.hue} 45% 28%)`,
                fontSize: "clamp(0.75rem, 3.2cqi, 0.95rem)",
              }}
            >
              {it.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
