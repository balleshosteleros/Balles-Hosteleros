"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";

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

  // Aviso MÍNIMO: sale dentro de la ficha, encima de todo, así que cada
  // renglón que ocupa lo pierde la reserva. Se queda lo que hace falta para
  // decidir: por qué se vincularon, en qué NO coinciden, y las tres salidas.
  // Fuera la tabla con cabeceras y la fila del dato coincidente: el motivo ya
  // lo dice el subtítulo, repetirlo abajo con su marca verde era el mismo dato
  // dos veces y la mitad del alto del recuadro.
  const etiquetaMotivo = datos.motivo === "email" ? "el correo" : "el teléfono";

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 dark:border-amber-800/60 dark:bg-amber-950/30">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight text-amber-900 dark:text-amber-200">
            Cliente ya existente
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-800 dark:text-amber-300/90">
            Coincide {etiquetaMotivo}
            {valorCoincide ? (
              <>
                {" "}
                <span className="font-medium">{valorCoincide}</span>
              </>
            ) : null}
            . ¿Es la misma persona?
          </p>

          {/* Las diferencias, una por renglón: lo de la ficha, la flecha, y lo
              que puso al reservar. Sin cabeceras: con la flecha en medio se
              entiende de qué lado está cada cosa sin tener que rotularlo. */}
          <ul className="mt-1 space-y-0.5 text-[11px] text-amber-900 dark:text-amber-200">
            {campos.map((c) => (
              <li key={c} className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-amber-700 dark:text-amber-400">
                  {CAMPO_LABEL[c]}
                </span>
                <span>{datos.ficha[c] || "—"}</span>
                <ArrowRight className="size-3 shrink-0 self-center text-amber-600/70 dark:text-amber-500/70" />
                <span className="font-medium">{datos.declarados[c]}</span>
              </li>
            ))}
          </ul>

          {/* El orden no es decorativo: conservar la ficha es lo que más se
              elige —el cliente escribe su nombre de otra forma, no cambia de
              persona—, así que va primera y destacada. */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={enviando}
              onClick={() => resolver("CONSERVAR")}
            >
              Conservar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={enviando}
              onClick={() => resolver("ACTUALIZAR")}
            >
              Actualizar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={enviando}
              onClick={() => resolver("SEPARAR")}
            >
              Es otro cliente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
