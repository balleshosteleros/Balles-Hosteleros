"use client";

import { CasillaInput } from "../CasillaInput";
import type {
  AsignacionModelo,
  CasillasMap,
  FacturaParaModelo,
  ModeloAeat,
} from "../../types/modelos";

interface Props {
  modelo: ModeloAeat;
  facturas: FacturaParaModelo[];
  asignaciones: AsignacionModelo[];
}

function fxc(casilla: string, facturas: FacturaParaModelo[], asignaciones: AsignacionModelo[]) {
  return asignaciones
    .filter((a) => a.casilla === casilla)
    .map((a) => {
      const f = facturas.find((x) => x.id === a.factura_id);
      return {
        factura_id: a.factura_id,
        numero_factura: f?.numero_factura,
        proveedor: f?.contacto_nombre,
        importe: a.importe,
        confianza: a.confianza_ia,
      };
    });
}

export function Modelo115Editor({ modelo, facturas, asignaciones }: Props) {
  const c: CasillasMap = modelo.casillas ?? {};

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-5">
      <header className="border-b border-gray-400 pb-3 mb-4">
        <p className="text-[10px] font-semibold text-gray-500 tracking-widest">
          AGENCIA TRIBUTARIA
        </p>
        <h2 className="text-2xl font-bold">
          Modelo 115 · Retenciones arrendamientos de inmuebles urbanos
        </h2>
        <p className="text-xs text-gray-600">
          Periodo {modelo.periodo} · Ejercicio {modelo.ejercicio} · Retención 19 %
        </p>
      </header>

      <section>
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          Liquidación
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3 space-y-2">
          <CasillaInput numero="01" label="Nº perceptores" valor={c["01"]} />
          <CasillaInput
            numero="02"
            label="Base de las retenciones"
            valor={c["02"]}
            facturasAsociadas={fxc("02", facturas, asignaciones)}
          />
          <CasillaInput numero="03" label="Importe retenciones" tipo="cuota" valor={c["03"]} />
          <CasillaInput numero="06" label="RESULTADO a ingresar" tipo="resultado" valor={c["06"]} />
        </div>
      </section>
    </div>
  );
}
