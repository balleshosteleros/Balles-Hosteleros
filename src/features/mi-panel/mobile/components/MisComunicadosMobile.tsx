"use client";

import { useEffect, useState } from "react";
import { Loader2, ChevronRight, X, Megaphone, Paperclip, Link as LinkIcon } from "lucide-react";
import {
  listarComunicadosVisibles,
  type ComunicadoVisible,
} from "@/features/mi-panel/actions/mi-panel-actions";
import {
  formatFechaEnZona,
  formatFechaHoraEnZona,
} from "@/features/empresa/lib/zona-horaria";
import { cn } from "@/shared/lib/utils";
import {
  tamanoLegible,
  urlAdjuntoComunicado,
} from "@/features/gerencia/data/comunicados-adjuntos";

const PRIORIDAD_STYLE: Record<string, { label: string; dot: string; tint: string }> = {
  alta: { label: "Urgente", dot: "bg-rose-500", tint: "border-rose-200 bg-rose-50/40" },
  normal: { label: "Normal", dot: "bg-blue-500", tint: "border-border/60 bg-card" },
  baja: { label: "Informativo", dot: "bg-slate-400", tint: "border-border/60 bg-card" },
};

function formatRel(s: string, tz: string): string {
  const d = new Date(s);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const dias = Math.floor(hrs / 24);
  if (dias < 7) return `hace ${dias} d`;
  return formatFechaEnZona(s, tz, {
    day: "numeric",
    month: "short",
    year: undefined,
  });
}

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

  return (
    <>
      <ul className="space-y-2">
        {items.map((c) => {
          const style = PRIORIDAD_STYLE[c.prioridad] ?? PRIORIDAD_STYLE.normal;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelected(c)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left active:opacity-70",
                  style.tint,
                )}
              >
                <span
                  className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", style.dot)}
                  aria-label={style.label}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold">{c.titulo}</h3>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatRel(c.createdAt, c.zonaHoraria)}
                    </span>
                  </div>
                  {c.contenido && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
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
  const style = PRIORIDAD_STYLE[comunicado.prioridad] ?? PRIORIDAD_STYLE.normal;

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
          <span className="truncate text-xs uppercase tracking-wider text-muted-foreground">
            {style.label}
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
        <p className="mt-1 text-center text-xs capitalize text-muted-foreground">
          {formatFull(comunicado.createdAt, comunicado.zonaHoraria)}
        </p>
        {comunicado.contenido && (
          <article className="mt-5 whitespace-pre-line text-base leading-relaxed text-foreground">
            {comunicado.contenido}
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
        {comunicado.adjuntos.length > 0 && (
          <div className="mt-6 space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              {comunicado.adjuntos.length === 1 ? "Documento adjunto" : "Documentos adjuntos"}
            </p>
            {comunicado.adjuntos.map((a) => (
              <a
                key={a.path}
                href={urlAdjuntoComunicado(a.path)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-3 text-sm active:bg-muted"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{a.name}</span>
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
