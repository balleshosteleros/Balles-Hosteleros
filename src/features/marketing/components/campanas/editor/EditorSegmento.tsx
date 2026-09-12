"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/shared/components/NumberInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Users, Plus, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { listEtiquetas, type Etiqueta } from "@/features/sala/actions/sala-etiquetas-actions";
import type {
  SegmentoJson,
  SegmentoCondicion,
  TipoSegmentoCondicion,
} from "@/features/marketing/data/campanas";
import { ToolTooltip } from "@/components/ui/tool-tooltip";
import { Desplegable } from "@/components/ui/desplegable";

interface Props {
  segmento: SegmentoJson;
  onChange: (s: SegmentoJson) => void;
  coincidencias: number | null;
}

/**
 * Los filtros, agrupados como se piensan: primero qué clase de cliente es,
 * luego cuándo vino, desde cuándo lo tenemos, qué le hemos puesto en la ficha,
 * qué opina, cuándo cumple años y cómo se porta.
 *
 * El texto de cada uno es la frase que describe al cliente, no el nombre del
 * campo: quien monta una campaña piensa "los que llevan un año sin venir", no
 * "ultima_visita < fecha".
 */
const GRUPOS: Array<{ grupo: string; tipos: Array<{ value: TipoSegmentoCondicion; label: string }> }> = [
  {
    grupo: "Qué clase de cliente",
    tipos: [
      { value: "clasificacion", label: "Es VIP, habitual o nuevo" },
      { value: "visitas_min", label: "Ha venido al menos N veces" },
      { value: "visitas_max", label: "Ha venido como mucho N veces" },
    ],
  },
  {
    grupo: "Cuándo vino",
    tipos: [
      { value: "ultima_visita_hace_dias", label: "Vino en los últimos N días" },
      { value: "sin_visitar_desde_dias", label: "Lleva más de N días sin venir" },
      { value: "ultima_visita_antes", label: "Su última visita fue antes del…" },
      { value: "ultima_visita_despues", label: "Su última visita fue después del…" },
    ],
  },
  {
    grupo: "Desde cuándo es cliente",
    tipos: [
      { value: "alta_despues", label: "Se dio de alta después del…" },
      { value: "alta_antes", label: "Se dio de alta antes del…" },
    ],
  },
  {
    grupo: "Etiquetas de su ficha",
    tipos: [{ value: "etiquetas", label: "Tiene estas etiquetas" }],
  },
  {
    grupo: "Qué opina",
    tipos: [
      { value: "valoracion_min", label: "Nos puntúa con al menos… (de 1 a 5)" },
      { value: "valoracion_max", label: "Nos puntúa como mucho con… (de 1 a 5)" },
      { value: "ha_valorado", label: "Nos ha valorado alguna vez" },
    ],
  },
  {
    grupo: "Su cumpleaños",
    tipos: [
      { value: "cumple_en_dias", label: "Cumple años dentro de N días" },
      { value: "cumple_mes", label: "Cumple años en estos meses" },
    ],
  },
  {
    grupo: "Cómo se porta",
    tipos: [
      { value: "no_shows_max", label: "No ha dejado más de N mesas vacías" },
      { value: "cancelaciones_max", label: "No ha cancelado más de N veces" },
    ],
  },
];

const ETIQUETA_TIPO: Record<TipoSegmentoCondicion, string> = Object.fromEntries(
  GRUPOS.flatMap((g) => g.tipos.map((t) => [t.value, t.label])),
) as Record<TipoSegmentoCondicion, string>;

const CLASIFICACIONES = ["REGULAR", "VIP", "NUEVO"] as const;
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Hoy en formato de campo de fecha, para estrenar las condiciones con fecha. */
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function condicionVacia(tipo: TipoSegmentoCondicion): SegmentoCondicion {
  switch (tipo) {
    case "clasificacion": return { tipo, valores: ["VIP"] };
    case "visitas_min": return { tipo, min: 3 };
    case "visitas_max": return { tipo, max: 1 };
    case "ultima_visita_hace_dias": return { tipo, max: 30 };
    case "sin_visitar_desde_dias": return { tipo, min: 180 };
    case "ultima_visita_antes": return { tipo, fecha: hoyISO() };
    case "ultima_visita_despues": return { tipo, fecha: hoyISO() };
    case "alta_antes": return { tipo, fecha: hoyISO() };
    case "alta_despues": return { tipo, fecha: hoyISO() };
    case "etiquetas": return { tipo, etiquetaIds: [], modo: "alguna" };
    // Las valoraciones van de 1 a 5, no de 1 a 10: un "8" no lo cumple nadie.
    case "valoracion_min": return { tipo, min: 4 };
    case "valoracion_max": return { tipo, max: 3 };
    case "ha_valorado": return { tipo, valor: true };
    case "cumple_en_dias": return { tipo, dias: 15 };
    case "cumple_mes": return { tipo, meses: [new Date().getMonth() + 1] };
    case "no_shows_max": return { tipo, max: 0 };
    case "cancelaciones_max": return { tipo, max: 1 };
  }
}

export function EditorSegmento({ segmento, onChange, coincidencias }: Props) {
  const [tipoNuevo, setTipoNuevo] = useState<TipoSegmentoCondicion>("clasificacion");
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);

  // Las etiquetas del cliente se piden una vez: son las mismas para todas las
  // condiciones del segmento.
  useEffect(() => {
    listEtiquetas({ scope: "cliente", soloActivas: true }).then((r) => {
      if (r.ok) setEtiquetas(r.data);
    });
  }, []);

  const soloConPermiso = segmento.soloConPermiso !== false;

  function addCondicion() {
    onChange({
      ...segmento,
      condiciones: [...segmento.condiciones, condicionVacia(tipoNuevo)],
    });
  }
  function updateCondicion(idx: number, c: SegmentoCondicion) {
    const next = [...segmento.condiciones];
    next[idx] = c;
    onChange({ ...segmento, condiciones: next });
  }
  function removeCondicion(idx: number) {
    onChange({ ...segmento, condiciones: segmento.condiciones.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      {/* ── El permiso, arriba del todo ──────────────────────────────────
          Es la primera decisión de cualquier envío comercial y la que tiene
          consecuencias fuera del software, así que no se esconde entre los
          filtros. */}
      <label
        className={cn(
          "flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition-colors",
          soloConPermiso
            ? "border-emerald-600/30 bg-emerald-600/[0.06]"
            : "border-amber-600/40 bg-amber-600/[0.08]",
        )}
      >
        <Checkbox
          checked={soloConPermiso}
          onCheckedChange={(v) => onChange({ ...segmento, soloConPermiso: v === true })}
          className="mt-0.5"
        />
        <span className="space-y-0.5 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            {soloConPermiso ? (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TriangleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            )}
            Escribir solo a quien dio permiso
          </span>
          <span className="block text-muted-foreground">
            {soloConPermiso
              ? "Solo entran los clientes que aceptaron recibir comunicaciones comerciales en este canal."
              : "Se escribirá también a quien nunca dio permiso. Es tu decisión y tu responsabilidad legal; además dispara las marcas de spam, y eso acaba tirando también los correos de confirmación de reserva."}
          </span>
        </span>
      </label>

      {/* Operador global */}
      {segmento.condiciones.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Combinar condiciones con:</span>
          <div className="inline-flex overflow-hidden rounded border">
            {(["AND", "OR"] as const).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => onChange({ ...segmento, operador: op })}
                className={`px-3 py-1 text-xs ${segmento.operador === op ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                {op === "AND" ? "Y (todas)" : "O (alguna)"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Condiciones */}
      <div className="space-y-2">
        {segmento.condiciones.map((c, idx) => (
          <CondicionRow
            key={idx}
            condicion={c}
            etiquetas={etiquetas}
            onChange={(nc) => updateCondicion(idx, nc)}
            onRemove={() => removeCondicion(idx)}
          />
        ))}
        {segmento.condiciones.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Sin filtros: entra toda la base de clientes
            {soloConPermiso ? " que dio permiso." : "."}
          </p>
        )}
      </div>

      {/* Añadir */}
      <div className="flex flex-wrap items-center gap-2">
        <Desplegable
          value={tipoNuevo}
          onChange={(e) => setTipoNuevo(e.target.value as TipoSegmentoCondicion)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          {GRUPOS.map((g) => (
            <optgroup key={g.grupo} label={g.grupo}>
              {g.tipos.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Desplegable>
        <Button type="button" variant="outline" size="sm" onClick={addCondicion}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Añadir filtro
        </Button>

        {coincidencias !== null && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {coincidencias.toLocaleString("es-ES")}{" "}
            {coincidencias === 1 ? "cliente encaja" : "clientes encajan"}
          </span>
        )}
      </div>
    </div>
  );
}

/** Una condición: su frase, sus valores y el aspa para quitarla. */
function CondicionRow({
  condicion,
  etiquetas,
  onChange,
  onRemove,
}: {
  condicion: SegmentoCondicion;
  etiquetas: Etiqueta[];
  onChange: (c: SegmentoCondicion) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-xs">
      <span className="font-medium text-foreground">{ETIQUETA_TIPO[condicion.tipo]}</span>
      <div className="flex flex-wrap items-center gap-2">
        <ValoresDeCondicion condicion={condicion} etiquetas={etiquetas} onChange={onChange} />
      </div>
      <ToolTooltip label="Quitar este filtro">
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Quitar este filtro">
          <X className="h-3.5 w-3.5" />
        </button>
      </ToolTooltip>
    </div>
  );
}

function ValoresDeCondicion({
  condicion,
  etiquetas,
  onChange,
}: {
  condicion: SegmentoCondicion;
  etiquetas: Etiqueta[];
  onChange: (c: SegmentoCondicion) => void;
}) {
  switch (condicion.tipo) {
    case "clasificacion":
      return (
        <div className="flex flex-wrap gap-1">
          {CLASIFICACIONES.map((v) => {
            const puesta = condicion.valores.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() =>
                  onChange({
                    ...condicion,
                    valores: puesta
                      ? condicion.valores.filter((x) => x !== v)
                      : [...condicion.valores, v],
                  })
                }
                className={cn(
                  "rounded-full border px-2.5 py-0.5",
                  puesta ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {v === "REGULAR" ? "Habitual" : v === "VIP" ? "VIP" : "Nuevo"}
              </button>
            );
          })}
        </div>
      );

    case "visitas_min":
    case "sin_visitar_desde_dias":
    case "valoracion_min":
      return (
        <NumberInput
          value={condicion.min}
          onValueChange={(n) => onChange({ ...condicion, min: n ?? 0 })}
          className="h-7 w-24"
        />
      );

    case "visitas_max":
    case "ultima_visita_hace_dias":
    case "valoracion_max":
    case "no_shows_max":
    case "cancelaciones_max":
      return (
        <NumberInput
          value={condicion.max}
          onValueChange={(n) => onChange({ ...condicion, max: n ?? 0 })}
          className="h-7 w-24"
        />
      );

    case "cumple_en_dias":
      return (
        <NumberInput
          value={condicion.dias}
          onValueChange={(n) => onChange({ ...condicion, dias: n ?? 0 })}
          className="h-7 w-24"
        />
      );

    case "ultima_visita_antes":
    case "ultima_visita_despues":
    case "alta_antes":
    case "alta_despues":
      return (
        <Input
          type="date"
          value={condicion.fecha}
          onChange={(e) => onChange({ ...condicion, fecha: e.target.value })}
          className="h-7 w-40"
        />
      );

    case "ha_valorado":
      return (
        <div className="inline-flex overflow-hidden rounded border">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => onChange({ ...condicion, valor: v })}
              className={cn(
                "px-2.5 py-1",
                condicion.valor === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {v ? "Sí" : "No"}
            </button>
          ))}
        </div>
      );

    case "cumple_mes":
      return (
        <div className="flex flex-wrap gap-1">
          {MESES.map((nombre, i) => {
            const mes = i + 1;
            const puesto = condicion.meses.includes(mes);
            return (
              <button
                key={mes}
                type="button"
                onClick={() =>
                  onChange({
                    ...condicion,
                    meses: puesto
                      ? condicion.meses.filter((m) => m !== mes)
                      : [...condicion.meses, mes],
                  })
                }
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  puesto ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {nombre.slice(0, 3)}
              </button>
            );
          })}
        </div>
      );

    case "etiquetas":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded border">
            {(["alguna", "todas"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ ...condicion, modo: m })}
                className={cn(
                  "px-2.5 py-1",
                  condicion.modo === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted",
                )}
              >
                {m === "alguna" ? "alguna" : "todas"}
              </button>
            ))}
          </div>
          {etiquetas.length === 0 ? (
            <span className="text-muted-foreground">
              Esta empresa no tiene etiquetas de cliente todavía.
            </span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {etiquetas.map((e) => {
                const puesta = condicion.etiquetaIds.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...condicion,
                        etiquetaIds: puesta
                          ? condicion.etiquetaIds.filter((x) => x !== e.id)
                          : [...condicion.etiquetaIds, e.id],
                      })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-0.5",
                      puesta ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                    )}
                  >
                    {e.emoji ? `${e.emoji} ` : ""}
                    {e.nombre}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
  }
}

/** Etiqueta del filtro, para quien la necesite fuera de este archivo. */
export { ETIQUETA_TIPO as ETIQUETA_FILTRO_SEGMENTO };
