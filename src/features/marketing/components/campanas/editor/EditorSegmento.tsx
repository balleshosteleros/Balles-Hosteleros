"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Users, Plus } from "lucide-react";
import type { SegmentoJson, SegmentoCondicion } from "@/features/marketing/data/campanas";

interface Props {
  segmento: SegmentoJson;
  onChange: (s: SegmentoJson) => void;
  coincidencias: number | null;
}

type TipoCondicion = SegmentoCondicion["tipo"];

const TIPOS: { value: TipoCondicion; label: string }[] = [
  { value: "ultima_visita_hace_dias", label: "Última visita hace ≤ N días" },
  { value: "sin_visitar_desde_dias", label: "Sin visitar desde > N días" },
  { value: "clasificacion", label: "Clasificación" },
  { value: "visitas_min", label: "Visitas totales ≥ N" },
];

const PRESETS_ULTIMA_VISITA = [7, 30, 90, 365] as const;
const CLASIFICACIONES = ["REGULAR", "VIP", "FRECUENTE", "NUEVO", "INACTIVO"] as const;

function condicionVacia(tipo: TipoCondicion): SegmentoCondicion {
  switch (tipo) {
    case "ultima_visita_hace_dias": return { tipo, max: 30 };
    case "sin_visitar_desde_dias": return { tipo, min: 30 };
    case "clasificacion": return { tipo, valores: ["VIP"] };
    case "visitas_min": return { tipo, min: 3 };
  }
}

export function EditorSegmento({ segmento, onChange, coincidencias }: Props) {
  const [tipoNuevo, setTipoNuevo] = useState<TipoCondicion>("clasificacion");

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
      {/* Operador global */}
      {segmento.condiciones.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Combinar condiciones con:</span>
          <div className="inline-flex rounded border overflow-hidden">
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
          <CondicionRow key={idx} condicion={c} onChange={(nc) => updateCondicion(idx, nc)} onRemove={() => removeCondicion(idx)} />
        ))}
      </div>

      {/* Añadir nueva */}
      <div className="flex items-center gap-2 pt-1">
        <select
          value={tipoNuevo}
          onChange={(e) => setTipoNuevo(e.target.value as TipoCondicion)}
          className="h-8 text-xs rounded border bg-background px-2"
        >
          {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={addCondicion}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Añadir condición
        </Button>
      </div>

      {/* Preview */}
      <div className={`flex items-center gap-2 mt-3 pt-3 border-t text-sm ${coincidencias === 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
        <Users className="h-4 w-4" />
        <span className="font-semibold">
          {coincidencias === null ? "Calculando..." : `Coinciden ${coincidencias.toLocaleString("es-ES")} clientes`}
        </span>
      </div>
    </div>
  );
}

function CondicionRow({
  condicion,
  onChange,
  onRemove,
}: {
  condicion: SegmentoCondicion;
  onChange: (c: SegmentoCondicion) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded border bg-background p-2">
      <div className="flex-1 flex items-center gap-2 flex-wrap">
        {condicion.tipo === "ultima_visita_hace_dias" && (
          <>
            <Label className="text-xs">Última visita ≤</Label>
            <select
              value={condicion.max}
              onChange={(e) => onChange({ tipo: "ultima_visita_hace_dias", max: Number(e.target.value) as 7 | 30 | 90 | 365 })}
              className="h-7 text-xs rounded border bg-background px-2"
            >
              {PRESETS_ULTIMA_VISITA.map((d) => <option key={d} value={d}>{d} días</option>)}
            </select>
          </>
        )}
        {condicion.tipo === "sin_visitar_desde_dias" && (
          <>
            <Label className="text-xs">Sin visitar &gt;</Label>
            <Input
              type="number"
              min={1}
              value={condicion.min}
              onChange={(e) => onChange({ tipo: "sin_visitar_desde_dias", min: Number(e.target.value) || 1 })}
              className="h-7 w-20 text-xs"
            />
            <span className="text-xs text-muted-foreground">días</span>
          </>
        )}
        {condicion.tipo === "clasificacion" && (
          <>
            <Label className="text-xs">Clasificación:</Label>
            <div className="flex flex-wrap gap-1">
              {CLASIFICACIONES.map((c) => {
                const activo = condicion.valores.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      const next = activo ? condicion.valores.filter((v) => v !== c) : [...condicion.valores, c];
                      onChange({ tipo: "clasificacion", valores: next });
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded border ${activo ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {condicion.tipo === "visitas_min" && (
          <>
            <Label className="text-xs">Visitas ≥</Label>
            <Input
              type="number"
              min={1}
              value={condicion.min}
              onChange={(e) => onChange({ tipo: "visitas_min", min: Number(e.target.value) || 1 })}
              className="h-7 w-20 text-xs"
            />
          </>
        )}
      </div>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onRemove}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
