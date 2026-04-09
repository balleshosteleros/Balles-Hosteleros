"use client";

import TemperaturasView from "@/features/cocina/components/temperaturas/TemperaturasView";
import { SAMPLE_EQUIPOS_SALA, SAMPLE_REGISTROS_SALA } from "@/features/cocina/data/temperaturas";

export default function SalaTemperaturasPage() {
  return <TemperaturasView area="SALA" equiposIniciales={SAMPLE_EQUIPOS_SALA} registrosIniciales={SAMPLE_REGISTROS_SALA} />;
}
