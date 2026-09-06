"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getVinculacionPendiente,
  resolverVinculacion,
  type ResolucionVinculacion,
  type VinculacionPendiente,
} from "@/features/sala/actions/reserva-vinculacion-actions";

interface Props {
  reservaId: string;
  /** Para que la vista de la reserva se recargue tras resolver. */
  onResuelto?: () => void;
  /**
   * La reserva viene marcada como pendiente de revisar. Solo sirve para saber
   * si hay que reservar el hueco mientras se cargan los datos: sin esto, o no
   * se pinta nada (y abrir la reserva no explica el triángulo de la fila), o
   * se pinta un "comprobando" en todas las reservas, que no tienen nada que
   * revisar. Lo que se acaba enseñando lo decide siempre el servidor.
   */
  pendiente?: boolean;
}

/** Nombre del campo tal y como se lee en sala. */
const CAMPO_LABEL: Record<string, string> = {
  nombre: "Nombre",
  apellidos: "Apellidos",
  email: "Correo",
  telefono: "Teléfono",
};

/**
 * Aviso de reserva vinculada a un cliente que ya existía, con los datos sin
 * coincidir. Sólo se ve cuando hay algo que revisar.
 *
 * Muestra los dos juegos de datos enfrentados y deja que decida el restaurante:
 * el sistema no puede saber si el móvil compartido es de la misma persona o de
 * su pareja.
 */
export function RevisionVinculacion({ reservaId, onResuelto, pendiente }: Props) {
  const [datos, setDatos] = useState<VinculacionPendiente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, startTransition] = useTransition();

  // Quien monta este componente le pasa una `key` que cambia con la reserva, así
  // que se remonta ya en estado de carga: no hace falta reponerlo desde dentro.
  useEffect(() => {
    let vivo = true;
    getVinculacionPendiente(reservaId).then((r) => {
      if (!vivo) return;
      setDatos(r.ok ? r.data : null);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [reservaId]);

  // Mientras carga se reserva el sitio con un aviso neutro, en vez de no
  // pintar nada: la fila lleva el triángulo de "datos sin revisar", y abrir la
  // reserva y no ver nada donde debería estar la explicación hace pensar que
  // el aviso es un fallo. Ocupa el mismo hueco que ocupará el recuadro.
  if (cargando) {
    if (!pendiente) return null;
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-300/90">
        Comprobando los datos del cliente…
      </div>
    );
  }
  if (!datos) return null;

  // El dato que provocó el enganche NO viaja en `declarados` (ahí sólo van los
  // que difieren), así que la tabla se lo comía justo cuando es el motivo del
  // aviso: se lee de la ficha y se pinta aparte, como coincidencia.
  const campoCoincide = datos.motivo === "email" ? "email" : "telefono";
  const valorCoincide = datos.ficha[campoCoincide];

  // El campo del enganche se pinta arriba como coincidencia; nunca repetido abajo.
  // Además se descartan los que ya coinciden con la ficha: al resolver otra
  // reserva del mismo cliente la ficha se pone al día, y lo que aquí quedaba
  // "pendiente" puede ser ya idéntico. Un aviso que enfrenta un dato consigo
  // mismo no da nada que revisar.
  const igualQueLaFicha = (c: "nombre" | "apellidos" | "email" | "telefono") =>
    (datos.declarados[c] ?? "").trim().toLowerCase() ===
    (datos.ficha[c] ?? "").trim().toLowerCase();

  const campos = (["nombre", "apellidos", "email", "telefono"] as const).filter(
    (c) =>
      datos.declarados[c] &&
      !(valorCoincide && c === campoCoincide) &&
      !igualQueLaFicha(c),
  );

  // Ya no queda ninguna diferencia: la revisión se quedó sin objeto.
  if (campos.length === 0) return null;

  function resolver(resolucion: ResolucionVinculacion) {
    startTransition(async () => {
      const r = await resolverVinculacion(reservaId, resolucion);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const mensaje =
        resolucion === "CONSERVAR"
          ? "Se conservan los datos de la ficha."
          : resolucion === "ACTUALIZAR"
            ? "Ficha del cliente actualizada."
            : "Se creó una ficha nueva para este cliente.";
      toast.success(mensaje);
      setDatos(null);
      onResuelto?.();
    });
  }

  // ESQUEMA, no prosa. Antes había que leer tres frases seguidas para saber qué
  // decidir, y los botones no decían qué pasaba al pulsarlos ("Conservar" ¿el
  // qué?). Ahora los dos juegos de datos van EN COLUMNA, uno al lado del otro
  // y con su rótulo encima, y CADA BOTÓN VA DEBAJO DE LA COLUMNA QUE ELIGE:
  // se ve de un vistazo que la decisión es "me quedo con esta o con esta".
  const etiquetaMotivo = datos.motivo === "email" ? "Mismo correo" : "Mismo teléfono";

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 dark:border-amber-800/60 dark:bg-amber-950/30">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="min-w-0 flex-1">
          {/* Una sola línea arriba: qué pasó y el dato que lo provocó. */}
          <p className="text-xs font-semibold leading-tight text-amber-900 dark:text-amber-200">
            ¿Es la misma persona?
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-800 dark:text-amber-300/90">
            {etiquetaMotivo}
            {valorCoincide ? (
              <>
                {": "}
                <span className="font-medium">{valorCoincide}</span>
              </>
            ) : null}
          </p>

          {/* Las dos versiones ENFRENTADAS en columna, con su rótulo encima.
              Cada fila es un campo que no cuadra; el rótulo de la izquierda
              queda fuera para no repetirlo en las dos columnas. */}
          <div className="mt-1.5 grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-0.5 text-[11px]">
            <span />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Ficha guardada
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Puso al reservar
            </span>
            {campos.map((c) => (
              <Fragment key={c}>
                <span className="text-amber-700 dark:text-amber-400">
                  {CAMPO_LABEL[c]}
                </span>
                <span className="truncate text-amber-900 dark:text-amber-200">
                  {datos.ficha[c] || "—"}
                </span>
                <span className="truncate font-medium text-amber-900 dark:text-amber-200">
                  {datos.declarados[c]}
                </span>
              </Fragment>
            ))}

            {/* Cada botón DEBAJO de la columna que elige: el de la izquierda se
                queda con la ficha, el de la derecha la reescribe con lo nuevo.
                Sin esto había que deducir qué hacía cada palabra. */}
            <span />
            <Button
              size="sm"
              className="mt-1 h-6 px-2 text-[11px]"
              disabled={enviando}
              onClick={() => resolver("CONSERVAR")}
            >
              Dejar esta
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="mt-1 h-6 px-2 text-[11px]"
              disabled={enviando}
              onClick={() => resolver("ACTUALIZAR")}
            >
              Poner esta
            </Button>
          </div>

          {/* La tercera salida NO es una de las dos columnas —no se elige un
              juego de datos, se rompe el enganche—, así que va aparte y en
              texto, para que no compita con la decisión principal. */}
          <button
            type="button"
            disabled={enviando}
            onClick={() => resolver("SEPARAR")}
            className="mt-1.5 text-[11px] underline underline-offset-2 text-amber-700 hover:text-amber-900 disabled:opacity-50 dark:text-amber-400 dark:hover:text-amber-200"
          >
            No, es otro cliente
          </button>
        </div>
      </div>
    </div>
  );
}
