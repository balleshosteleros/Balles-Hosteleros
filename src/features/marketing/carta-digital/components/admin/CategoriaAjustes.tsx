"use client";

import { useEffect, useState, useTransition } from "react";
import { SelectorHora } from "@/shared/components/ui/selector-hora";
import type { CartaCategoria, FormatoFoto, FamiliaCarta } from "../../types";
import { DIAS_CORTOS, textoHorario } from "../../lib/horario";
import { actualizarCategoria } from "../../actions/carta-admin-actions";

/** Los tres apartados del primer nivel de la carta, en su orden. */
export const APARTADOS: { clave: FamiliaCarta; nombre: string }[] = [
  { clave: "comida", nombre: "Comida" },
  { clave: "bebida", nombre: "Bebida" },
  { clave: "otros", nombre: "Otros" },
];

/**
 * Todo lo que se configura de UNA categoría: en qué apartado vive, cómo se ven
 * sus fotos, si es una dieta especial y a qué horas se sirve.
 *
 * Va a la vista, sin plegar y debajo del nombre: estaba escrito pero no salía
 * en ninguna pantalla, así que a efectos de quien monta la carta no existía.
 */
export function CategoriaAjustes({
  cat,
  formatoCarta,
}: {
  cat: CartaCategoria;
  /** Forma de foto de la casa, la que se usa si la categoría no dice otra. */
  formatoCarta: FormatoFoto;
}) {
  const [pending, startTransition] = useTransition();
  const [dias, setDias] = useState<number[]>(cat.dias_semana ?? []);
  const [desde, setDesde] = useState((cat.hora_desde ?? "").slice(0, 5));
  const [hasta, setHasta] = useState((cat.hora_hasta ?? "").slice(0, 5));

  // Al cambiar de categoría activa, el horario que se enseña es el suyo.
  useEffect(() => {
    setDias(cat.dias_semana ?? []);
    setDesde((cat.hora_desde ?? "").slice(0, 5));
    setHasta((cat.hora_hasta ?? "").slice(0, 5));
  }, [cat.id, cat.dias_semana, cat.hora_desde, cat.hora_hasta]);

  const guardarHorario = (d: number[], hd: string, hh: string) => {
    startTransition(async () => {
      await actualizarCategoria({ id: cat.id, diasSemana: d, horaDesde: hd, horaHasta: hh });
    });
  };

  const toggleDia = (n: number) => {
    const d = dias.includes(n) ? dias.filter((x) => x !== n) : [...dias, n].sort((a, b) => a - b);
    setDias(d);
    guardarHorario(d, desde, hasta);
  };

  const quitarHorario = () => {
    setDias([]);
    setDesde("");
    setHasta("");
    guardarHorario([], "", "");
  };

  const guardar = (patch: Parameters<typeof actualizarCategoria>[0]) => {
    startTransition(async () => {
      await actualizarCategoria(patch);
    });
  };

  // La frase que leería un cliente con lo que hay marcado ahora mismo: es la
  // comprobación de que lo configurado dice lo que se cree que dice.
  const frase = textoHorario({
    dias_semana: dias.length > 0 ? dias : null,
    hora_desde: desde || null,
    hora_hasta: hasta || null,
  });

  const formato = cat.formato_foto ?? formatoCarta;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      {/* Primer nivel de la carta: el comensal elige antes "qué quiero" y solo
          después el tipo. Una categoría sin apartado cae en comida. */}
      <Fila etiqueta="Apartado">
        {APARTADOS.map(({ clave, nombre }) => (
          <Pildora
            key={clave}
            activa={(cat.familia ?? "comida") === clave}
            disabled={pending}
            onClick={() => guardar({ id: cat.id, familia: clave })}
          >
            {nombre}
          </Pildora>
        ))}
      </Fila>

      {/* Forma de las fotos de ESTA categoría. Todas comparten alto, que es lo
          que hace que la rejilla cuadre; y no todo se fotografía igual: una
          botella pide vertical y un plato puede ir cuadrado. */}
      <Fila etiqueta="Fotos">
        {([
          { v: "cuadrada" as const, t: "Cuadrada" },
          { v: "vertical" as const, t: "Vertical" },
        ]).map(({ v, t }) => (
          <Pildora
            key={v}
            activa={formato === v}
            disabled={pending}
            onClick={() => guardar({ id: cat.id, formatoFoto: v })}
          >
            {t}
          </Pildora>
        ))}
        <span className="text-xs text-muted-foreground">
          Así se ven todas las fotos de esta categoría.
        </span>
      </Fila>

      <Fila etiqueta="Dietas">
        <Pildora
          activa={cat.destacada}
          disabled={pending}
          onClick={() => guardar({ id: cat.id, destacada: !cat.destacada })}
        >
          Dieta especial
        </Pildora>
        <span className="text-xs text-muted-foreground">
          Celíacos, veganos o niños: sale con un filete de acento propio.
        </span>
      </Fila>

      {/* Cuándo se sirve. Sin nada marcado, todo el día y todos los días. La
          hora de fin puede ser MENOR que la de inicio: entonces la franja cruza
          la medianoche y termina al día siguiente. */}
      <Fila etiqueta="Días">
        {DIAS_CORTOS.map((d) => (
          <Pildora
            key={d.n}
            activa={dias.includes(d.n)}
            disabled={pending}
            onClick={() => toggleDia(d.n)}
            aria-label={d.nombre}
          >
            {d.letra}
          </Pildora>
        ))}
        {dias.length === 0 ? (
          <span className="text-xs text-muted-foreground">Todos los días.</span>
        ) : null}
      </Fila>

      <Fila etiqueta="Horas">
        <span className="text-xs text-muted-foreground">De</span>
        <SelectorHora
          value={desde}
          compacto
          disabled={pending}
          aria-label="Hora de inicio"
          onChange={setDesde}
          onCommit={(h) => guardarHorario(dias, h, hasta)}
        />
        <span className="text-xs text-muted-foreground">a</span>
        <SelectorHora
          value={hasta}
          compacto
          disabled={pending}
          aria-label="Hora de fin"
          onChange={setHasta}
          onCommit={(h) => guardarHorario(dias, desde, h)}
        />
        {dias.length > 0 || desde || hasta ? (
          <button
            type="button"
            disabled={pending}
            onClick={quitarHorario}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
          >
            Quitar horario
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">A cualquier hora.</span>
        )}
      </Fila>

      <p className="text-xs italic text-muted-foreground">
        {frase
          ? `${frase}. Fuera de esa franja, la categoría no aparece en la carta.`
          : "Esta categoría se ve siempre, a cualquier hora y todos los días."}
      </p>
    </div>
  );
}

/** Etiqueta a la izquierda y sus controles a la derecha, como el resto del panel. */
function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-bold uppercase text-muted-foreground">
        {etiqueta}
      </span>
      {children}
    </div>
  );
}

/** Botón de opción del panel: marcado con el color de la empresa. */
export function Pildora({
  activa,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { activa: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
        activa
          ? "border-primary bg-primary/5 text-primary"
          : "text-muted-foreground hover:bg-muted/40"
      }`}
    >
      {children}
    </button>
  );
}
