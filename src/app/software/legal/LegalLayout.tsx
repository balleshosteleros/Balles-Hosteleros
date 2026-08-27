import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Marco visual común de las cuatro páginas legales.
 *
 * Vive aquí y no en `layout.tsx` porque cada página necesita exportar sus
 * propios `metadata` (título distinto por página), y un layout de Next no
 * puede variar el título por hijo.
 */

/** Fecha de última revisión. Se muestra en las cuatro páginas y Google la pide. */
export const ULTIMA_ACTUALIZACION = "27 de agosto de 2026";

const paginas = [
  { href: "/legal/aviso-legal", label: "Aviso legal" },
  { href: "/legal/privacidad", label: "Privacidad" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/terminos", label: "Términos" },
];

export function LegalLayout({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0b1120] text-white antialiased">
      <header className="border-b border-white/10 bg-[#0a1d4a] px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/software"
            className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Balles Hosteleros
          </Link>
        </div>
      </header>

      <main className="px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {titulo}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            {descripcion}
          </p>
          <p className="mt-6 text-xs text-slate-500">
            Última actualización: {ULTIMA_ACTUALIZACION}
          </p>

          <div className="legal-contenido mt-10 space-y-8">{children}</div>

          <nav className="mt-16 border-t border-white/10 pt-8">
            <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Documentos legales
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500">
              {paginas.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="hover:text-slate-300">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
    </div>
  );
}

/** Bloque de sección: título + cuerpo, con el espaciado unificado. */
export function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white">{titulo}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-400">
        {children}
      </div>
    </section>
  );
}

/** Lista con viñetas del mismo tono que el cuerpo de texto. */
export function Lista({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i} className="list-disc text-sm leading-relaxed text-slate-400">
          {item}
        </li>
      ))}
    </ul>
  );
}
