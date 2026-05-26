"use client";

import { useState } from "react";
import { Mail, MapPin, Phone, GripVertical, FileSearch, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { llamarDesdeApp } from "@/features/google-workspace/components/TelefonoDrawer";
import {
  FASES_INSPECTOR_CONFIG,
  FASES_PRINCIPALES_INSPECTOR,
  FASES_PRINCIPALES_INSPECTOR_ORDER,
  getFasePrincipalInspector,
  type FasePrincipalInspector,
} from "../data";
import type { InspectorFase, InspectorListItem } from "../types";
import { moverInspectorFase } from "../actions";

function telefonoParaWhatsapp(input: string | null | undefined): string {
  if (!input) return "";
  const limpio = input.replace(/[^\d]/g, "");
  if (limpio.length === 9 && /^[679]/.test(limpio)) return "34" + limpio;
  return limpio;
}

interface Props {
  inspectores: InspectorListItem[];
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

// ─── Inspector Card ─────────────────────────────────────────────
function InspectorCard({
  insp,
  onDragStart,
  onClick,
}: {
  insp: InspectorListItem;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: (id: string) => void;
}) {
  const inicial = `${insp.nombre?.[0] ?? ""}${insp.apellidos?.[0] ?? ""}`.toUpperCase();
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, insp.id)}
      onClick={() => onClick(insp.id)}
      className="relative bg-card border border-border rounded-lg p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group mx-auto w-full max-w-[200px]"
    >
      <GripVertical className="absolute left-0.5 top-2 h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-[10px] shrink-0">
            {inicial || "?"}
          </div>
          <span className="font-medium text-xs text-foreground truncate">
            {insp.nombre} {insp.apellidos ?? ""}
          </span>
        </div>
        <div className="space-y-0.5 text-[11px] text-muted-foreground pl-[30px]">
          {insp.telefono && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  llamarDesdeApp(insp.telefono!);
                }}
                title="Llamar desde el software"
                className="text-muted-foreground hover:text-sky-600 transition-colors"
              >
                <Phone className="h-3 w-3 shrink-0" />
              </button>
              <span className="truncate">{insp.telefono}</span>
              <a
                href={`https://wa.me/${telefonoParaWhatsapp(insp.telefono)}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Abrir WhatsApp"
                className="text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <MessageCircle className="h-3 w-3 shrink-0" />
              </a>
            </div>
          )}
          {insp.ciudad && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{insp.ciudad}</span>
            </div>
          )}
          {insp.num_inspecciones > 0 && (
            <div className="flex items-center gap-1 text-emerald-700">
              <FileSearch className="h-3 w-3 shrink-0" />
              {insp.num_inspecciones}
              {insp.nota_media != null
                ? ` · ${insp.nota_media.toFixed(2)}`
                : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Estado Column (inside a phase) ─────────────────────────────
function EstadoColumn({
  estado,
  inspectores,
  onDragStart,
  onDrop,
  onCardClick,
}: {
  estado: InspectorFase;
  inspectores: InspectorListItem[];
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (estado: InspectorFase) => void;
  onCardClick: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const cfg = FASES_INSPECTOR_CONFIG[estado];

  return (
    <div
      className={`flex flex-col flex-1 min-w-0 transition-colors rounded-lg ${
        dragOver ? "bg-primary/5 ring-1 ring-primary/30" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDrop(estado);
      }}
    >
      {/* Estado header */}
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
          {cfg.label}
        </span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold">
          {inspectores.length}
        </Badge>
        <Mail className="h-3 w-3 text-muted-foreground/40 ml-auto" />
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 px-1 pb-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
        <div className="space-y-1.5">
          {inspectores.map((i) => (
            <InspectorCard
              key={i.id}
              insp={i}
              onDragStart={onDragStart}
              onClick={onCardClick}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Phase Group (main column with gradient header) ─────────────
function FaseGroup({
  fasePrincipal,
  inspectores,
  onDragStart,
  onDrop,
  onCardClick,
}: {
  fasePrincipal: FasePrincipalInspector;
  inspectores: InspectorListItem[];
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (estado: InspectorFase) => void;
  onCardClick: (id: string) => void;
}) {
  const cfg = FASES_PRINCIPALES_INSPECTOR[fasePrincipal];
  const totalCount = inspectores.length;

  const inspectoresPorEstado = {} as Record<InspectorFase, InspectorListItem[]>;
  for (const est of cfg.estados) {
    inspectoresPorEstado[est] = inspectores.filter((i) => i.fase === est);
  }

  return (
    <div
      className="flex flex-col min-w-0"
      style={{
        flex: `${cfg.estados.length} 1 0`,
      }}
    >
      {/* Phase header bar with gradient */}
      <div
        className="h-2 rounded-t-lg"
        style={{
          background: `linear-gradient(90deg, ${cfg.colorFrom}, ${cfg.colorTo})`,
        }}
      />

      {/* Phase label row */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-x border-border">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: cfg.color }}
        />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
          {cfg.label}
        </span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-bold">
          {totalCount}
        </Badge>
      </div>

      {/* Estado columns inside */}
      <div className="flex gap-0.5 flex-1 border-x border-b border-border rounded-b-lg bg-muted/20 p-1">
        {cfg.estados.map((est) => (
          <EstadoColumn
            key={est}
            estado={est}
            inspectores={inspectoresPorEstado[est]}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Kanban ────────────────────────────────────────────────
export function InspectoresKanban({ inspectores, onSelect, onRefresh }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  async function handleDrop(faseDestino: InspectorFase) {
    const id = draggingId;
    if (!id) return;
    setDraggingId(null);
    const current = inspectores.find((i) => i.id === id);
    if (!current || current.fase === faseDestino) return;
    const res = await moverInspectorFase(id, faseDestino);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `${current.nombre} → ${FASES_INSPECTOR_CONFIG[faseDestino].label}`,
    );
    onRefresh();
  }

  return (
    <div className="flex-1 w-full">
      <div className="flex gap-2 w-full pb-2">
        {FASES_PRINCIPALES_INSPECTOR_ORDER.map((fp) => (
          <FaseGroup
            key={fp}
            fasePrincipal={fp}
            inspectores={inspectores.filter(
              (i) => getFasePrincipalInspector(i.fase) === fp,
            )}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onCardClick={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
