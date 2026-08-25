"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Lista de filas (reglas, excepciones…) editable en memoria hasta que se pulsa
 * Guardar. Nada toca la base de datos antes de eso.
 *
 * El problema que resuelve: estas listas viven en tablas propias, con su `id`.
 * No se pueden acumular en un simple parche de campos como el resto de la
 * configuración. Aquí se lleva la cuenta de qué se ha añadido, editado y
 * borrado, y al confirmar se vuelca en el orden correcto.
 *
 * Las filas nuevas reciben un id temporal con prefijo `nueva:`. Si se borra una
 * fila nueva antes de guardar, desaparece sin más: nunca llegó a existir, así
 * que no hay nada que borrar en la base de datos.
 */

const PREFIJO_NUEVA = "nueva:";

export function esFilaNueva(id: string): boolean {
  return id.startsWith(PREFIJO_NUEVA);
}

export interface CambiosLista<TInput> {
  /** Altas, en el orden en que se crearon. */
  crear: TInput[];
  /** Ediciones de filas que ya existían en la base de datos. */
  editar: { id: string; input: TInput }[];
  /** Ids de filas existentes que se han marcado para borrar. */
  borrar: string[];
}

interface Opciones<TFila, TInput> {
  /** Cómo se lee el id de una fila. */
  idDe: (fila: TFila) => string;
  /** Convierte una fila en el input que esperan las acciones de servidor. */
  aInput: (fila: TFila) => TInput;
}

export function useListaPendiente<TFila, TInput>(
  { idDe, aInput }: Opciones<TFila, TInput>,
) {
  /** Lo que hay guardado en la base de datos, tal cual se cargó. */
  const [base, setBase] = useState<TFila[]>([]);
  /** Lo que se ve en pantalla, con los cambios sin guardar ya aplicados. */
  const [filas, setFilas] = useState<TFila[]>([]);
  /** Ids existentes marcados para borrar. */
  const [borradas, setBorradas] = useState<string[]>([]);
  /** Contador para los ids temporales; no se reinicia mientras viva el panel. */
  const [seq, setSeq] = useState(0);

  /** Carga inicial (o recarga tras guardar): descarta cualquier pendiente. */
  const cargar = useCallback((datos: TFila[]) => {
    setBase(datos);
    setFilas(datos);
    setBorradas([]);
  }, []);

  const nuevoIdTemporal = useCallback(() => {
    const id = `${PREFIJO_NUEVA}${seq}`;
    setSeq((n) => n + 1);
    return id;
  }, [seq]);

  /** Añade una fila. Debe traer ya puesto el id temporal. */
  const anadir = useCallback((fila: TFila) => {
    setFilas((prev) => [...prev, fila]);
  }, []);

  const reemplazar = useCallback(
    (id: string, fila: TFila) => {
      setFilas((prev) => prev.map((f) => (idDe(f) === id ? fila : f)));
    },
    [idDe],
  );

  const quitar = useCallback(
    (id: string) => {
      setFilas((prev) => prev.filter((f) => idDe(f) !== id));
      // Una fila nueva no existe en la base de datos: no hay nada que borrar.
      if (!esFilaNueva(id)) setBorradas((prev) => [...prev, id]);
    },
    [idDe],
  );

  /** Cambios acumulados, listos para volcar. */
  const cambios = useMemo<CambiosLista<TInput>>(() => {
    const porId = new Map(base.map((f) => [idDe(f), f]));
    const crear: TInput[] = [];
    const editar: { id: string; input: TInput }[] = [];

    for (const fila of filas) {
      const id = idDe(fila);
      if (esFilaNueva(id)) {
        crear.push(aInput(fila));
        continue;
      }
      const original = porId.get(id);
      // Se compara el input, no la fila entera: los campos que la base de datos
      // añade por su cuenta (updated_at y demás) no cuentan como edición.
      if (original && JSON.stringify(aInput(original)) !== JSON.stringify(aInput(fila))) {
        editar.push({ id, input: aInput(fila) });
      }
    }
    return { crear, editar, borrar: borradas };
  }, [base, filas, borradas, idDe, aInput]);

  const hayCambios =
    cambios.crear.length > 0 || cambios.editar.length > 0 || cambios.borrar.length > 0;

  return {
    filas,
    cargar,
    anadir,
    reemplazar,
    quitar,
    nuevoIdTemporal,
    cambios,
    hayCambios,
  };
}
