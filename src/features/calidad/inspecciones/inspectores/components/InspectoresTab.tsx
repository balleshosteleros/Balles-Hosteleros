"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  List,
  Share2,
  Loader2,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";
import { listInspectores } from "../actions";
import type { InspectorListItem } from "../types";
import { InspectoresKanban } from "./InspectoresKanban";
import { InspectoresListado } from "./InspectoresListado";
import { InspectorDetailDialog } from "./InspectorDetailDialog";
import { InspectorFormDialog } from "./InspectorFormDialog";
import { InspectoresConfigView } from "./config/InspectoresConfigView";

type SubVista = "pipeline" | "listado";

interface Props {
  empresaSlug?: string | null;
  onBack?: () => void;
  backLabel?: string;
}

export function InspectoresTab({ empresaSlug, onBack, backLabel = "Volver" }: Props) {
  const [vista, setVista] = useState<SubVista>("pipeline");
  const [inspectores, setInspectores] = useState<InspectorListItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    startTransition(async () => {
      setLoading(true);
      const data = await listInspectores();
      setInspectores(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const q = busqueda.trim().toLowerCase();
  const filtrados = q
    ? inspectores.filter((i) =>
        [i.nombre, i.apellidos, i.telefono, i.email, i.ciudad]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
    : inspectores;

  const bolsaUrl = empresaSlug ? `/inspectores/bolsa/${empresaSlug}` : null;

  if (showConfig) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(false)}
            className="gap-1.5 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a inspectores
          </Button>
        </div>
        <InspectoresConfigView />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        {onBack ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-1.5 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={vista === "pipeline" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setVista("pipeline")}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
          </Button>
          <Button
            variant={vista === "listado" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setVista("listado")}
          >
            <List className="h-3.5 w-3.5" /> Listado
          </Button>
        </div>
      </div>

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={() => setFormOpen(true)}
        extraDerecha={
          <>
            {bolsaUrl && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-1.5"
              >
                <a href={bolsaUrl} target="_blank" rel="noreferrer">
                  <Share2 className="h-3.5 w-3.5" /> Compartir portal
                </a>
              </Button>
            )}
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => setShowConfig(true)}
              title="Configuración"
              aria-label="Configuración"
            >
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : vista === "pipeline" ? (
        <InspectoresKanban
          inspectores={filtrados}
          onSelect={setSeleccionado}
          onRefresh={refresh}
        />
      ) : (
        <InspectoresListado
          inspectores={filtrados}
          onSelect={setSeleccionado}
        />
      )}

      <InspectorDetailDialog
        inspectorId={seleccionado}
        open={seleccionado !== null}
        onOpenChange={(open) => {
          if (!open) setSeleccionado(null);
        }}
        onChanged={refresh}
      />

      <InspectorFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={refresh}
      />
    </div>
  );
}
