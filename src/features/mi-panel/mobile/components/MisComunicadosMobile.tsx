"use client";

import { useEffect, useState } from "react";
import { Loader2, ChevronRight, X, Megaphone, Paperclip, Link as LinkIcon, Check } from "lucide-react";
import {
  listarComunicadosVisibles,
  type ComunicadoVisible,
} from "@/features/mi-panel/actions/mi-panel-actions";
import { marcarComunicadosVistos } from "@/features/mi-panel/actions/comunicados-vistos-actions";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  agruparComunicadosPorTiempo,
  GRUPO_COMUNICADO_LABEL,
  hace,
} from "@/features/mi-panel/lib/comunicados-tiempo";
import { cn } from "@/shared/lib/utils";
import { TextoConEnlaces } from "@/shared/components/TextoConEnlaces";
import {
  TIPO_COMUNICADO_LABEL,
  tipoComunicado,
  type TipoComunicado,
} from "@/features/rrhh/data/comunicados";
import {
  tamanoLegible,
  urlAdjuntoComunicado,
} from "@/features/gerencia/data/comunicados-adjuntos";

/**
 * Cada tipo con su color: urgente rojo, novedades amarillo, informativo verde
 * y la sanción en rojo fuerte, el recuadro entero.
 */
const TIPO_STYLE: Record<TipoComunicado, { dot: string; tint: string; pill: string }> = {
  urgente: {
    dot: "bg-rose-500",
    tint: "border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20",
    pill: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
  novedades: {
    dot: "bg-amber-400",
    tint: "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  informativo: {
    dot: "bg-emerald-500",
    tint: "border-border/60 bg-card",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  sancion: {
    dot: "bg-red-600",
    tint: "border-red-500 bg-red-50 dark:border-red-700 dark:bg-red-950/30",
    pill: "bg-red-600 text-white dark:bg-red-700 dark:text-white",
  },
};

function formatFull(s: string, tz: string): string {
  return formatFechaHoraEnZona(s, tz, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: undefined,
  });
}

export function MisComunicadosMobile() {
  const [items, setItems] = useState<ComunicadoVisible[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ComunicadoVisible | null>(null);

  useEffect(() => {
    let cancel = false;
    listarComunicadosVisibles().then((res) => {
      if (cancel) return;
      setItems(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Megaphone className="mb-2 h-8 w-8" />
        <p className="text-sm font-medium">Sin comunicados</p>
        <p className="mt-0.5 text-xs">No hay anuncios publicados por ahora.</p>
      </div>
    );
  }

  const tz = items[0]?.zonaHoraria ?? "Europe/Madrid";
  const grupos = agruparComunicadosPorTiempo(items, (c) => c.createdAt, tz);

  return (
    <>
      <div className="space-y-5">
        {grupos.map((g, gi) => (
          <section key={`${g.clave}-${gi}`} className="space-y-2">
            {/* La barra que dice de cuándo es lo que viene debajo. */}
            <div className="flex items-center gap-3">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {GRUPO_COMUNICADO_LABEL[g.clave]}
              </h2>
              <span className="h-px flex-1 bg-border" />
            </div>
            <ul className="space-y-2">
              {g.lista.map((c) => {
                const tipo = tipoComunicado(c.tipo);
                const style = TIPO_STYLE[tipo];
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(c);
                        // Abrirlo es haberlo leído: así el alcance dice la verdad.
                        void marcarComunicadosVistos([c.id]);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left active:opacity-70",
                        style.tint,
                      )}
                    >
                      <span
                        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", style.dot)}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="truncate text-sm font-semibold">{c.titulo}</h3>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {hace(c.createdAt, c.zonaHoraria)}
                          </span>
                        </div>
                        {/* El tipo se lee siempre, lo haya abierto o no: «Nuevo» es otra cosa. */}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              style.pill,
                            )}
                          >
                            {TIPO_COMUNICADO_LABEL[tipo]}
                          </span>
                          {!c.vistoEl && (
                            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                              Nuevo
                            </span>
                          )}
                        </div>
                        {c.contenido && (
                          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                            {c.contenido}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {selected && (
        <ComunicadoDetalle
          comunicado={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function ComunicadoDetalle({
  comunicado,
  onClose,
}: {
  comunicado: ComunicadoVisible;
  onClose: () => void;
}) {
  const tipo = tipoComunicado(comunicado.tipo);
  const style = TIPO_STYLE[tipo];

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border/60 px-3 pt-[max(env(safe-area-inset-top),10px)] pb-3">
        <button
          type="button"
          onClick={onClose}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", style.dot)} />
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", style.pill)}>
            {TIPO_COMUNICADO_LABEL[tipo]}
          </span>
        </div>
      </header>

      {/* El comunicado lo firma la empresa: se abre con su marca, igual que
          cuando llega por correo. El disco claro hace visible un isotipo de
          trazo fino, que suelto se pierde. */}
      <div className="flex flex-col items-center gap-2 border-b border-border/60 px-5 pb-5 pt-2">
        {comunicado.isotipoUrl ? (
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-border/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={comunicado.isotipoUrl}
              alt=""
              className="h-11 w-11 object-contain"
            />
          </span>
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Megaphone className="h-7 w-7" />
          </span>
        )}
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Comunicado oficial
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <h1 className="text-center text-2xl font-semibold leading-tight">{comunicado.titulo}</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {comunicado.empresaNombre ? `${comunicado.empresaNombre} · ` : ""}
          <span className="capitalize">
            {formatFull(comunicado.createdAt, comunicado.zonaHoraria)}
          </span>
        </p>
        {comunicado.contenido && (
          <article className="mt-5 whitespace-pre-line text-base leading-relaxed text-foreground">
            <TextoConEnlaces texto={comunicado.contenido} />
          </article>
        )}
        {comunicado.enlace && (
          <a
            href={comunicado.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground active:opacity-80"
          >
            <LinkIcon className="h-4 w-4" />
            {(comunicado.enlaceTexto ?? "").trim() || "Abrir enlace"}
          </a>
        )}
        {comunicado.vistoEl && (
          <p className="mt-6 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Visto el {formatFull(comunicado.vistoEl, comunicado.zonaHoraria)}
          </p>
        )}
        {comunicado.adjuntos.length > 0 && (
          <div className="mt-6 space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              {comunicado.adjuntos.length === 1 ? "Documento adjunto" : "Documentos adjuntos"}
            </p>
            {comunicado.adjuntos.map((a, i) => (
              <a
                key={a.path}
                href={urlAdjuntoComunicado(a.path)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-sm active:bg-muted"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {comunicado.titulo}
                  {comunicado.adjuntos.length > 1 ? ` ${i + 1}` : ""}
                </span>
                {a.size > 0 && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {tamanoLegible(a.size)}
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
