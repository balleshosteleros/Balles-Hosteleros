"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Check } from "lucide-react";

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

  // Aviso APRETADO: sale dentro de la ficha de la reserva, encima de todo lo
  // demás, y a tamaño normal empujaba media pantalla hacia abajo. Se reduce el
  // relleno, la letra y el alto de las filas, pero NO se quita ni un dato: los
  // dos juegos de valores y las tres salidas siguen enteros.
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 dark:border-amber-800/60 dark:bg-amber-950/30">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight text-amber-900 dark:text-amber-200">
            Esta reserva se vinculó a un cliente que ya existía
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-amber-800 dark:text-amber-300/90">
            Coincidió por {datos.motivo === "email" ? "el correo" : "el teléfono"}
            {valorCoincide ? " " : ""}
            {valorCoincide ? <span className="font-medium">{valorCoincide}</span> : null}, pero
            el resto de datos no son los mismos. Revisa si es la misma persona.
          </p>

          <div className="mt-1.5 overflow-x-auto">
            {/* `w-auto`: la tabla se ciñe a su contenido en vez de estirar las
                tres columnas a todo lo ancho de la ficha, que era lo que
                dejaba "Puso al reservar" perdido al otro extremo. */}
            <table className="w-auto text-[11px]">
              <thead>
                <tr className="text-left text-amber-700 dark:text-amber-400">
                  <th className="pb-0.5 pr-3 font-medium">Campo</th>
                  <th className="pb-0.5 pr-3 font-medium">Ficha actual</th>
                  <th className="pb-0.5 font-medium">Puso al reservar</th>
                </tr>
              </thead>
              <tbody className="text-amber-900 dark:text-amber-200">
                {valorCoincide ? (
                  <tr className="border-t border-amber-200/70 dark:border-amber-800/50">
                    <td className="py-0.5 pr-3 text-amber-700 dark:text-amber-400">
                      {CAMPO_LABEL[campoCoincide]}
                    </td>
                    <td className="py-0.5 pr-3" colSpan={2}>
                      <span className="inline-flex items-center gap-1">
                        <Check className="size-3 shrink-0 text-emerald-600 dark:text-emerald-500" />
                        <span className="font-medium">{valorCoincide}</span>
                        <span className="text-amber-700 dark:text-amber-400">
                          — es el mismo, por esto se vincularon
                        </span>
                      </span>
                    </td>
                  </tr>
                ) : null}
                {campos.map((c) => (
                  <tr key={c} className="border-t border-amber-200/70 dark:border-amber-800/50">
                    <td className="py-0.5 pr-3 text-amber-700 dark:text-amber-400">
                      {CAMPO_LABEL[c]}
                    </td>
                    <td className="py-0.5 pr-3">{datos.ficha[c] || "—"}</td>
                    <td className="py-0.5 font-medium">{datos.declarados[c]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* El orden no es decorativo: conservar la ficha es lo que más se
              elige —el cliente escribe su nombre de otra forma, no cambia de
              persona—, así que va primera y destacada. */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={enviando}
              onClick={() => resolver("CONSERVAR")}
            >
              Conservar original
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={enviando}
              onClick={() => resolver("ACTUALIZAR")}
            >
              Actualizar datos
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={enviando}
              onClick={() => resolver("SEPARAR")}
            >
              Es un cliente nuevo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
