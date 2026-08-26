"use client";

import { useState, forwardRef } from "react";
import { Input } from "@/components/ui/input";

/**
 * Campo numérico que se puede vaciar para escribir.
 *
 * Un `<Input type="number" value={n} onChange={e => set(Number(e.target.value) || 0)} />`
 * deja un cero colgado: al borrar el contenido el estado cae a 0, el input
 * vuelve a pintar "0" y lo que se teclea después queda detrás ("015").
 *
 * Aquí el texto vive en estado propio (string), así que el campo puede quedarse
 * vacío mientras se escribe. Al padre solo se le envían números:
 * vacío equivale a `emptyValue` (0 por defecto). Al salir del campo se
 * normaliza el texto y se aplican `min`/`max`.
 */
interface NumberInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  value: number | null | undefined;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Valor que se envía al padre cuando el campo queda vacío. Por defecto 0. */
  emptyValue?: number;
  /** Admite decimales (coma o punto). Por defecto sí. */
  decimales?: boolean;
}

const acotar = (n: number, min?: number, max?: number) => {
  let v = n;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
};

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    { value, onValueChange, min, max, emptyValue = 0, decimales = true, onBlur, ...props },
    ref,
  ) {
    // Texto que ve el usuario. Mientras el campo está enfocado manda lo que se
    // teclea; cuando no lo está, se muestra el valor del padre. Se deriva en el
    // render (sin efecto) para no encadenar renders de más.
    const [txt, setTxt] = useState("");
    const [foco, setFoco] = useState(false);
    const textoDelValor = value === null || value === undefined ? "" : String(value);
    const visible = foco ? txt : textoDelValor;

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode={decimales ? "decimal" : "numeric"}
        value={visible}
        onFocus={(e) => { setTxt(textoDelValor); setFoco(true); props.onFocus?.(e); }}
        onChange={(e) => {
          const bruto = e.target.value;
          // Se permite vacío y el signo/coma intermedios mientras se escribe.
          const limpio = decimales
            ? bruto.replace(/[^0-9,.-]/g, "")
            : bruto.replace(/[^0-9-]/g, "");
          setTxt(limpio);
          if (limpio === "" || limpio === "-") {
            onValueChange(emptyValue);
            return;
          }
          // Mientras se escribe NO se acota: recortar en cada tecla impide
          // teclear "5" en un campo con mínimo 10, o pasar por "1" camino de "15".
          // El clamp se aplica al salir del campo (onBlur).
          const n = Number(limpio.replace(",", "."));
          if (Number.isFinite(n)) onValueChange(n);
        }}
        onBlur={(e) => {
          // Al salir se normaliza: vacío pasa a `emptyValue` y se aplican
          // min/max. A partir de aquí manda el valor del padre.
          setFoco(false);
          const n = Number(txt.replace(",", "."));
          onValueChange(txt === "" || !Number.isFinite(n) ? emptyValue : acotar(n, min, max));
          onBlur?.(e);
        }}
      />
    );
  },
);
