"use client";

import { CasillaInput } from "../CasillaInput";
import type { CasillasMap, ModeloAeat } from "../../types/modelos";
import { CASILLAS_390 } from "../../data/epigrafes-390";

interface Props {
  modelo: ModeloAeat;
}

export function Modelo390Editor({ modelo }: Props) {
  const c: CasillasMap = modelo.casillas ?? {};

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-5">
      <header className="border-b border-gray-400 pb-3 mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-gray-500 tracking-widest">
            AGENCIA TRIBUTARIA
          </p>
          <h2 className="text-2xl font-bold">
            Modelo 390 · IVA · Declaración-resumen anual
          </h2>
          <p className="text-xs text-gray-600">Ejercicio {modelo.ejercicio}</p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <p>Consolida los 4 trimestres del 303</p>
        </div>
      </header>

      <section className="mb-4">
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          IVA devengado · Régimen general
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <CasillaInput numero="100" label="Base 21 %" valor={c[CASILLAS_390.REGIMEN_GENERAL.BASE_21]} />
            <CasillaInput numero="tipo" label="Tipo" valor={21} />
            <CasillaInput numero="101" label="Cuota 21 %" tipo="cuota" valor={c[CASILLAS_390.REGIMEN_GENERAL.CUOTA_21]} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <CasillaInput numero="102" label="Base 10 %" valor={c[CASILLAS_390.REGIMEN_GENERAL.BASE_10]} />
            <CasillaInput numero="tipo" label="Tipo" valor={10} />
            <CasillaInput numero="103" label="Cuota 10 %" tipo="cuota" valor={c[CASILLAS_390.REGIMEN_GENERAL.CUOTA_10]} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <CasillaInput numero="104" label="Base 4 %" valor={c[CASILLAS_390.REGIMEN_GENERAL.BASE_4]} />
            <CasillaInput numero="tipo" label="Tipo" valor={4} />
            <CasillaInput numero="105" label="Cuota 4 %" tipo="cuota" valor={c[CASILLAS_390.REGIMEN_GENERAL.CUOTA_4]} />
          </div>
          <CasillaInput
            numero="108"
            label="Total bases régimen general"
            tipo="resultado"
            valor={c[CASILLAS_390.REGIMEN_GENERAL.TOTAL_BASES]}
          />
          <CasillaInput
            numero="109"
            label="Total cuotas régimen general"
            tipo="resultado"
            valor={c[CASILLAS_390.REGIMEN_GENERAL.TOTAL_CUOTAS]}
          />
        </div>
      </section>

      <section className="mb-4">
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          IVA deducible
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <CasillaInput
              numero="190"
              label="Interior · bienes corrientes (base)"
              valor={c[CASILLAS_390.DEDUCIBLE.INTERIOR_BIENES_BASE]}
            />
            <CasillaInput
              numero="191"
              label="Cuota"
              tipo="cuota"
              valor={c[CASILLAS_390.DEDUCIBLE.INTERIOR_BIENES_CUOTA]}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CasillaInput
              numero="192"
              label="Bienes de inversión (base)"
              valor={c[CASILLAS_390.DEDUCIBLE.INTERIOR_INVERSION_BASE]}
            />
            <CasillaInput
              numero="193"
              label="Cuota"
              tipo="cuota"
              valor={c[CASILLAS_390.DEDUCIBLE.INTERIOR_INVERSION_CUOTA]}
            />
          </div>
          <CasillaInput
            numero="597"
            label="Total bases deducibles"
            tipo="resultado"
            valor={c[CASILLAS_390.DEDUCIBLE.TOTAL_BASES_DEDUCIBLE]}
          />
          <CasillaInput
            numero="598"
            label="Total cuotas deducibles"
            tipo="resultado"
            valor={c[CASILLAS_390.DEDUCIBLE.TOTAL_CUOTAS_DEDUCIBLE]}
          />
        </div>
      </section>

      <section>
        <h3 className="text-[11px] uppercase font-bold tracking-wider text-gray-700 bg-gray-100 px-2 py-1 border border-gray-300 rounded-t">
          Resultado
        </h3>
        <div className="border-x border-b border-gray-300 rounded-b p-3 space-y-2">
          <CasillaInput
            numero="599"
            label="Régimen general devengado"
            tipo="resultado"
            valor={c[CASILLAS_390.RESULTADO.REGIMEN_GENERAL_DEVENGADO]}
          />
          <CasillaInput
            numero="645"
            label="Total cuotas deducibles"
            tipo="resultado"
            valor={c[CASILLAS_390.RESULTADO.TOTAL_DEDUCIBLE]}
          />
          <CasillaInput
            numero="658"
            label="Resultado liquidación anual"
            tipo="resultado"
            valor={c[CASILLAS_390.RESULTADO.LIQUIDACION_ANUAL]}
          />
          <CasillaInput
            numero="660"
            label="RESULTADO"
            tipo="resultado"
            valor={c[CASILLAS_390.RESULTADO.RESULTADO]}
          />
        </div>
      </section>
    </div>
  );
}
