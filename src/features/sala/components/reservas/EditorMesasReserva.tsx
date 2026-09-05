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
 * 2b. Mover es lo que se hace a diario; unir es la excepción. Por eso pulsar
 *    otra mesa SUSTITUYE la selección (la reserva se muda) y solo en modo
 *    "Unir" se suma a las que ya había. Cuando pulsar sumaba siempre, cambiar
 *    de mesa dejaba a la reserva ocupando las dos.
 *
 * 2c. Si la mesa que se pulsa YA tiene otra reserva, no se decide por el
 *    usuario: se para y se pregunta en medio de la pantalla si se intercambian
 *    las dos (cada una a la mesa de la otra) o si se unen igualmente. Es el
 *    momento en el que además se le enseña lo que se va a encontrar —si el
 *    cambio pisa a alguien más y si el grupo no cabe en la mesa nueva—, pero
 *    siempre como aviso: quien está en la sala decide y puede seguir.
 *
 * 3. Un choque con otra reserva avisa, no bloquea. Se dice con quién se pisa y
 *    hasta qué hora, y se decide en sala (ver `forzarSolape` en updateReserva).
 */

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Move } from "lucide-react";
import { toast } from "sonner";

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

/**
 * Mesa ocupada que se ha pulsado y espera decisión. Lleva ya calculados los
 * avisos, para que el diálogo se pinte de una vez y no aparezcan líneas nuevas
 * mientras alguien está leyendo.
 */
interface DecisionMesaOcupada {
  /** Código de la mesa pulsada. */
  codigo: string;
  /** Reserva que la ocupa ahora mismo. */
  otra: Reserva;
  /** Solapes con TERCEROS que provocaría el cambio. Vacío si no hay. */
  solapes: ChoqueReserva[];
  /** Aviso de aforo, ya redactado. `null` si el grupo cabe. */
  avisoAforo: string | null;
  /** Aviso de aforo para la OTRA reserva al recibir la mesa que se deja. */
  avisoAforoOtra: string | null;
  /**
   * Cliente del intercambio ya pactado, si lo hay: mientras exista, no se
   * puede pactar otro y el botón de intercambiar sale apagado.
   */
  bloqueadoPorIntercambio: string | null;
}

/** Intercambio ya aceptado, a la espera de "Guardar". */
interface IntercambioPendiente {
  otraReservaId: string;
  /** Cliente de la otra reserva, para el resumen. */
  otraCliente: string;
  /** Mesa que recibe la reserva movida: la que estaba ocupada. */
  mesaRecibida: string;
  /** Mesas que pasa a tener la otra reserva. */
  mesaParaLaOtra: string;
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
  /**
   * Permuta las mesas con otra reserva. Va aparte de `onValidar` porque las
   * dos reservas tienen que moverse a la vez: hecho en dos pasos, el de en
   * medio las deja sobre la misma mesa y el bloqueo de solape lo rechaza.
   */
  onIntercambiar: (params: {
    otraReservaId: string;
    mesaDestino: string;
    mesaOrigen: string;
  }) => Promise<void>;
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
  onIntercambiar,
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
  /**
   * Qué hace pulsar una mesa: mudar la reserva ("mover") o sumarla a las que
   * ya tiene ("unir"). Arranca siempre en mover —es lo habitual en servicio— y
   * el modo no sobrevive al cierre del diálogo, igual que la selección.
   */
  const [modo, setModo] = useState<"mover" | "unir">("mover");
  const [guardando, setGuardando] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  /** Choques pendientes de que el usuario decida si sigue adelante. */
  const [choques, setChoques] = useState<ChoqueReserva[] | null>(null);
  /**
   * Mesa ocupada que se acaba de pulsar, esperando a que se decida qué hacer
   * con ella. Mientras esto no sea `null` la selección NO se ha tocado: el
   * plano sigue como estaba y nada se mueve hasta que se responde.
   */
  const [decision, setDecision] = useState<DecisionMesaOcupada | null>(null);
  /** Intercambio pactado en el diálogo, pendiente de "Guardar". */
  const [intercambio, setIntercambio] = useState<IntercambioPendiente | null>(
    null,
  );

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

  /**
   * Aviso de aforo de una mesa para un grupo, o `null` si cabe. Nunca impide
   * nada: una mesa de 4 se le da a 2 sin problema si en sala lo ven claro, y a
   * 6 apretados también. Solo se dice, para que no sorprenda al montar.
   */
  const avisoAforoDeMesa = (codigo: string, personas: number): string | null =>
    avisoAforoDeMesas([codigo], personas);

  /** Lo mismo para un conjunto de mesas: las capacidades se suman. */
  const avisoAforoDeMesas = (
    codigos: string[],
    personas: number,
  ): string | null => {
    let min = 0;
    let max = 0;
    let conocidas = 0;
    for (const codigo of codigos) {
      const mesa = mesas.find((m) => m.codigo.toUpperCase() === codigo.toUpperCase());
      const meta = mesa ? mesasMeta.get(mesa.id) : undefined;
      if (!meta) continue;
      conocidas += 1;
      min += meta.capacidadMin;
      max += meta.capacidadMax;
    }
    if (conocidas === 0) return null;
    const donde = codigos.length === 1 ? `la mesa ${codigos[0]}` : `${codigos.join(" + ")}`;
    if (personas > max) {
      return `${personas} personas en ${donde}, que admite ${max}.`;
    }
    if (personas < min) {
      return `${personas} ${personas === 1 ? "persona" : "personas"} en ${donde}, pensada para ${min} como mínimo.`;
    }
    return null;
  };

  /**
   * Pulsar una mesa del plano.
   *
   * En "mover", una mesa nueva se lleva la reserva entera: sustituye a todas
   * las anteriores. En "unir" se suma. En los dos casos, pulsar una que ya
   * está elegida la quita, que es como se deshace un clic de más.
   *
   * Ctrl/⌘ suma sin salir de "mover": el atajo de siempre para quien va con
   * ratón, sin obligar a cambiar de modo para juntar dos mesas.
   */
  const pulsarMesa = async (codigo: string, sumar: boolean) => {
    const c = codigo.toUpperCase();

    // Quitar una mesa ya elegida nunca pregunta: es deshacer, no ocupar nada.
    if (seleccion.includes(c)) {
      setSeleccion((prev) => prev.filter((x) => x !== c));
      // Si la mesa que se suelta era la del intercambio pactado, el trato se
      // cae con ella: no puede quedar una reserva apuntada a una mesa que ya
      // no está en juego.
      if (intercambio && intercambio.mesaRecibida === c) setIntercambio(null);
      return;
    }

    const mesa = mesas.find((m) => m.codigo.toUpperCase() === c);
    const otras = mesa
      ? getReservasMesa(mesa.id).filter((r) => r.id !== reserva.id)
      : [];

    // Mesa libre: se aplica directo, sin interrumpir a nadie. Solo se deja el
    // aviso de aforo si el grupo no encaja, que es un dato para montar la mesa,
    // no una pregunta: nadie tiene que responder nada para seguir.
    if (otras.length === 0) {
      const une = sumar || modo === "unir";
      const nueva = une ? [...seleccion, c] : [c];
      setSeleccion(nueva);
      // Cambiar de mesa sin intercambio deshace el trato pactado; sumar una
      // mesa libre encima de un intercambio, no: el trato sigue en pie.
      if (!une) setIntercambio(null);
      const aviso = avisoAforoDeMesas(nueva, reserva.comensales);
      if (aviso) toast.warning(aviso);
      return;
    }

    // Mesa ocupada: se para aquí. Se preguntan los solapes con terceros ANTES
    // de abrir el diálogo para enseñarlo todo junto —quién está, a quién más
    // se pisa y si el grupo cabe— y que la decisión se tome con todo delante.
    setComprobando(true);
    const res = await getChoquesMesa({
      fecha: reserva.fecha,
      hora: reserva.hora,
      mesa: c,
      duracionMin: reserva.duracionMinutos ?? null,
      ignoreReservaId: reserva.id,
    });
    setComprobando(false);

    const otra = otras[0];
    setDecision({
      codigo: c,
      otra,
      // Un intercambio ya pactado bloquea el siguiente: el segundo sustituiría
      // al primero y esa primera reserva se quedaría apuntada a una mesa que
      // esta ya no libera. Se permuta con UNA reserva; para encadenar cambios
      // se guarda y se vuelve a entrar.
      bloqueadoPorIntercambio: intercambio !== null ? intercambio.otraCliente : null,
      // La reserva que ocupa la mesa NO es un tercero: es con quien se está
      // negociando, y sale con nombre y hora en la cabecera del diálogo.
      solapes: res.ok ? res.data.filter((x) => x.reservaId !== otra.id) : [],
      avisoAforo: avisoAforoDeMesa(c, reserva.comensales),
      avisoAforoOtra:
        codigosOriginales.length > 0
          ? avisoAforoDeMesas(codigosOriginales, otra.comensales)
          : null,
    });
  };

  /** Se acepta el intercambio: cada reserva a la mesa de la otra. */
  const aceptarIntercambio = () => {
    if (!decision) return;
    setSeleccion([decision.codigo]);
    setIntercambio({
      otraReservaId: decision.otra.id,
      otraCliente: decision.otra.cliente || "WALK IN",
      mesaRecibida: decision.codigo,
      // La otra se queda con lo que la reserva movida deja libre. Si no tenía
      // mesa, se queda sin ella: no hay nada que darle.
      mesaParaLaOtra: codigosOriginales.join("+"),
    });
    setDecision(null);
  };

  /** Se unen: la mesa ocupada se suma a las que ya tenía la reserva. */
  const aceptarUnion = () => {
    if (!decision) return;
    setSeleccion((prev) => [...prev, decision.codigo]);
    setIntercambio(null);
    setDecision(null);
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
    // En un intercambio los solapes ya se enseñaron al pactarlo, y las mesas
    // que entran están ocupadas a propósito por la reserva con la que se
    // permuta: volver a preguntar aquí sacaría un aviso por algo ya decidido.
    if (intercambio) {
      await aplicar(true);
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
    if (intercambio) {
      await onIntercambiar({
        otraReservaId: intercambio.otraReservaId,
        mesaDestino: codigoCompuesto,
        mesaOrigen: intercambio.mesaParaLaOtra,
      });
    } else {
      await onValidar(codigoCompuesto, forzar);
    }
    setGuardando(false);
    setChoques(null);
  };

  const ocupado = guardando || comprobando;

  return (
    <>
      <Dialog open={abierto} onOpenChange={(v) => { if (!v && !ocupado) onCerrar(); }}>
        {/* El diálogo se pinta en un portal, fuera del contenedor de la vista,
            así que el tema de sala no le llega por herencia: se marca aquí. */}
        {/* Alto fijo y columna: la cabecera, el resumen y los botones ocupan
            lo suyo y el plano se queda con TODO el hueco restante, encogiéndose
            para caber. Así nunca hay que desplazarse dentro del diálogo. */}
        <DialogContent
          className={cn(
            // `overflow-hidden` y `max-h` pisan a propósito los del diálogo
            // base (`overflow-y-auto`, `max-h-[90vh]`): con scroll propio el
            // plano nunca se encogía —crecía y se desplazaba el diálogo entero,
            // dejando los botones fuera de la vista.
            "flex w-[96vw] max-w-6xl flex-col gap-3 overflow-hidden p-4",
            // El alto lo manda la ventana, no el contenido: el plano es lo
            // único que crece, y se encoge solo para que quepa todo de una vez.
            "h-[88svh] max-h-[88svh]",
            "sala-tema",
            esOscuro && "sala-oscuro",
          )}
        >
          {/* Título y acciones en la MISMA fila: el botón de guardar se veía
              solo tras desplazarse hasta el final del diálogo, y en un plano
              que ya ocupa toda la pantalla eso obligaba a buscarlo. */}
          <DialogHeader className="shrink-0 space-y-0">
            <div className="flex items-center justify-between gap-3 pr-8">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Move className="h-4 w-4" />
                Mesas de la reserva
              </DialogTitle>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ocupado}
                  onClick={onCerrar}
                >
                  Cancelar
                </Button>
                <Button size="sm" disabled={ocupado || !hayCambios} onClick={validar}>
                  {comprobando ? "Comprobando…" : guardando ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {/* Qué reserva se está tocando y cómo va quedando la selección. */}
            {/* Todo en una línea: cada párrafo que se añada aquí se lo quita
                al plano, que es lo que de verdad hay que ver. */}
            <div className="shrink-0 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-muted/30 px-3 py-1.5 text-xs">
              <span className="font-medium text-foreground">
                {reserva.cliente || "WALK IN"} {reserva.apellidos}
              </span>
              <span className="text-muted-foreground">
                · {reserva.hora.slice(0, 5)} · {reserva.comensales} per ·
              </span>
              <span className="text-muted-foreground">
                {codigosOriginales.length > 0
                  ? codigosOriginales.join(" + ")
                  : "sin asignar"}
              </span>
              {hayCambios && (
                <span className="text-muted-foreground">
                  →{" "}
                  <span className="font-medium text-foreground">
                    {seleccion.length > 0
                      ? codigoCompuesto.split("+").join(" + ")
                      : "sin mesa"}
                  </span>
                </span>
              )}
              {/* El modo va aquí, junto al resumen: se ve qué va a pasar al
                  pulsar ANTES de pulsar. Con el texto de ayuda de antes había
                  que descubrirlo moviendo a un cliente por error. */}
              <div className="ml-auto flex items-center gap-1">
                <div className="flex items-center rounded-md border p-0.5">
                  {(["mover", "unir"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModo(m)}
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                        modo === m
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m === "mover" ? "Mover" : "Unir"}
                    </button>
                  ))}
                </div>
                <span className="text-muted-foreground">
                  {modo === "mover"
                    ? "Pulsa una mesa para llevar la reserva ahí."
                    : "Pulsa las mesas que quieres juntar."}
                </span>
              </div>
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
                onToggle={pulsarMesa}
                getReservasMesa={getReservasMesa}
                reservaId={reserva.id}
              />
            )}

            {/* Resumen del cambio, en una sola línea: se lee antes de guardar,
                con las mismas palabras que luego aparecen en la actividad. */}
            {hayCambios && (
              <div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border border-sky-500/40 bg-sky-500/5 px-3 py-1.5 text-xs">
                {anadidas.length > 0 && (
                  <span>
                    Se {anadidas.length === 1 ? "añadirá" : "añadirán"}{" "}
                    {anadidas.length === 1 ? "la mesa" : "las mesas"}{" "}
                    <span className="font-medium">{anadidas.join(", ")}</span>
                  </span>
                )}
                {quitadas.length > 0 && (
                  <span>
                    Se {quitadas.length === 1 ? "quitará" : "quitarán"}{" "}
                    {quitadas.length === 1 ? "la mesa" : "las mesas"}{" "}
                    <span className="font-medium">{quitadas.join(", ")}</span>
                  </span>
                )}
                {/* El intercambio mueve a alguien que no está en pantalla: si
                    no se dice aquí, se guarda sin recordar que hay una segunda
                    reserva cambiando de mesa. */}
                {intercambio && (
                  <span>
                    ·{" "}
                    <span className="font-medium">{intercambio.otraCliente}</span>{" "}
                    {intercambio.mesaParaLaOtra
                      ? `pasa a ${intercambio.mesaParaLaOtra.split("+").join(" + ")}`
                      : "se queda sin mesa"}
                  </span>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* La mesa pulsada ya tiene reserva. Aquí no se decide por el usuario:
          se para en medio de la pantalla y se pregunta qué quiere hacer, con
          los avisos delante. Las tres salidas son las de la sala: dejarlo
          estar, cambiar a la gente de sitio, o juntar las mesas igualmente. */}
      <Dialog open={decision !== null} onOpenChange={(v) => { if (!v) setDecision(null); }}>
        <DialogContent className={cn("max-w-lg", "sala-tema", esOscuro && "sala-oscuro")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ArrowLeftRight className="h-4 w-4" />
              La mesa {decision?.codigo} ya tiene reserva
            </DialogTitle>
          </DialogHeader>
          {decision && (
            <div className="space-y-3 text-xs">
              {/* Quién está en cada lado, para no tener que recordarlo. */}
              <div className="rounded-md border divide-y">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="truncate">
                    <span className="font-medium">
                      {reserva.cliente || "WALK IN"} {reserva.apellidos}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      · {reserva.hora.slice(0, 5)} · {reserva.comensales} per
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {codigosOriginales.length > 0
                      ? codigosOriginales.join(" + ")
                      : "sin mesa"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="truncate">
                    <span className="font-medium">
                      {decision.otra.cliente || "WALK IN"} {decision.otra.apellidos}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      · {decision.otra.hora.slice(0, 5)} · {decision.otra.comensales} per
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {decision.codigo}
                  </span>
                </div>
              </div>

              {/* Avisos. Ninguno bloquea: se dicen para que la decisión se tome
                  sabiendo con qué se va a encontrar sala al montar. */}
              {(decision.solapes.length > 0 ||
                decision.avisoAforo ||
                decision.avisoAforoOtra) && (
                <div className="space-y-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2">
                  {decision.avisoAforo && (
                    <p className="flex gap-1.5 text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                      <span>{decision.avisoAforo}</span>
                    </p>
                  )}
                  {decision.avisoAforoOtra && (
                    <p className="flex gap-1.5 text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                      <span>
                        Si se intercambian: {decision.avisoAforoOtra.charAt(0).toLowerCase()}
                        {decision.avisoAforoOtra.slice(1)}
                      </span>
                    </p>
                  )}
                  {decision.solapes.map((c) => (
                    <p
                      key={c.reservaId}
                      className="flex gap-1.5 text-amber-700 dark:text-amber-300"
                    >
                      <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                      <span>
                        Se pisa con {c.cliente || "WALK IN"} en {c.mesa}, que la
                        tiene ocupada hasta las {c.horaFin}.
                      </span>
                    </p>
                  ))}
                </div>
              )}

              {decision.bloqueadoPorIntercambio && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-amber-700 dark:text-amber-300">
                  Ya hay un intercambio pendiente con{" "}
                  {decision.bloqueadoPorIntercambio}. Guarda ese cambio antes de
                  hacer otro; aquí solo puedes unir la mesa.
                </p>
              )}

              {/* Qué hace cada botón, en una línea: se lee antes de pulsar. */}
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Intercambiar</span>{" "}
                cambia a las dos de sitio
                {codigosOriginales.length > 0
                  ? ` — ${decision.otra.cliente || "WALK IN"} pasa a ${codigosOriginales.join(" + ")}.`
                  : ` — ${decision.otra.cliente || "WALK IN"} se queda sin mesa, porque esta reserva no tiene ninguna que darle.`}{" "}
                <span className="font-medium text-foreground">Unir</span> deja a
                las dos reservas sobre {decision.codigo}.
              </p>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDecision(null)}
                >
                  Cancelar
                </Button>
                <Button size="sm" variant="outline" onClick={aceptarUnion}>
                  Unir
                </Button>
                <Button
                  size="sm"
                  disabled={decision.bloqueadoPorIntercambio !== null}
                  onClick={aceptarIntercambio}
                >
                  Intercambiar
                </Button>
              </div>
            </div>
          )}
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
                      {c.mesa} · ocupada hasta las {c.horaFin} · {c.personas} per
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
