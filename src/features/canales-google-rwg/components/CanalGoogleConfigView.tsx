"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setEmpresaPlaceId } from "@/features/calidad/actions/resenas-actions";
import { toast } from "sonner";
import { Activity, ExternalLink, Search } from "lucide-react";
import Link from "next/link";

interface Props {
  empresaNombre: string;
  direccion: string | null;
  placeIdInicial: string | null;
}

export function CanalGoogleConfigView({ empresaNombre, direccion, placeIdInicial }: Props) {
  const [placeId, setPlaceId] = useState(placeIdInicial ?? "");
  const [pending, startTransition] = useTransition();
  const activo = (placeIdInicial ?? "").trim().length > 0;

  const onGuardar = () => {
    startTransition(async () => {
      const r = await setEmpresaPlaceId(placeId.trim() || null);
      if (r.ok) {
        toast.success(placeId.trim() ? "Canal Google activado" : "Canal Google desactivado");
      } else {
        toast.error(r.error ?? "No se pudo guardar");
      }
    });
  };

  return (
    <div className="p-3 md:p-4 space-y-4 max-w-2xl">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ajustes / Canales
          </span>
        </div>
        <h1 className="text-base font-semibold">Reserve with Google</h1>
        <p className="text-xs text-muted-foreground">
          Recibe reservas nativas desde Google Maps y Google Search sin comisiones.
        </p>
      </header>

      <div className="rounded-md border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Estado del canal en</p>
            <p className="text-sm font-medium">{empresaNombre}</p>
          </div>
          <span
            className={
              "text-[10px] font-semibold uppercase px-2 py-1 rounded " +
              (activo
                ? "bg-emerald-100 text-emerald-700"
                : "bg-muted text-muted-foreground")
            }
          >
            {activo ? "Activo" : "No configurado"}
          </span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="place-id" className="text-xs">
            Google Place ID
          </Label>
          <Input
            id="place-id"
            placeholder="ChIJ..."
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            className="font-mono text-xs"
          />
          {direccion && (
            <p className="text-[11px] text-muted-foreground">
              Dirección de la empresa: {direccion}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            asChild
            className="text-xs h-8 gap-1.5"
          >
            <Link href="/calidad/resenas">
              <Search className="h-3.5 w-3.5" />
              Buscar Place ID asistido
            </Link>
          </Button>
          <Button size="sm" onClick={onGuardar} disabled={pending} className="text-xs h-8">
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Salud del canal</p>
          </div>
          <Button size="sm" variant="outline" asChild className="text-xs h-8 gap-1.5">
            <Link href="/ajustes/canales/google/salud">
              Ver panel
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Estado de feeds, latencia del Booking Server (P95) y cola de notificaciones salientes.
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        El canal queda activo cuando el Place ID está configurado y Google nos acepta como
        partner. Para activar la integración nativa con Google, contacta con tu administrador
        Balles.
      </p>
    </div>
  );
}
