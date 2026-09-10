"use client";

/**
 * El tablero: una columna por fase, y dentro las tarjetas.
 *
 * La tarjeta se arrastra entera (no hay asa lateral) y al soltarla en otra
 * columna cambia de fase. Es el mismo gesto que ya se usa en el kanban de
 * reclutamiento, para no tener dos formas de mover una tarjeta en el software.
 */
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageCircle,
  Phone,
  StickyNote,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatEur } from "@/shared/lib/numero";
import { telefonoHref, whatsappHref } from "@/shared/lib/telefono";
import type { Oportunidad, PipelineFase } from "../types";
import { OPORTUNIDAD_ESTADO_CLASE as ESTADO_CLASE, OPORTUNIDAD_ESTADO_LABEL } from "../types";

/** Colores del estado. Abierta no pinta nada: es lo normal, no una etiqueta. */

/** Días que lleva la tarjeta parada en su columna. */
function diasEnFase(desde: string): number | null {
  const t = new Date(desde).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function OportunidadCard({
  oportunidad,
  onDragStart,
  onClick,
}: {
  oportunidad: Oportunidad;
  onDragStart: (e: React.DragEvent, o: Oportunidad) => void;
  onClick: (o: Oportunidad) => void;
}) {
  const o = oportunidad;
  const dias = diasEnFase(o.fase_at);
  const hrefLlamada = telefonoHref(o.telefono);
  const hrefWhatsapp = whatsappHref(o.telefono);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, o)}
      onClick={() => onClick(o)}
      className={cn(
        "relative rounded-lg border p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
        o.estado === "GANADA"
          ? "bg-emerald-500/5 border-emerald-500/30"
          : "bg-card border-border",
      )}
    >
      <div className="flex items-start gap-1.5">
        <span className="flex-1 min-w-0 font-semibold text-xs text-foreground break-words leading-snug">
          {o.nombre}
        </span>
        {o.estado !== "ABIERTA" && (
          <Badge
            variant="outline"
            className={cn("shrink-0 h-4 px-1.5 text-[9px] font-semibold", ESTADO_CLASE[o.estado])}
          >
            {OPORTUNIDAD_ESTADO_LABEL[o.estado]}
          </Badge>
        )}
      </div>

      <dl className="mt-1.5 space-y-0.5 text-[11px]">
        <div className="flex gap-1.5 min-w-0">
          <dt className="text-muted-foreground shrink-0">Fuente:</dt>
          <dd className="truncate text-foreground/80">{o.fuente || "—"}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground shrink-0">Valor:</dt>
          <dd className="text-foreground/80 tabular-nums">{formatEur(o.valor)}</dd>
        </div>
      </dl>

      {/* Fila de accesos: solo se pinta el icono que lleva a algún sitio. Un
          icono apagado que no hace nada confunde más de lo que informa. */}
      <div className="mt-1.5 flex items-center gap-2 text-muted-foreground">
        {hrefLlamada && (
          <a
            href={hrefLlamada}
            onClick={(e) => e.stopPropagation()}
            title={`Llamar a ${o.telefono}`}
            aria-label={`Llamar a ${o.telefono}`}
            className="hover:text-foreground"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
        {hrefWhatsapp && (
          <a
            href={hrefWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Abrir WhatsApp"
            aria-label="Abrir WhatsApp"
            className="hover:text-foreground"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
        {o.email && (
          <a
            href={`mailto:${o.email}`}
            onClick={(e) => e.stopPropagation()}
            title={o.email}
            aria-label={`Escribir a ${o.email}`}
            className="hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" />
          </a>
        )}
        {o.etiquetas.length > 0 && (
          <span
            className="inline-flex items-center gap-0.5 tabular-nums"
            title={o.etiquetas.join(", ")}
          >
            <Tag className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold">{o.etiquetas.length}</span>
          </span>
        )}
        {o.notas && (
          <span title="Tiene notas">
            <StickyNote className="h-3.5 w-3.5" />
          </span>
        )}
        {dias !== null && (
          <span
            className="ml-auto text-[10px] tabular-nums"
            title="Días en esta fase"
          >
            {dias === 0 ? "hoy" : `${dias} d`}
          </span>
        )}
      </div>
    </div>
  );
}

function Columna({
  fase,
  oportunidades,
  plegada,
  onPlegar,
  onDragStart,
  onDrop,
  onCardClick,
}: {
  fase: PipelineFase;
  oportunidades: Oportunidad[];
  plegada: boolean;
  onPlegar: () => void;
  onDragStart: (e: React.DragEvent, o: Oportunidad) => void;
  onDrop: (faseId: string) => void;
  onCardClick: (o: Oportunidad) => void;
}) {
  const [encima, setEncima] = useState(false);
  const total = oportunidades.reduce((s, o) => s + Number(o.valor ?? 0), 0);

  if (plegada) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 rounded-lg border bg-muted/30 py-2">
        <button
          type="button"
          onClick={onPlegar}
          title="Desplegar la fase"
          aria-label="Desplegar la fase"
          className="text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
          {oportunidades.length}
        </span>
        <span className="[writing-mode:vertical-rl] text-[11px] text-muted-foreground">
          {fase.nombre}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Las fases se reparten el ancho para que el tablero entero quepa en
        // pantalla sin arrastrar de lado. El mínimo evita columnas ilegibles
        // cuando el pipeline tiene muchas fases: ahí sí vuelve el desplazamiento.
        "flex min-w-[190px] flex-1 basis-0 flex-col rounded-lg border transition-colors",
        encima ? "bg-primary/5 ring-1 ring-primary/30" : "bg-muted/30",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        onDrop(fase.id);
      }}
    >
      <div className="flex items-start gap-1.5 border-b px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {fase.icono && <span aria-hidden>{fase.icono}</span>}
            <span className="truncate text-xs font-semibold text-foreground">{fase.nombre}</span>
          </div>
          <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
            {oportunidades.length} oportunidades · {formatEur(total)}
          </div>
        </div>
        <button
          type="button"
          onClick={onPlegar}
          title="Plegar la fase"
          aria-label="Plegar la fase"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1 px-1.5 py-1.5" style={{ maxHeight: "calc(100vh - 300px)" }}>
        <div className="space-y-1.5 min-h-[40px]">
          {oportunidades.map((o) => (
            <OportunidadCard
              key={o.id}
              oportunidad={o}
              onDragStart={onDragStart}
              onClick={onCardClick}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function PipelineBoard({
  fases,
  porFase,
  onMover,
  onAbrir,
}: {
  fases: PipelineFase[];
  /** Tarjetas ya filtradas y ordenadas, agrupadas por fase. */
  porFase: Map<string, Oportunidad[]>;
  onMover: (oportunidad: Oportunidad, faseId: string) => void;
  onAbrir: (oportunidad: Oportunidad) => void;
}) {
  const [arrastrada, setArrastrada] = useState<Oportunidad | null>(null);
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());

  const alternarPlegada = (faseId: string) => {
    setPlegadas((previas) => {
      const copia = new Set(previas);
      if (copia.has(faseId)) copia.delete(faseId);
      else copia.add(faseId);
      return copia;
    });
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {fases.map((fase) => (
        <Columna
          key={fase.id}
          fase={fase}
          oportunidades={porFase.get(fase.id) ?? []}
          plegada={plegadas.has(fase.id)}
          onPlegar={() => alternarPlegada(fase.id)}
          onDragStart={(e, o) => {
            setArrastrada(o);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDrop={(faseId) => {
            if (arrastrada && arrastrada.fase_id !== faseId) onMover(arrastrada, faseId);
            setArrastrada(null);
          }}
          onCardClick={onAbrir}
        />
      ))}
    </div>
  );
}
