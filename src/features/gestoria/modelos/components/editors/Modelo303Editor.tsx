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

function facturasPorCasilla(
  casilla: string,
  facturas: FacturaParaModelo[],
  asignaciones: AsignacionModelo[],
) {
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

export function Modelo303Editor({ modelo, facturas, asignaciones }: Props) {
  const c: CasillasMap = modelo.casillas ?? {};

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-5 font-sans">
      <header className="border-b border-gray-400 pb-3 mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-gray-500 tracking-widest">
            AGENCIA TRIBUTARIA
          </p>
          <h2 className="text-2xl font-bold">
            Modelo 303 · IVA · Autoliquidación
          </h2>
          <p className="text-xs text-gray-600">
            Periodo {modelo.periodo} · Ejercicio {modelo.ejercicio}
          </p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <p>Régimen general</p>
          <p className="font-mono">Devengo · Trimestral</p>
        </div>
      </header>

      <section className="mb-4">
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          IVA devengado · Régimen general
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <CasillaInput
              numero="01"
              label="Base imponible 21 %"
              valor={c["01"]}
              facturasAsociadas={facturasPorCasilla("01", facturas, asignaciones)}
            />
            <CasillaInput numero="02" label="Tipo" valor={21} />
            <CasillaInput
              numero="03"
              label="Cuota"
              tipo="cuota"
              valor={c["03"]}
              facturasAsociadas={facturasPorCasilla("03", facturas, asignaciones)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <CasillaInput
              numero="04"
              label="Base imponible 10 %"
              valor={c["04"]}
              facturasAsociadas={facturasPorCasilla("04", facturas, asignaciones)}
            />
            <CasillaInput numero="05" label="Tipo" valor={10} />
            <CasillaInput
              numero="06"
              label="Cuota"
              tipo="cuota"
              valor={c["06"]}
              facturasAsociadas={facturasPorCasilla("06", facturas, asignaciones)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <CasillaInput
              numero="07"
              label="Base imponible 4 %"
              valor={c["07"]}
              facturasAsociadas={facturasPorCasilla("07", facturas, asignaciones)}
            />
            <CasillaInput numero="08" label="Tipo" valor={4} />
            <CasillaInput
              numero="09"
              label="Cuota"
              tipo="cuota"
              valor={c["09"]}
              facturasAsociadas={facturasPorCasilla("09", facturas, asignaciones)}
            />
          </div>
        </div>
      </section>

      <section className="mb-4">
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          Total cuota devengada
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3">
          <CasillaInput numero="27" label="Total cuota devengada" tipo="resultado" valor={c["27"]} />
        </div>
      </section>

      <section className="mb-4">
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          IVA deducible
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <CasillaInput
              numero="28"
              label="Base · operaciones interior bienes corrientes"
              valor={c["28"]}
              facturasAsociadas={facturasPorCasilla("28", facturas, asignaciones)}
            />
            <CasillaInput
              numero="29"
              label="Cuota"
              tipo="cuota"
              valor={c["29"]}
              facturasAsociadas={facturasPorCasilla("29", facturas, asignaciones)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CasillaInput
              numero="30"
              label="Base · bienes de inversión interior"
              valor={c["30"]}
              facturasAsociadas={facturasPorCasilla("30", facturas, asignaciones)}
            />
            <CasillaInput
              numero="31"
              label="Cuota"
              tipo="cuota"
              valor={c["31"]}
              facturasAsociadas={facturasPorCasilla("31", facturas, asignaciones)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CasillaInput
              numero="32"
              label="Base · importaciones bienes corrientes"
              valor={c["32"]}
            />
            <CasillaInput numero="33" label="Cuota" tipo="cuota" valor={c["33"]} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CasillaInput numero="36" label="Base · adq. intracomunitarias" valor={c["36"]} />
            <CasillaInput numero="37" label="Cuota" tipo="cuota" valor={c["37"]} />
          </div>
        </div>
      </section>

      <section className="mb-4">
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          Total IVA deducible
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3">
          <CasillaInput numero="45" label="Total cuotas a deducir" tipo="resultado" valor={c["45"]} />
        </div>
      </section>

      <section>
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          Resultado liquidación
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3 space-y-2">
          <CasillaInput numero="46" label="Diferencia (27 − 45)" tipo="resultado" valor={c["46"]} />
          <CasillaInput numero="64" label="Resultado régimen general" tipo="resultado" valor={c["64"]} />
          <CasillaInput
            numero="67"
            label="Cuotas a compensar periodos anteriores"
            valor={c["67"]}
          />
          <CasillaInput numero="69" label="RESULTADO (C.64 − C.67)" tipo="resultado" valor={c["69"]} />
          {c["71"] !== undefined && c["71"] !== 0 ? (
            <CasillaInput numero="71" label="A ingresar" tipo="resultado" valor={c["71"]} />
          ) : null}
          {c["72"] !== undefined && c["72"] !== 0 ? (
            <CasillaInput numero="72" label="A compensar" tipo="resultado" valor={c["72"]} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
