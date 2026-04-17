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

export function Modelo111Editor({ modelo, facturas, asignaciones }: Props) {
  const c: CasillasMap = modelo.casillas ?? {};

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-5">
      <header className="border-b border-gray-400 pb-3 mb-4">
        <p className="text-[10px] font-semibold text-gray-500 tracking-widest">
          AGENCIA TRIBUTARIA
        </p>
        <h2 className="text-2xl font-bold">
          Modelo 111 · Retenciones IRPF · Trabajadores y profesionales
        </h2>
        <p className="text-xs text-gray-600">
          Periodo {modelo.periodo} · Ejercicio {modelo.ejercicio}
        </p>
      </header>

      <section className="mb-4">
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          I · Rendimientos del trabajo
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <CasillaInput numero="02" label="Nº perceptores" valor={c["02"]} />
            <CasillaInput
              numero="01"
              label="Importe percepciones dinerarias"
              valor={c["01"]}
              facturasAsociadas={fxc("01", facturas, asignaciones)}
            />
            <CasillaInput
              numero="03"
              label="Retenciones dinerarias"
              tipo="cuota"
              valor={c["03"]}
              facturasAsociadas={fxc("03", facturas, asignaciones)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <CasillaInput numero="05" label="Nº perceptores (especie)" valor={c["05"]} />
            <CasillaInput numero="04" label="Importe en especie" valor={c["04"]} />
            <CasillaInput numero="06" label="Ingresos a cuenta" tipo="cuota" valor={c["06"]} />
          </div>
        </div>
      </section>

      <section className="mb-4">
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          II · Rendimientos de actividades económicas (profesionales)
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <CasillaInput numero="08" label="Nº perceptores" valor={c["08"]} />
            <CasillaInput
              numero="07"
              label="Importe dinerarias"
              valor={c["07"]}
              facturasAsociadas={fxc("07", facturas, asignaciones)}
            />
            <CasillaInput
              numero="09"
              label="Retenciones"
              tipo="cuota"
              valor={c["09"]}
              facturasAsociadas={fxc("09", facturas, asignaciones)}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          Liquidación
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3 space-y-2">
          <CasillaInput numero="25" label="Total percepciones" tipo="resultado" valor={c["25"]} />
          <CasillaInput numero="27" label="Total retenciones" tipo="resultado" valor={c["27"]} />
          <CasillaInput numero="28" label="RESULTADO a ingresar" tipo="resultado" valor={c["28"]} />
        </div>
      </section>
    </div>
  );
}
