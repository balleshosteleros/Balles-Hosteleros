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
export function RevisionVinculacion({ reservaId, onResuelto }: Props) {
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

  if (cargando || !datos) return null;

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

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/30">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Esta reserva se vinculó a un cliente que ya existía
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300/90">
            Coincidió por {datos.motivo === "email" ? "el correo" : "el teléfono"}
            {valorCoincide ? " " : ""}
            {valorCoincide ? <span className="font-medium">{valorCoincide}</span> : null}, pero
            el resto de datos no son los mismos. Revisa si es la misma persona.
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[22rem] text-xs">
              <thead>
                <tr className="text-left text-amber-700 dark:text-amber-400">
                  <th className="pb-1 pr-3 font-medium">Campo</th>
                  <th className="pb-1 pr-3 font-medium">Ficha actual</th>
                  <th className="pb-1 font-medium">Puso al reservar</th>
                </tr>
              </thead>
              <tbody className="text-amber-900 dark:text-amber-200">
                {valorCoincide ? (
                  <tr className="border-t border-amber-200/70 dark:border-amber-800/50">
                    <td className="py-1 pr-3 text-amber-700 dark:text-amber-400">
                      {CAMPO_LABEL[campoCoincide]}
                    </td>
                    <td className="py-1 pr-3" colSpan={2}>
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" />
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
                    <td className="py-1 pr-3 text-amber-700 dark:text-amber-400">
                      {CAMPO_LABEL[c]}
                    </td>
                    <td className="py-1 pr-3">{datos.ficha[c] || "—"}</td>
                    <td className="py-1 font-medium">{datos.declarados[c]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3.5 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={enviando}
              onClick={() => resolver("CONSERVAR")}
            >
              Conservar original
            </Button>
            <Button size="sm" disabled={enviando} onClick={() => resolver("ACTUALIZAR")}>
              Actualizar datos
            </Button>
            <Button
              size="sm"
              variant="outline"
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
