"use client";

/**
 * Fichaje a un clic desde la barra de arriba, en el ordenador.
 *
 * La tarjeta grande de fichaje vive en Mi Panel, y para fichar había que ir
 * hasta allí. Quien trabaja con el ordenador abierto todo el día necesita el
 * botón a mano, no a dos pantallas de distancia.
 *
 * EN REPOSO ES SOLO UN CÍRCULO, igual que los demás iconos de la barra: mismo
 * borde y mismo fondo que la píldora de herramientas, para que no desentone
 * (Iván, 10-09-2026). Dentro va la flecha de entrada si no ha fichado, la de
 * salida si está dentro, y un tic si su turno ya se cerró.
 *
 * Al ponerse encima —o al pulsarlo— se abre HACIA LA IZQUIERDA y enseña lo
 * justo: el tiempo que lleva y el botón para fichar o desfichar. Nada más se
 * quita el ratón vuelve a ser solo el círculo. Se despliega también al enfocar
 * con el teclado, para que no dependa de tener puntero.
 *
 * El círculo YA NO FICHA de un golpe: abre. Fichar y desfichar son botones
 * aparte dentro del desplegable — el de salida en rojo — para que un roce en la
 * barra no le cierre a nadie el turno sin querer.
 *
 * Solo se pinta a quien puede fichar: si la persona no tiene ficha de empleado,
 * el componente no devuelve nada y la barra queda igual que antes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { LogIn, LogOut, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  // Abierto por el ratón (o el teclado) y abierto por haberlo pulsado. Se
  // guardan aparte: el ratón abre y cierra solo, la pulsación lo deja fijo para
  // poder llegar al botón sin que se cierre por el camino.
  const [encima, setEncima] = useState(false);
  const [fijado, setFijado] = useState(false);
  const montado = useRef(true);
  const raiz = useRef<HTMLDivElement | null>(null);

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

  // Dejarlo fijo con una pulsación y luego irse a otra parte de la pantalla no
  // puede dejarlo abierto: se cierra al pulsar fuera y con la tecla Escape.
  useEffect(() => {
    if (!fijado) return;
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setFijado(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFijado(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [fijado]);

  if (disponible !== true) return null;

  const estado: Estado = dentro ? "dentro" : fichaje?.horaSalida ? "terminado" : "sin-fichar";
  const abierto = encima || fijado;

  const ROTULO: Record<Estado, string> = {
    "sin-fichar": "Sin fichar",
    dentro: "Trabajando",
    terminado: "Turno cerrado",
  };

  async function fichar(salida: boolean) {
    if (enviando) return;
    setEnviando(true);
    try {
      // La posición CONFIRMA que estás en tu local. Si el navegador la deniega
      // se envía sin ella y decide el servidor, que es quien manda.
      const geo = await obtenerPosicionActual().catch(() => undefined);
      const res =
        salida && fichaje
          ? await ficharSalidaPersonal(fichaje.id, geo ?? undefined)
          : await ficharEntradaPersonal(geo ?? undefined);

      if (res.ok) {
        toast.success(salida ? "Salida fichada" : "Entrada fichada");
        await cargar();
        if (montado.current) setFijado(false);
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
    <div
      ref={raiz}
      className="flex items-center"
      onMouseEnter={() => setEncima(true)}
      onMouseLeave={() => setEncima(false)}
      onFocus={() => setEncima(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEncima(false);
      }}
    >
      {/* Se abre hacia la IZQUIERDA: el ancho pasa de 0 a su tamaño. Como toda
          la cabecera está pegada a la derecha, crecer empuja hacia la izquierda
          y ni la barra de herramientas ni el nombre se mueven de su sitio.
          `overflow-hidden` evita que el contenido asome mientras está plegado. */}
      <div
        aria-hidden={!abierto}
        className={cn(
          "flex h-8 items-center overflow-hidden whitespace-nowrap rounded-full border bg-muted/40 transition-all duration-200",
          abierto
            ? "mr-1 max-w-[240px] gap-2 pl-3 pr-1 opacity-100"
            : "max-w-0 border-transparent px-0 opacity-0",
        )}
      >
        <span className="text-[11px] font-medium tabular-nums text-foreground/80">
          {estado === "sin-fichar" ? ROTULO[estado] : horasVivas(fichaje)}
        </span>

        {estado === "terminado" ? (
          <span className="pr-2 text-[11px] text-muted-foreground">{ROTULO[estado]}</span>
        ) : (
          <button
            type="button"
            tabIndex={abierto ? 0 : -1}
            onClick={() => void fichar(estado === "dentro")}
            disabled={enviando}
            className={cn(
              "flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
              estado === "dentro"
                // Desfichar en rojo, pero sin gritar: fondo tenue y letra roja.
                ? "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400",
            )}
          >
            {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {estado === "dentro" ? "Desfichar" : "Fichar"}
          </button>
        )}
      </div>

      {/* El círculo: mismo borde y mismo fondo que la píldora de herramientas,
          para que se lea como un icono más de la barra. */}
      <button
        type="button"
        onClick={() => setFijado((v) => !v)}
        aria-expanded={abierto}
        aria-label={`${ROTULO[estado]} · ${horasVivas(fichaje)}`}
        title={`${ROTULO[estado]} · ${horasVivas(fichaje)}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted/40 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {enviando ? (
          <Loader2 className={`h-4 w-4 animate-spin ${color}`} />
        ) : (
          <Icono className={`h-4 w-4 ${color}`} />
        )}
      </button>
    </div>
  );
}
