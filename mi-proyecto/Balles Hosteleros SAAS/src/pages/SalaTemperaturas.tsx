import TemperaturasView from "@/components/temperaturas/TemperaturasView";
import { SAMPLE_EQUIPOS_SALA, SAMPLE_REGISTROS_SALA } from "@/data/temperaturas";

export default function SalaTemperaturas() {
  return <TemperaturasView area="SALA" equiposIniciales={SAMPLE_EQUIPOS_SALA} registrosIniciales={SAMPLE_REGISTROS_SALA} />;
}
