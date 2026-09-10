"use client";

/**
 * Fichaje a un clic desde la barra de arriba, en el ordenador.
 *
 * La tarjeta grande de fichaje vive en Mi Panel, y para fichar había que ir
 * hasta allí. Quien trabaja con el ordenador abierto todo el día necesita el
 * botón a mano, no a dos pantallas de distancia.
 *
 * En reposo es SOLO el icono, para no competir con el resto de la barra: flecha
 * de entrada si no ha fichado, de salida si está dentro, y un tic si su turno ya
 * se cerró. Al pasar el ratón se abre hacia la izquierda y enseña el tiempo que
 * lleva —o el total del día si ya terminó—. Se despliega con el ratón encima y
 * al enfocar con el teclado, para que no dependa de tener puntero.
 *
 * Solo se pinta a quien puede fichar: si la persona no tiene ficha de empleado,
 * el componente no devuelve nada y la barra queda igual que antes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { LogIn, LogOut, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ficharEntradaPersonal,
  ficharSalidaPersonal,
  getMiFichajeHoy,
} from "@/features/mi-panel/actions/mi-panel-actions";
import { obtenerPosicionActual } from "@/features/rrhh/utils/geo";
import type { MiFichajeHoy } from "@/features/mi-panel/types";

/** «2:35 h» de lo que lleva dentro, o del total si ya salió. */
function horasVivas(f: MiFichajeHoy | null): string {
  if (!f?.horaEntrada) return "0:00 h";
  const entrada = new Date(f.horaEntrada).getTime();
  const fin = f.horaSalida ? new Date(f.horaSalida).getTime() : Date.now();
  const ms = Math.max(0, fin - entrada);
  return `${Math.floor(ms / 3600000)}:${String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0")} h`;
}

type Estado = "sin-fichar" | "dentro" | "terminado";

export function FichajePill() {
  const [fichaje, setFichaje] = useState<MiFichajeHoy | null>(null);
  /** null = aún no se sabe; false = no puede fichar y no se pinta nada. */
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, forzarTic] = useState(0);
  const montado = useRef(true);

  const cargar = useCallback(async () => {
    const res = await getMiFichajeHoy();
    if (!montado.current) return;
    setDisponible(res.ok);
    setFichaje(res.ok ? res.data : null);
  }, []);

  useEffect(() => {
    montado.current = true;
    void cargar();
    return () => {
      montado.current = false;
    };
  }, [cargar]);

  // El contador corre solo mientras está DENTRO: parado no hay nada que contar y
  // un intervalo despierto todo el día en la barra no se justifica.
  const dentro = Boolean(fichaje?.horaEntrada && !fichaje?.horaSalida);
  useEffect(() => {
    if (!dentro) return;
    const id = setInterval(() => forzarTic((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [dentro]);

  if (disponible !== true) return null;

  const estado: Estado = dentro ? "dentro" : fichaje?.horaSalida ? "terminado" : "sin-fichar";

  const ROTULO: Record<Estado, string> = {
    "sin-fichar": "Sin fichar",
    dentro: "Trabajando",
    terminado: "Turno cerrado",
  };

  async function alPulsar() {
    if (enviando) return;
    // Un tic ya cerrado no ficha nada: el turno de hoy está hecho.
    if (estado === "terminado") {
      toast.info("Tu turno de hoy ya está cerrado.");
      return;
    }
    setEnviando(true);
    try {
      // La posición CONFIRMA que estás en tu local. Si el navegador la deniega
      // se envía sin ella y decide el servidor, que es quien manda.
      const geo = await obtenerPosicionActual().catch(() => undefined);
      const res =
        estado === "dentro" && fichaje
          ? await ficharSalidaPersonal(fichaje.id, geo ?? undefined)
          : await ficharEntradaPersonal(geo ?? undefined);

      if (res.ok) {
        toast.success(estado === "dentro" ? "Salida fichada" : "Entrada fichada");
        await cargar();
      } else {
        toast.error(res.error ?? "No se pudo fichar");
      }
    } finally {
      if (montado.current) setEnviando(false);
    }
  }

  const Icono = estado === "dentro" ? LogOut : estado === "terminado" ? Check : LogIn;
  const color =
    estado === "dentro"
      ? "text-rose-600 dark:text-rose-400"
      : estado === "terminado"
        ? "text-muted-foreground"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <button
      type="button"
      onClick={alPulsar}
      disabled={enviando}
      aria-label={`${ROTULO[estado]} · ${horasVivas(fichaje)}`}
      title={`${ROTULO[estado]} · ${horasVivas(fichaje)}`}
      className="group flex h-8 items-center gap-1 rounded-full px-1.5 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
    >
      {/* Se abre hacia la izquierda: el ancho pasa de 0 a su tamaño con el ratón
          encima o al enfocar con el teclado. `overflow-hidden` evita que el
          texto empuje la barra mientras está plegado. */}
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] font-medium tabular-nums text-foreground/80 transition-all duration-200 group-hover:max-w-[92px] group-hover:pl-1 group-focus-visible:max-w-[92px] group-focus-visible:pl-1">
        {estado === "sin-fichar" ? ROTULO[estado] : horasVivas(fichaje)}
      </span>
      {enviando ? (
        <Loader2 className={`h-4 w-4 shrink-0 animate-spin ${color}`} />
      ) : (
        <Icono className={`h-4 w-4 shrink-0 ${color}`} />
      )}
    </button>
  );
}
