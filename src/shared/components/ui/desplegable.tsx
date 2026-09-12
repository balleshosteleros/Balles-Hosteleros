"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * EL desplegable del software — sustituye al `<select>` del navegador.
 *
 * El nativo lo pinta el sistema operativo: en Mac sale una lista gris pegada al
 * borde de la pantalla, en Windows otra, en el móvil una rueda, y en ninguno de
 * los tres se puede tocar ni el color, ni la letra, ni el redondeo. Este va
 * siempre igual, con la tipografía y el color de la casa.
 *
 * Habla EXACTAMENTE igual que el nativo —`value`, `onChange` con
 * `e.target.value` y sus `<option>` dentro— para poder cambiarlo en las 90
 * pantallas donde estaba sin tocar la lógica de ningún formulario. Los
 * `<option>` no llegan a pintarse: se leen y se convierten en opciones nuestras.
 *
 * El "sin elegir" (`<option value="">`) se guarda por dentro con un valor
 * inventado, porque la pieza de debajo no admite el vacío; de puertas afuera
 * sigue siendo "" y el formulario no se entera.
 *
 * CUÁL USAR: dentro del software, este —por debajo lleva el mismo desplegable
 * que ya usan otras 150 pantallas, así que todo se lee igual—. En las webs
 * públicas (reservas), `SelectorOpcion`, que es el que sabe pintarse con el
 * color de cada restaurante.
 */

const VACIO = "__sin_elegir__";

interface Opcion {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
  grupo?: string;
}

/** Lee los `<option>` (y sus `<optgroup>`) que le hayan puesto dentro. */
function leerOpciones(nodos: React.ReactNode, grupo?: string): Opcion[] {
  const fuera: Opcion[] = [];
  React.Children.forEach(nodos, (hijo) => {
    if (!React.isValidElement(hijo)) return;
    const props = hijo.props as Record<string, unknown>;
    if (hijo.type === React.Fragment) {
      fuera.push(...leerOpciones(props.children as React.ReactNode, grupo));
      return;
    }
    if (hijo.type === "optgroup") {
      fuera.push(
        ...leerOpciones(props.children as React.ReactNode, String(props.label ?? "")),
      );
      return;
    }
    if (hijo.type !== "option") return;
    const hijos = props.children as React.ReactNode;
    const valor =
      props.value !== undefined && props.value !== null
        ? String(props.value)
        : typeof hijos === "string"
          ? hijos
          : "";
    fuera.push({
      value: valor,
      label: hijos,
      disabled: Boolean(props.disabled),
      grupo,
    });
  });
  return fuera;
}

export interface DesplegableProps {
  value?: string | number | null;
  defaultValue?: string;
  onChange?: (e: { target: { value: string } }) => void;
  children?: React.ReactNode;
  className?: string;
  /** Aire y forma de la lista desplegada. */
  classNameLista?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Texto en gris cuando no hay nada elegido. Si no, el del `<option value="">`. */
  placeholder?: string;
}

export function Desplegable({
  value,
  defaultValue,
  onChange,
  children,
  className,
  classNameLista,
  disabled,
  id,
  name,
  required,
  autoFocus,
  placeholder,
  ...aria
}: DesplegableProps) {
  const opciones = React.useMemo(() => leerOpciones(children), [children]);
  const vacia = opciones.find((o) => o.value === "");
  const textoVacio =
    placeholder ?? (typeof vacia?.label === "string" ? vacia.label : undefined);

  const valor = value === null || value === undefined ? undefined : String(value);
  const grupos = React.useMemo(() => {
    const mapa = new Map<string, Opcion[]>();
    for (const o of opciones) {
      const k = o.grupo ?? "";
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(o);
    }
    return [...mapa.entries()];
  }, [opciones]);

  const item = (o: Opcion, i: number) => (
    <SelectItem
      key={`${o.value}-${i}`}
      value={o.value === "" ? VACIO : o.value}
      disabled={o.disabled}
    >
      {o.label}
    </SelectItem>
  );

  return (
    <Select
      value={valor === "" ? VACIO : valor}
      defaultValue={defaultValue === "" ? VACIO : defaultValue}
      onValueChange={(v) => onChange?.({ target: { value: v === VACIO ? "" : v } })}
      disabled={disabled}
      name={name}
      required={required}
    >
      <SelectTrigger
        id={id}
        autoFocus={autoFocus}
        className={cn("h-9", className)}
        {...aria}
      >
        <SelectValue placeholder={textoVacio} />
      </SelectTrigger>
      <SelectContent className={classNameLista}>
        {grupos.map(([nombre, lista]) =>
          nombre ? (
            <SelectGroup key={nombre}>
              <SelectLabel>{nombre}</SelectLabel>
              {lista.map(item)}
            </SelectGroup>
          ) : (
            lista.map(item)
          ),
        )}
      </SelectContent>
    </Select>
  );
}
