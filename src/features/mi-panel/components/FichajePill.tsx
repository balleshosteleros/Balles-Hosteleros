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
 * A quien tiene el TELETRABAJO permitido en su ficha de empleado se le
 * pregunta —Presencial o Teletrabajo— en vez de dar por hecho que está en el
 * local. Es la misma regla de la tarjeta de fichaje de Mi Panel, que aquí
 * faltaba: desde la barra se fichaba siempre como presencial.
 *
 * Solo se pinta a quien puede fichar: si la persona no tiene ficha de empleado,
 * el componente no devuelve nada y la barra queda igual que antes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
// Fichar es SIEMPRE la huella, la misma que el botón grande del móvil y la de
// la tarjeta de Mi Panel: un solo dibujo para una sola acción, se entre por
// donde se entre. Antes eran flechas, que se confundían con las de cerrar
// sesión. Lo único que cambia es el color, y lo dice lo que toca AHORA: verde
// para entrar, roja para salir.
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AvisoBajaMedicaDialog } from "@/features/mi-panel/components/AvisoBajaMedicaDialog";
import { cn } from "@/lib/utils";
import {
  ficharEntradaPersonal,
  ficharSalidaPersonal,
  getMiFichajeHoy,
  getMiConfigFichaje,
  type ModoFichaje,
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
  const [avisoBaja, setAvisoBaja] = useState(false);
  // ¿Esta persona tiene el teletrabajo permitido en esta empresa? Si lo tiene,
  // el desplegable pregunta —presencial o teletrabajo— en vez de dar por hecho
  // que está en el local, igual que hace la tarjeta de fichaje de Mi Panel.
  const [permiteTeletrabajo, setPermiteTeletrabajo] = useState(false);
  const [, forzarTic] = useState(0);
  // Abierto por el ratón (o el teclado) y abierto por haberlo pulsado. Se
  // guardan aparte: el ratón abre y cierra solo, la pulsación lo deja fijo para
  // poder llegar al botón sin que se cierre por el camino.
  const [encima, setEncima] = useState(false);
  const [fijado, setFijado] = useState(false);
  const montado = useRef(true);
  const raiz = useRef<HTMLDivElement | null>(null);

  const cargar = useCallback(async () => {
    const [res, cfg] = await Promise.all([getMiFichajeHoy(), getMiConfigFichaje()]);
    if (!montado.current) return;
    setDisponible(res.ok);
    setFichaje(res.ok ? res.data : null);
    setPermiteTeletrabajo(cfg.ok && cfg.permiteTeletrabajo);
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

  async function fichar(salida: boolean, modo: ModoFichaje = "presencial") {
    if (enviando) return;
    setEnviando(true);
    try {
      // La posición CONFIRMA que estás en tu local. En teletrabajo no hace
      // falta: no se ficha desde ningún local. Si el navegador la deniega se
      // envía sin ella y decide el servidor, que es quien manda.
      const geo =
        modo === "teletrabajo" && !salida
          ? undefined
          : await obtenerPosicionActual().catch(() => undefined);
      const res =
        salida && fichaje
          ? await ficharSalidaPersonal(fichaje.id, geo ?? undefined)
          : await ficharEntradaPersonal(geo ?? undefined, modo);

      if (res.ok) {
        toast.success(
          salida
            ? "Salida fichada"
            : modo === "teletrabajo"
              ? "Entrada fichada (teletrabajo)"
              : "Entrada fichada",
        );
        await cargar();
        if (montado.current) setFijado(false);
      } else if ((res as { bajaMedica?: boolean }).bajaMedica) {
        // De baja no se ficha: aviso propio que le lleva a comunicar su alta.
        setAvisoBaja(true);
      } else {
        toast.error(res.error ?? "No se pudo fichar");
      }
    } finally {
      if (montado.current) setEnviando(false);
    }
  }

  const color =
    estado === "dentro"
      ? "text-rose-600 dark:text-rose-400"
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
          "flex h-10 items-center overflow-hidden whitespace-nowrap rounded-full border bg-muted/40 transition-all duration-200",
          abierto
            ? "mr-1 max-w-[340px] gap-2 pl-3 pr-1 opacity-100"
            : "max-w-0 border-transparent px-0 opacity-0",
        )}
      >
        <span className="text-[11px] font-medium tabular-nums text-foreground/80">
          {/* El tiempo se enseña siempre: a 0:00 h mientras no se ha fichado y
              contando desde la entrada en cuanto se ficha. Antes ponía "Sin
              fichar" y había que abrirlo para saber si llevabas horas. */}
          {horasVivas(fichaje)}
          {estado !== "sin-fichar" && fichaje?.modoTeletrabajo ? (
            <span className="ml-1 font-normal text-muted-foreground">· Teletrabajo</span>
          ) : null}
        </span>

        {estado === "terminado" ? (
          <span className="pr-2 text-[11px] text-muted-foreground">{ROTULO[estado]}</span>
        ) : estado === "dentro" ? (
          <BotonFichar
            texto="Desfichar"
            tono="rojo"
            abierto={abierto}
            enviando={enviando}
            onClick={() => void fichar(true)}
          />
        ) : permiteTeletrabajo ? (
          // Con el teletrabajo permitido NO se da por hecho que estás en el
          // local: se pregunta, igual que en la tarjeta de Mi Panel. Lo tiene
          // quien lo tenga puesto en su ficha de empleado, empresa por empresa.
          <>
            <BotonFichar
              texto="Presencial"
              tono="verde"
              abierto={abierto}
              enviando={enviando}
              onClick={() => void fichar(false, "presencial")}
            />
            <BotonFichar
              texto="Teletrabajo"
              tono="azul"
              abierto={abierto}
              enviando={enviando}
              onClick={() => void fichar(false, "teletrabajo")}
            />
          </>
        ) : (
          <BotonFichar
            texto="Fichar"
            tono="verde"
            abierto={abierto}
            enviando={enviando}
            onClick={() => void fichar(false)}
          />
        )}
      </div>

      {/* El círculo se monta IGUAL que la píldora de herramientas: mismo borde,
          mismo fondo y el mismo `py-1` alrededor de un icono de 32 px. Es lo
          que hace que empiece y termine a la misma altura que la barra de al
          lado; con el borde puesto directamente sobre el icono quedaba más bajo
          y se veía descolgado. */}
      <span className="flex shrink-0 items-center rounded-full border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setFijado((v) => !v)}
          aria-expanded={abierto}
          aria-label={`${ROTULO[estado]} · ${horasVivas(fichaje)}`}
          title={`${ROTULO[estado]} · ${horasVivas(fichaje)}`}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {enviando ? (
            <Loader2 className={`h-4 w-4 animate-spin ${color}`} />
          ) : (
            <Fingerprint className={`h-[18px] w-[18px] ${color}`} />
          )}
        </button>
      </span>

      <AvisoBajaMedicaDialog open={avisoBaja} onOpenChange={setAvisoBaja} />
    </div>
  );
}

/** Botón del desplegable: mismo tamaño y tono tenue, solo cambia el color. */
function BotonFichar({
  texto,
  tono,
  abierto,
  enviando,
  onClick,
}: {
  texto: string;
  tono: "verde" | "rojo" | "azul";
  abierto: boolean;
  enviando: boolean;
  onClick: () => void;
}) {
  const TONO: Record<typeof tono, string> = {
    // Tenues a propósito: la barra de arriba no es sitio para botones que
    // griten. El rojo se lee como rojo sin convertirse en una alarma.
    verde: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400",
    rojo: "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400",
    azul: "bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 dark:text-sky-400",
  };
  return (
    <button
      type="button"
      tabIndex={abierto ? 0 : -1}
      onClick={onClick}
      disabled={enviando}
      className={cn(
        "flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        TONO[tono],
      )}
    >
      {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {texto}
    </button>
  );
}
