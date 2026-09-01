"use client";

/**
 * Reasignación MANUAL de las mesas de una reserva, sobre el plano de la sala.
 *
 * Se abre desde la ficha de la reserva ("Abrir salón") y sirve para lo que
 * pasa constantemente en servicio: una reserva de 4 se convierte en una de 6 y
 * hay que juntarle la mesa de al lado, o al revés, se libera una de las dos.
 *
 * Tres decisiones que lo separan del resto de la asignación de mesas:
 *
 * 1. NO hay reglas. Ni combinaciones configuradas, ni capacidades, ni zonas.
 *    Aquí manda quien está en la sala mirando el comedor: si quiere unir dos
 *    mesas que nadie declaró combinables, se unen. El motor automático sigue
 *    respetando sus reglas; esto es la salida manual.
 *
 * 2. Pulsar una mesa NO guarda nada. Se marca y se desmarca libremente y el
 *    cambio solo existe al pulsar "Validar". Sin eso, un clic de más sobre el
 *    plano ya movía a un cliente de mesa.
 *
 * 3. Un choque con otra reserva avisa, no bloquea. Se dice con quién se pisa y
 *    hasta qué hora, y se decide en sala (ver `forzarSolape` en updateReserva).
 */

import { useMemo, useState } from "react";
import { AlertTriangle, Move } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  PlanoMesaPosicion,
  SalaDecoracion,
  Zona as ZonaReal,
} from "@/features/sala/planos/data/planos";
import type { Mesa, Reserva } from "@/features/sala/data/reservas";
import {
  getChoquesMesa,
  type ChoqueReserva,
} from "@/features/sala/actions/reservas-disponibilidad-actions";
import { PlanoSeleccionMesas } from "@/features/sala/components/reservas/PlanoSeleccionMesas";
import type { MesaMetaPlano } from "@/features/sala/components/reservas/plano-mesas-medidas";

/** Códigos de mesa de una reserva ("M1+M2" → ["M1","M2"]). */
export function codigosDeMesa(valor: string | null | undefined): string[] {
  return (valor ?? "")
    .split("+")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  /** Reserva que se está editando. */
  reserva: Reserva;
  /** Mesas de la sala visible (ya filtradas por zona/sala activa). */
  mesas: Mesa[];
  posiciones: Map<string, PlanoMesaPosicion>;
  mesasMeta: Map<string, MesaMetaPlano>;
  zonas: ZonaReal[];
  decoraciones: SalaDecoracion[];
  /** Tema activo de la vista de sala. */
  esOscuro: boolean;
  /** Reservas vivas que ocupan cada mesa, para pintar las que están cogidas. */
  getReservasMesa: (mesaId: string) => Reserva[];
  /** Aplica la nueva selección. Recibe el código compuesto ("M1+M2") o "". */
  onValidar: (codigoMesas: string, forzar: boolean) => Promise<void>;
}

export function EditorMesasReserva({
  abierto,
  onCerrar,
  reserva,
  mesas,
  posiciones,
  mesasMeta,
  zonas,
  decoraciones,
  esOscuro,
  getReservasMesa,
  onValidar,
}: Props) {
  /** Códigos que tenía la reserva al abrir: la referencia de "lo que había". */
  const codigosOriginales = useMemo(
    () => codigosDeMesa(reserva.mesaCodigo),
    [reserva.mesaCodigo],
  );

  /**
   * Selección en curso, por código de mesa. Solo se persiste al Validar.
   *
   * Arranca en las mesas que la reserva tiene grabadas. El padre monta este
   * componente con `key` por reserva y estado de apertura, así que cada vez que
   * se abre el salón se parte de cero: una selección a medias de la vez
   * anterior no puede sobrevivir a un "Cancelar".
   */
  const [seleccion, setSeleccion] = useState<string[]>(codigosOriginales);
  const [guardando, setGuardando] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  /** Choques pendientes de que el usuario decida si sigue adelante. */
  const [choques, setChoques] = useState<ChoqueReserva[] | null>(null);

  const mesasConPos = useMemo(
    () => mesas.filter((m) => posiciones.has(m.id)),
    [mesas, posiciones],
  );

  const codigoCompuesto = useMemo(
    () =>
      [...seleccion]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .join("+"),
    [seleccion],
  );

  const hayCambios = useMemo(() => {
    const antes = [...codigosOriginales].sort().join("+");
    const ahora = [...seleccion].sort().join("+");
    return antes !== ahora;
  }, [codigosOriginales, seleccion]);

  const anadidas = useMemo(
    () => seleccion.filter((c) => !codigosOriginales.includes(c)),
    [seleccion, codigosOriginales],
  );
  const quitadas = useMemo(
    () => codigosOriginales.filter((c) => !seleccion.includes(c)),
    [seleccion, codigosOriginales],
  );

  const alternarMesa = (codigo: string) => {
    const c = codigo.toUpperCase();
    setSeleccion((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  };

  /**
   * Validar: primero se mira si alguna de las mesas nuevas pisa otra reserva.
   * Si las hay se enseña el aviso y se espera decisión; si no, se guarda.
   */
  const validar = async () => {
    if (!hayCambios) {
      onCerrar();
      return;
    }
    // Solo hace falta preguntar por las mesas que ENTRAN: las que ya tenía la
    // reserva son suyas, y quitarlas nunca puede pisar a nadie.
    if (anadidas.length > 0) {
      setComprobando(true);
      const res = await getChoquesMesa({
        fecha: reserva.fecha,
        hora: reserva.hora,
        mesa: anadidas.join("+"),
        duracionMin: reserva.duracionMinutos ?? null,
        ignoreReservaId: reserva.id,
      });
      setComprobando(false);
      if (res.ok && res.data.length > 0) {
        setChoques(res.data);
        return;
      }
    }
    await aplicar(false);
  };

  const aplicar = async (forzar: boolean) => {
    setGuardando(true);
    await onValidar(codigoCompuesto, forzar);
    setGuardando(false);
    setChoques(null);
  };

  const ocupado = guardando || comprobando;

  return (
    <>
      <Dialog open={abierto} onOpenChange={(v) => { if (!v && !ocupado) onCerrar(); }}>
        {/* El diálogo se pinta en un portal, fuera del contenedor de la vista,
            así que el tema de sala no le llega por herencia: se marca aquí. */}
        <DialogContent
          className={cn(
            "max-w-6xl max-h-[92vh] overflow-y-auto",
            "sala-tema",
            esOscuro && "sala-oscuro",
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="h-4 w-4" />
              Mesas de la reserva
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Qué reserva se está tocando y cómo va quedando la selección. */}
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1">
              <p>
                <span className="font-medium text-foreground">
                  {reserva.cliente || "WALK IN"} {reserva.apellidos}
                </span>{" "}
                · {reserva.hora.slice(0, 5)} · {reserva.comensales} pax
              </p>
              <p className="text-muted-foreground">
                Mesas actuales:{" "}
                <span className="font-medium text-foreground">
                  {codigosOriginales.length > 0
                    ? codigosOriginales.join(" + ")
                    : "sin asignar"}
                </span>
                {hayCambios && (
                  <>
                    {" → quedará en "}
                    <span className="font-medium text-foreground">
                      {seleccion.length > 0 ? codigoCompuesto.split("+").join(" + ") : "sin mesa"}
                    </span>
                  </>
                )}
              </p>
              <p className="text-muted-foreground">
                Pulsa las mesas para añadirlas o quitarlas. No se cambia nada
                hasta que pulses Validar.
              </p>
            </div>

            {mesasConPos.length === 0 ? (
              <p className="py-8 text-center text-xs italic text-muted-foreground">
                Esta sala no tiene mesas colocadas en el plano. Cambia de sala o
                colócalas en Configuración → Estructura.
              </p>
            ) : (
              <PlanoSeleccionMesas
                mesas={mesasConPos}
                posiciones={posiciones}
                mesasMeta={mesasMeta}
                zonas={zonas}
                decoraciones={decoraciones}
                esOscuro={esOscuro}
                seleccion={seleccion}
                originales={codigosOriginales}
                onToggle={alternarMesa}
                getReservasMesa={getReservasMesa}
                reservaId={reserva.id}
              />
            )}

            {/* Resumen del cambio: se lee antes de confirmar, con las mismas
                palabras que después aparecen en la actividad. */}
            {hayCambios && (
              <div className="rounded-md border border-sky-500/40 bg-sky-500/5 px-3 py-2 text-xs space-y-0.5">
                {anadidas.length > 0 && (
                  <p>
                    Se {anadidas.length === 1 ? "añadirá" : "añadirán"}{" "}
                    {anadidas.length === 1 ? "la mesa" : "las mesas"}{" "}
                    <span className="font-medium">{anadidas.join(", ")}</span>
                  </p>
                )}
                {quitadas.length > 0 && (
                  <p>
                    Se {quitadas.length === 1 ? "quitará" : "quitarán"}{" "}
                    {quitadas.length === 1 ? "la mesa" : "las mesas"}{" "}
                    <span className="font-medium">{quitadas.join(", ")}</span>
                  </p>
                )}
              </div>
            )}

            {/* `pb-28` por la norma de no tapar el chat flotante. */}
            <div className="flex items-center justify-end gap-2 border-t pt-3 pb-28">
              <Button
                variant="outline"
                disabled={ocupado}
                onClick={onCerrar}
              >
                Cancelar
              </Button>
              <Button disabled={ocupado || !hayCambios} onClick={validar}>
                {comprobando ? "Comprobando…" : guardando ? "Guardando…" : "Validar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Choque con otra reserva: se avisa de a quién se pisa y hasta qué hora,
          pero la decisión es del local — nunca se bloquea el cambio. */}
      <Dialog open={choques !== null} onOpenChange={(v) => { if (!v) setChoques(null); }}>
        <DialogContent className={cn("max-w-md", "sala-tema", esOscuro && "sala-oscuro")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Esa mesa ya está asignada a otra reserva
            </DialogTitle>
          </DialogHeader>
          {choques && (
            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                {anadidas.length === 1
                  ? `La mesa ${anadidas[0]} que quieres añadir`
                  : `Las mesas ${anadidas.join(", ")} que quieres añadir`}{" "}
                {choques.length === 1
                  ? "está en conflicto de horario con esta reserva:"
                  : "están en conflicto de horario con estas reservas:"}
              </p>
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 divide-y divide-amber-500/20">
                {choques.map((c) => (
                  <div
                    key={c.reservaId}
                    className="px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <span className="font-medium truncate">
                      {c.cliente || "WALK IN"}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {c.mesa} · ocupada hasta las {c.horaFin} · {c.personas} pax
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground">
                Si continúas, las dos reservas quedarán sobre la misma mesa a la
                vez y habrá que recolocar a alguien.
              </p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setChoques(null)}>
                  Cancelar
                </Button>
                <Button size="sm" disabled={guardando} onClick={() => aplicar(true)}>
                  Continuar igualmente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
