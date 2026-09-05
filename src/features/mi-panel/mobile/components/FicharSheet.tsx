"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getMiFichajeHoy } from "@/features/mi-panel/actions/mi-panel-actions";
import type { MiFichajeHoy } from "@/features/mi-panel/types";
import { formatHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import { BigClockButton } from "./BigClockButton";

type Estado = "sin-fichar" | "trabajando" | "pausa" | "completado";

function deriveEstado(f: MiFichajeHoy | null): Estado {
  if (!f) return "sin-fichar";
  const e = (f.estado || "").toLowerCase();
  if (e === "trabajando") return "trabajando";
  if (e === "pausa") return "pausa";
  if (e === "completado" || f.horaSalida) return "completado";
  return "sin-fichar";
}

/**
 * Hoja de fichaje que abre la huella de la barra inferior.
 *
 * Antes la huella era un enlace a `/m/fichar`: una pantalla entera cuyo único
 * contenido era otro botón. Dos botones para una sola acción, y el de la barra
 * siempre verde (era navegación, no miraba turnos). Ahora el fichaje ocurre
 * aquí mismo, sin salir de donde estés, y el único botón que decide es el de
 * dentro — que sí se apaga fuera de turno.
 */
export function FicharSheet({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const [fichaje, setFichaje] = useState<MiFichajeHoy | null>(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = () => {
    getMiFichajeHoy().then((r) => {
      if (r.ok) setFichaje(r.data);
      setCargando(false);
    });
  };

  // Se lee al abrir, no al montar: así el estado es el de ESTE momento y no el
  // de cuando arrancó la app (que puede ser de hace horas).
  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    refrescar();
  }, [abierto]);

  if (!abierto) return null;

  const estado = deriveEstado(fichaje);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/50"
      onClick={onCerrar}
    >
      <div
        className="rounded-t-3xl bg-background pb-[max(env(safe-area-inset-bottom),16px)] pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted" />
        <div className="flex items-center justify-between px-5">
          <h2 className="text-lg font-semibold">Fichar</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {fichaje?.horaEntrada && (
          <p className="px-5 pt-1 text-sm text-muted-foreground">
            Entrada: {formatHoraEnZona(fichaje.horaEntrada, fichaje.zonaHoraria)}
            {fichaje.horaSalida && (
              <>
                {" · "}Salida: {formatHoraEnZona(fichaje.horaSalida, fichaje.zonaHoraria)}
              </>
            )}
          </p>
        )}

        {/* Mientras carga no se pinta el botón: enseñarlo con el estado
            equivocado (verde cuando toca gris) engaña más que esperar. */}
        {!cargando && (
          <BigClockButton
            fichajeId={fichaje?.id ?? null}
            estado={estado}
            onAction={refrescar}
          />
        )}
      </div>
    </div>
  );
}
