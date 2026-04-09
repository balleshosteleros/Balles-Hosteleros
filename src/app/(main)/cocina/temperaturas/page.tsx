"use client";

import TemperaturasView from "@/features/cocina/components/temperaturas/TemperaturasView";
import { SAMPLE_EQUIPOS_COCINA, SAMPLE_REGISTROS_COCINA } from "@/features/cocina/data/temperaturas";

export default function CocinaTemperaturasPage() {
  return <TemperaturasView area="COCINA" equiposIniciales={SAMPLE_EQUIPOS_COCINA} registrosIniciales={SAMPLE_REGISTROS_COCINA} />;
}
