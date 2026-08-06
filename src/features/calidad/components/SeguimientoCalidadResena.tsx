"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmpleadoGestor } from "@/features/calidad/actions/resenas-actions";
import {
  COGE_TELEFONO_OPCIONES,
  ESTADOS_GESTION,
  PLATAFORMA_OPCIONES,
  type CogeTelefono,
  type EstadoGestionResena,
  type PlataformaResena,
} from "@/features/calidad/types/resenas";

/**
 * Radix Select no admite `value=""`, así que "sin informar" viaja con este
 * centinela y se traduce a cadena vacía (→ null al guardar) en los handlers.
 */
const SIN_DATO = "__sin_dato__";

interface Props {
  plataforma: PlataformaResena | "";
  onPlataformaChange: (v: PlataformaResena | "") => void;
  fechaRegistro: string;
  onFechaRegistroChange: (v: string) => void;
  fechaSesion: string;
  onFechaSesionChange: (v: string) => void;
  telefono: string;
  onTelefonoChange: (v: string) => void;
  cogeTelefono: CogeTelefono | "";
  onCogeTelefonoChange: (v: CogeTelefono | "") => void;
  estadoGestion: EstadoGestionResena | "";
  onEstadoGestionChange: (v: EstadoGestionResena | "") => void;
  observaciones: string;
  onObservacionesChange: (v: string) => void;
  gestionadaPor: string;
  onGestionadaPorChange: (v: string) => void;
  empleados: EmpleadoGestor[];
}

/**
 * Bloque de seguimiento comercial dentro de la ficha de una reseña: lo que la
 * persona de calidad rellena cuando llama al cliente. Todo es opcional — una
 * reseña recién traída de Google entra con estos campos en blanco.
 */
export function SeguimientoCalidadResena({
  plataforma,
  onPlataformaChange,
  fechaRegistro,
  onFechaRegistroChange,
  fechaSesion,
  onFechaSesionChange,
  telefono,
  onTelefonoChange,
  cogeTelefono,
  onCogeTelefonoChange,
  estadoGestion,
  onEstadoGestionChange,
  observaciones,
  onObservacionesChange,
  gestionadaPor,
  onGestionadaPorChange,
  empleados,
}: Props) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Seguimiento de calidad
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Plataforma</Label>
          <Select
            value={plataforma || SIN_DATO}
            onValueChange={(v) =>
              onPlataformaChange(v === SIN_DATO ? "" : (v as PlataformaResena))
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Sin informar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_DATO}>Sin informar</SelectItem>
              {PLATAFORMA_OPCIONES.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Teléfono</Label>
          <Input
            className="h-9"
            value={telefono}
            onChange={(e) => onTelefonoChange(e.target.value)}
            placeholder="Sin teléfono"
            inputMode="tel"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Fecha de la visita</Label>
          <Input
            type="date"
            className="h-9"
            value={fechaRegistro}
            onChange={(e) => onFechaRegistroChange(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Fecha de gestión</Label>
          <Input
            type="date"
            className="h-9"
            value={fechaSesion}
            onChange={(e) => onFechaSesionChange(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Coge el teléfono</Label>
          <Select
            value={cogeTelefono || SIN_DATO}
            onValueChange={(v) =>
              onCogeTelefonoChange(v === SIN_DATO ? "" : (v as CogeTelefono))
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Sin informar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_DATO}>Sin informar</SelectItem>
              {COGE_TELEFONO_OPCIONES.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Estado</Label>
          <Select
            value={estadoGestion || SIN_DATO}
            onValueChange={(v) =>
              onEstadoGestionChange(
                v === SIN_DATO ? "" : (v as EstadoGestionResena),
              )
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Sin informar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_DATO}>Sin informar</SelectItem>
              {ESTADOS_GESTION.map((e) => (
                <SelectItem key={e.key} value={e.key}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Gestionada por</Label>
          <Select
            value={gestionadaPor || SIN_DATO}
            onValueChange={(v) =>
              onGestionadaPorChange(v === SIN_DATO ? "" : v)
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_DATO}>Sin asignar</SelectItem>
              {empleados.map((e) => (
                <SelectItem key={e.userId} value={e.userId}>
                  {e.nombre}
                  {e.puesto ? ` · ${e.puesto}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {empleados.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Cargando empleados…
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Observaciones de calidad</Label>
        <Textarea
          value={observaciones}
          onChange={(e) => onObservacionesChange(e.target.value)}
          rows={3}
          placeholder="Qué te ha contado el cliente en la llamada…"
        />
      </div>
    </div>
  );
}
