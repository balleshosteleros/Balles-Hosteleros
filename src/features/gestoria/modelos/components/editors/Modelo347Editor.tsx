"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { UMBRAL_MODELO_347 } from "../../types/modelos";
import type { ModeloAeat } from "../../types/modelos";
import { CLAVES_OPERACION_347 } from "../../data/epigrafes-347";

interface Registro347View {
  contacto_id: string;
  nif: string;
  nombre: string;
  tipo_contacto: string;
  clave: string;
  importe_t1: number;
  importe_t2: number;
  importe_t3: number;
  importe_t4: number;
  importe_total: number;
}

interface Props {
  modelo: ModeloAeat;
  registros: Registro347View[];
}

export function Modelo347Editor({ modelo, registros }: Props) {
  const totalA = useMemo(
    () => registros.filter((r) => r.clave === "A").reduce((acc, r) => acc + r.importe_total, 0),
    [registros],
  );
  const totalB = useMemo(
    () => registros.filter((r) => r.clave === "B").reduce((acc, r) => acc + r.importe_total, 0),
    [registros],
  );

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-5">
      <header className="border-b border-gray-400 pb-3 mb-4">
        <p className="text-[10px] font-semibold text-gray-500 tracking-widest">
          AGENCIA TRIBUTARIA
        </p>
        <h2 className="text-2xl font-bold">
          Modelo 347 · Declaración anual de operaciones con terceras personas
        </h2>
        <p className="text-xs text-gray-600">
          Ejercicio {modelo.ejercicio} · Umbral {UMBRAL_MODELO_347.toFixed(2)} € IVA incluido
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="p-3 bg-blue-50/50">
          <p className="text-xs font-semibold text-blue-800">Clave A · Compras</p>
          <p className="text-lg font-bold font-mono">
            {totalA.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
          </p>
        </Card>
        <Card className="p-3 bg-green-50/50">
          <p className="text-xs font-semibold text-green-800">Clave B · Ventas</p>
          <p className="text-lg font-bold font-mono">
            {totalB.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
          </p>
        </Card>
      </div>

      <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
        Relación de operaciones declarables ({registros.length})
      </h3>
      <div className="border-x border-b border-gray-300 rounded-b overflow-auto">
        {registros.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Ningún contacto supera el umbral anual de {UMBRAL_MODELO_347.toFixed(2)} €. Nada que
            declarar.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-300">
              <tr>
                <th className="px-2 py-2 text-left">NIF</th>
                <th className="px-2 py-2 text-left">Nombre / Razón social</th>
                <th className="px-2 py-2 text-center">Clave</th>
                <th className="px-2 py-2 text-right">1T</th>
                <th className="px-2 py-2 text-right">2T</th>
                <th className="px-2 py-2 text-right">3T</th>
                <th className="px-2 py-2 text-right">4T</th>
                <th className="px-2 py-2 text-right font-bold">Total anual</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r, idx) => (
                <tr key={`${r.contacto_id}-${r.clave}-${idx}`} className="border-b">
                  <td className="px-2 py-1 font-mono">{r.nif}</td>
                  <td className="px-2 py-1 truncate max-w-[260px]">{r.nombre}</td>
                  <td className="px-2 py-1 text-center">
                    <Badge variant="outline" className="text-[10px]">
                      {r.clave}
                    </Badge>
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {r.importe_t1.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {r.importe_t2.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {r.importe_t3.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {r.importe_t4.toFixed(2)}
                  </td>
                  <td className="px-2 py-1 text-right font-mono font-bold">
                    {r.importe_total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold">Claves de operación 347:</p>
        {Object.entries(CLAVES_OPERACION_347).map(([k, v]) => (
          <p key={k}>{v}</p>
        ))}
      </div>
    </div>
  );
}
