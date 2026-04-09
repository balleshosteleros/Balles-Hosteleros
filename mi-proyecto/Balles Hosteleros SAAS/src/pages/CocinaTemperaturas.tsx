import TemperaturasView from "@/components/temperaturas/TemperaturasView";
import { SAMPLE_EQUIPOS_COCINA, SAMPLE_REGISTROS_COCINA } from "@/data/temperaturas";

export default function CocinaTemperaturas() {
  return <TemperaturasView area="COCINA" equiposIniciales={SAMPLE_EQUIPOS_COCINA} registrosIniciales={SAMPLE_REGISTROS_COCINA} />;
}
