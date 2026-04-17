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

export function Modelo130Editor({ modelo, facturas, asignaciones }: Props) {
  const c: CasillasMap = modelo.casillas ?? {};

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-5">
      <header className="border-b border-gray-400 pb-3 mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-gray-500 tracking-widest">
            AGENCIA TRIBUTARIA
          </p>
          <h2 className="text-2xl font-bold">
            Modelo 130 · IRPF · Pago fraccionado (estimación directa)
          </h2>
          <p className="text-xs text-gray-600">
            Periodo {modelo.periodo} · Ejercicio {modelo.ejercicio}
          </p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <p>Actividad empresarial</p>
          <p className="font-mono">Estimación directa simplificada</p>
        </div>
      </header>

      <section className="mb-4">
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          Actividades económicas · estimación directa
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3 space-y-2">
          <CasillaInput
            numero="01"
            label="Ingresos computables acumulados"
            valor={c["01"]}
            facturasAsociadas={fxc("01", facturas, asignaciones)}
          />
          <CasillaInput
            numero="02"
            label="Gastos deducibles acumulados"
            valor={c["02"]}
            facturasAsociadas={fxc("02", facturas, asignaciones)}
          />
          <CasillaInput numero="03" label="Rendimiento neto (01 − 02)" tipo="resultado" valor={c["03"]} />
          <CasillaInput numero="04" label="Porcentaje aplicable" valor={c["04"] ?? 20} />
          <CasillaInput numero="07" label="Pago fraccionado" tipo="cuota" valor={c["07"]} />
          <CasillaInput
            numero="08"
            label="Pagos trimestres anteriores"
            valor={c["08"]}
          />
          <CasillaInput
            numero="06"
            label="Retenciones soportadas"
            valor={c["06"]}
          />
          <CasillaInput
            numero="19"
            label="RESULTADO (07 − 08 − 06)"
            tipo="resultado"
            valor={c["19"]}
          />
        </div>
      </section>
    </div>
  );
}
