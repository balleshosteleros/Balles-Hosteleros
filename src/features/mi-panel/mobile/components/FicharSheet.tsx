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
  const [cargado, setCargado] = useState(false);

  const refrescar = () => {
    getMiFichajeHoy().then((r) => {
      if (r.ok) setFichaje(r.data);
      setCargado(true);
    });
  };

  // Se adelanta al toque: la barra de abajo está montada siempre, así que el
  // fichaje de hoy se lee ya, en segundo plano. Antes la lectura empezaba al
  // pulsar la huella y la hoja se quedaba unos segundos con el título a secas.
  useEffect(() => {
    refrescar();
  }, []);

  // Y al abrir se vuelve a leer, en silencio: lo precargado puede ser de hace
  // rato y el estado que manda es el de ESTE momento.
  useEffect(() => {
    if (!abierto) return;
    refrescar();
  }, [abierto]);

  const estado = deriveEstado(fichaje);

  // Montada SIEMPRE, escondida mientras no se usa. No es un capricho: el botón
  // de dentro es quien lee el turno, la cortesía y los tipos de fichaje, y si
  // nace al pulsar la huella, esas lecturas empiezan justo cuando el empleado
  // ya está mirando la pantalla. Montado desde el principio, al tocar la huella
  // todo eso está resuelto y la hoja sale entera.
  return (
    <div
      hidden={!abierto}
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

        {/* El botón se pinta SIEMPRE, desde el primer instante. Mientras no se
            sabe el estado sale en gris con su reloj — nunca en verde, que sería
            mentir; pero tampoco se esconde, que era peor: la hoja se abría
            vacía y parecía rota. */}
        <BigClockButton
          fichajeId={fichaje?.id ?? null}
          estado={estado}
          cargando={!cargado}
          onAction={refrescar}
        />
      </div>
    </div>
  );
}
