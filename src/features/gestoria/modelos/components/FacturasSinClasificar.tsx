"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { reasignarFactura } from "../actions/categorizacion-actions";
import type { FacturaParaModelo, ModeloTipo } from "../types/modelos";
import { EPIGRAFES_303 } from "../data/epigrafes-303";
import { EPIGRAFES_130 } from "../data/epigrafes-130";
import { EPIGRAFES_111 } from "../data/epigrafes-111";
import { EPIGRAFES_115 } from "../data/epigrafes-115";

interface Props {
  modeloId: string;
  modeloTipo: ModeloTipo;
  facturas: FacturaParaModelo[];
  asignaciones: Array<{
    factura_id: string;
    casilla: string;
    confianza_ia: number | null;
    explicacion_ia: string | null;
    origen: string;
  }>;
  onReasignada?: () => void;
}

function casillasDelModelo(tipo: ModeloTipo) {
  switch (tipo) {
    case "303":
      return EPIGRAFES_303.flatMap((e) =>
        e.casillaBase ? [{ casilla: e.casillaBase, etiqueta: e.etiqueta }] : [],
      );
    case "130":
      return EPIGRAFES_130.flatMap((e) =>
        e.casillaBase ? [{ casilla: e.casillaBase, etiqueta: e.etiqueta }] : [],
      );
    case "111":
      return EPIGRAFES_111.flatMap((e) =>
        e.casillaBase ? [{ casilla: e.casillaBase, etiqueta: e.etiqueta }] : [],
      );
    case "115":
      return EPIGRAFES_115.flatMap((e) =>
        e.casillaBase ? [{ casilla: e.casillaBase, etiqueta: e.etiqueta }] : [],
      );
    default:
      return [];
  }
}

export function FacturasSinClasificar({
  modeloId,
  modeloTipo,
  facturas,
  asignaciones,
  onReasignada,
}: Props) {
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dudosas = useMemo(() => {
    const mapAsg = new Map(asignaciones.map((a) => [a.factura_id, a]));
    return facturas
      .filter((f) => {
        const asg = mapAsg.get(f.id);
        if (!asg) return true;
        return (asg.confianza_ia ?? 1) < 0.6;
      })
      .slice(0, 100);
  }, [facturas, asignaciones]);

  const opciones = useMemo(() => casillasDelModelo(modeloTipo), [modeloTipo]);

  async function handleReasignar(facturaId: string, casilla: string) {
    startTransition(async () => {
      const res = await reasignarFactura({ modeloId, facturaId, casilla, crearRegla: true });
      if (!res.ok) alert(`Error: ${res.error}`);
      else onReasignada?.();
      setSeleccionadaId(null);
    });
  }

  if (dudosas.length === 0) {
    return (
      <Card className="p-4 flex items-center gap-2 text-sm text-green-700 bg-green-50">
        <CheckCircle2 className="h-4 w-4" />
        Todas las facturas están clasificadas con alta confianza.
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <h3 className="font-semibold text-sm">
          {dudosas.length} factura{dudosas.length !== 1 ? "s" : ""} sin clasificar
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        La IA no pudo asignar estas facturas con confianza suficiente. Revísalas manualmente.
      </p>

      <div className="space-y-2 max-h-[60vh] overflow-auto">
        {dudosas.map((f) => {
          const asg = asignaciones.find((a) => a.factura_id === f.id);
          return (
            <div key={f.id} className="border rounded-md p-2 bg-amber-50/50 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {f.numero_factura} · {f.contacto_nombre ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{f.concepto}</p>
                  <p className="text-xs font-mono mt-1">
                    {f.base_imponible.toFixed(2)} € + IVA {f.iva_pct}% = {f.total.toFixed(2)} €
                  </p>
                </div>
                <Badge variant={f.tipo === "VENTA" ? "default" : "secondary"} className="text-[10px]">
                  {f.tipo}
                </Badge>
              </div>
              {asg?.explicacion_ia ? (
                <p className="text-xs italic text-muted-foreground">
                  IA ({((asg.confianza_ia ?? 0) * 100).toFixed(0)}%): {asg.explicacion_ia}
                </p>
              ) : null}
              <Select
                value={seleccionadaId === f.id ? "" : asg?.casilla ?? ""}
                onValueChange={(v) => {
                  setSeleccionadaId(f.id);
                  handleReasignar(f.id, v);
                }}
                disabled={isPending}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Elegir casilla..." />
                </SelectTrigger>
                <SelectContent>
                  {opciones.map((o) => (
                    <SelectItem key={o.casilla} value={o.casilla} className="text-xs">
                      {o.casilla} · {o.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
