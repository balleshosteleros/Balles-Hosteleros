"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Pencil, Trash2, Eye, EyeOff, Plus, ChevronUp, ChevronDown, SlidersHorizontal } from "lucide-react";
import { SelectorHora } from "@/components/ui/selector-hora";
import type { CartaCategoria, CartaItem, FormatoFoto, FamiliaCarta } from "../../types";
import { DIAS_CORTOS, textoHorario } from "../../lib/horario";
import {
  actualizarCategoria,
  borrarCategoria,
  reordenarCategorias,
  reordenarItems,
} from "../../actions/carta-admin-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import Image from "next/image";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

export function CategoriaCard({
  cat,
  items,
  index,
  total,
  todasCategorias,
  onAddItem,
  onEditItem,
}: {
  cat: CartaCategoria;
  items: CartaItem[];
  index: number;
  total: number;
  todasCategorias: CartaCategoria[];
  onAddItem: (categoriaId: string) => void;
  onEditItem: (item: CartaItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(cat.nombre);
  const [pending, startTransition] = useTransition();
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const handleSaveNombre = () => {
    startTransition(async () => {
      await actualizarCategoria({ id: cat.id, nombre });
      setEditing(false);
    });
  };

  // Los ajustes de la categoría —apartado, dietas, fotos y horario— viven
  // plegados: lo que se toca a diario son los platos, y estos se configuran
  // una vez y se olvidan.
  const [ajustes, setAjustes] = useState(false);
  const [dias, setDias] = useState<number[]>(cat.dias_semana ?? []);
  const [desde, setDesde] = useState((cat.hora_desde ?? "").slice(0, 5));
  const [hasta, setHasta] = useState((cat.hora_hasta ?? "").slice(0, 5));

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

  // La frase que leería un cliente, con lo que hay marcado ahora mismo: es la
  // comprobación de que lo configurado dice lo que se cree que dice.
  const frase = textoHorario({
    dias_semana: dias.length > 0 ? dias : null,
    hora_desde: desde || null,
    hora_hasta: hasta || null,
  });

  const handleFamilia = (familia: FamiliaCarta) => {
    startTransition(async () => {
      await actualizarCategoria({ id: cat.id, familia });
    });
  };

  const handleDestacada = () => {
    startTransition(async () => {
      await actualizarCategoria({ id: cat.id, destacada: !cat.destacada });
    });
  };

  const handleFormato = (formatoFoto: FormatoFoto | null) => {
    startTransition(async () => {
      await actualizarCategoria({ id: cat.id, formatoFoto });
    });
  };

  const handleToggleVisible = () => {
    startTransition(async () => {
      await actualizarCategoria({ id: cat.id, visible: !cat.visible });
    });
  };

  const handleBorrar = async () => {
    const ok = await confirmDelete({
      title: "Borrar categoría",
      description: `Se borrará la categoría "${cat.nombre}" y todos sus platos.`,
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    startTransition(async () => {
      await borrarCategoria(cat.id);
    });
  };

  const handleMove = (dir: -1 | 1) => {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= total) return;
    startTransition(async () => {
      const ordenList = [...todasCategorias];
      const [moved] = ordenList.splice(index, 1);
      ordenList.splice(newIdx, 0, moved);
      await reordenarCategorias(ordenList.map((c, i) => ({ id: c.id, orden: i })));
    });
  };

  const handleMoveItem = (itemIdx: number, dir: -1 | 1) => {
    const newIdx = itemIdx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    startTransition(async () => {
      const list = [...items];
      const [moved] = list.splice(itemIdx, 1);
      list.splice(newIdx, 0, moved);
      await reordenarItems(list.map((it, i) => ({ id: it.id, orden: i })));
    });
  };

  return (
    <Card className={cat.visible ? "" : "opacity-60"}>
      {confirmDeleteDialog}
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex flex-1 items-center gap-2">
          {editing ? (
            <div className="flex flex-1 gap-2">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} />
              <Button onClick={handleSaveNombre} disabled={pending} size="sm" variant="primary">
                Guardar
              </Button>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-semibold">{cat.nombre}</h3>
              <span className="text-sm text-stone-500">({items.length})</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            disabled={index === 0 || pending}
            onClick={() => handleMove(-1)}
            aria-label="Subir categoría"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={index === total - 1 || pending}
            onClick={() => handleMove(1)}
            aria-label="Bajar categoría"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setAjustes((v) => !v)}
            aria-label="Ajustes de la categoría"
            className={ajustes ? "text-primary" : undefined}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setEditing((v) => !v)} aria-label="Renombrar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleToggleVisible}
            disabled={pending}
            aria-label={cat.visible ? "Ocultar" : "Mostrar"}
          >
            {cat.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleBorrar}
            disabled={pending}
            aria-label="Borrar"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {ajustes ? (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            {/* Apartado del primer nivel de la carta: el comensal elige antes
                "qué quiero" y solo después el tipo. */}
            <Fila etiqueta="Apartado">
              {([
                { v: "comida" as const, t: "Comida" },
                { v: "bebida" as const, t: "Bebida" },
                { v: "otros" as const, t: "Otros" },
              ]).map(({ v, t }) => (
                <Pildora
                  key={v}
                  activa={cat.familia === v}
                  disabled={pending}
                  onClick={() => handleFamilia(v)}
                >
                  {t}
                </Pildora>
              ))}
            </Fila>

            {/* Forma de las fotos de ESTA categoría. Todas comparten alto, que
                es lo que hace que la rejilla cuadre; y no todo se fotografía
                igual: una botella pide vertical y un plato horizontal. "Por
                defecto" deja mandar al formato de la carta. */}
            <Fila etiqueta="Fotos">
              {([
                { v: null, t: "Por defecto" },
                { v: "cuadrada" as const, t: "Cuadrada" },
                { v: "vertical" as const, t: "Vertical" },
              ]).map(({ v, t }) => (
                <Pildora
                  key={t}
                  activa={(cat.formato_foto ?? null) === v}
                  disabled={pending}
                  onClick={() => handleFormato(v)}
                >
                  {t}
                </Pildora>
              ))}
            </Fila>

            <Fila etiqueta="Dietas">
              <Pildora activa={cat.destacada} disabled={pending} onClick={handleDestacada}>
                Dieta especial
              </Pildora>
              <span className="text-xs text-muted-foreground">
                Celíacos, veganos o niños: sale con un filete de acento propio.
              </span>
            </Fila>

            {/* Cuándo se sirve. Sin nada marcado, todo el día y todos los días.
                La hora de fin puede ser MENOR que la de inicio: entonces la
                franja cruza la medianoche y termina al día siguiente. */}
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
        ) : null}

        {/* Cuándo se sirve. Sin días ni horas, la categoría se ve siempre; es
            lo normal y por eso el detalle vive plegado. La franja puede cruzar
            la medianoche (de 23:30 a 19:30), que es como funciona una cocina
            de noche: lo que se escribe es cuándo SÍ se sirve. */}
        <div className="pb-1">
          <button
            type="button"
            onClick={() => setAjustes((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground transition hover:text-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Horario
            <span className="font-medium normal-case text-muted-foreground/80">
              {dias.length === 0 && !desde && !hasta
                ? "· todo el día"
                : `· ${dias.length === 0 || dias.length === 7 ? "todos los días" : dias.map((d) => DIAS[d - 1]).join(" ")}${desde || hasta ? `, ${desde || "00:00"}–${hasta || "23:59"}` : ""}`}
            </span>
          </button>

          {ajustes ? (
            <div className="mt-2 space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {DIAS.map((d, i) => {
                  const n = i + 1;
                  const on = dias.includes(n);
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={pending}
                      onClick={() => toggleDia(n)}
                      className={`h-8 w-9 rounded-md border text-xs font-semibold transition disabled:opacity-50 ${
                        on ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
                {dias.length > 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { setDias([]); guardarHorario([], desde, hasta); }}
                    className="ml-1 text-xs font-medium text-muted-foreground underline underline-offset-2 disabled:opacity-50"
                  >
                    Todos los días
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Se sirve de</span>
                <Input
                  type="time"
                  value={desde}
                  disabled={pending}
                  onChange={(e) => setDesde(e.target.value)}
                  onBlur={() => guardarHorario(dias, desde, hasta)}
                  className="h-8 w-28"
                />
                <span className="text-xs text-muted-foreground">a</span>
                <Input
                  type="time"
                  value={hasta}
                  disabled={pending}
                  onChange={(e) => setHasta(e.target.value)}
                  onBlur={() => guardarHorario(dias, desde, hasta)}
                  className="h-8 w-28"
                />
                {desde || hasta ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { setDesde(""); setHasta(""); guardarHorario(dias, "", ""); }}
                    className="text-xs font-medium text-muted-foreground underline underline-offset-2 disabled:opacity-50"
                  >
                    Todo el día
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">Apartado</span>
                {(["comida", "bebida", "otros"] as FamiliaCarta[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    disabled={pending}
                    onClick={() => handleFamilia(f)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition disabled:opacity-50 ${
                      (cat.familia ?? "comida") === f
                        ? "border-primary bg-primary/5 text-primary"
                        : "text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleDestacada}
                  className={`ml-1 rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                    cat.destacada
                      ? "border-primary bg-primary/5 text-primary"
                      : "text-muted-foreground hover:bg-muted/40"
                  }`}
                  title="Celíacos, veganos, niños: se separan del resto en la navegación"
                >
                  Dieta especial
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="text-sm italic text-stone-500">Sin platos en esta categoría.</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {items.map((item, idx) => (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-stone-100">
                  {item.foto_url ? (
                    <Image
                      src={item.foto_url}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg text-stone-400">
                      🍽
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{item.nombre}</span>
                    {item.destacado ? (
                      <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">
                        Destacado
                      </span>
                    ) : null}
                    {/* Los tres estados, con el mismo nombre que en el editor:
                        agotado NO es una forma de invisible. */}
                    {!item.visible ? (
                      <span className="rounded-full bg-stone-200 px-2 text-xs text-stone-700">
                        Invisible
                      </span>
                    ) : item.agotado ? (
                      <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">
                        Agotado
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-stone-500">
                    {item.precio.toFixed(2)} € · ❤ {item.likes_count}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === 0 || pending}
                    onClick={() => handleMoveItem(idx, -1)}
                    aria-label="Subir plato"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === items.length - 1 || pending}
                    onClick={() => handleMoveItem(idx, 1)}
                    aria-label="Bajar plato"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onEditItem(item)}>
                    Editar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={() => onAddItem(cat.id)}
          className="mt-2 flex w-full items-center justify-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Añadir plato
        </Button>
      </CardContent>
    </Card>
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
function Pildora({
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
