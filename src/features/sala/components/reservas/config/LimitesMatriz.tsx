"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  EmpresaReservasConfig,
  DiaSemanaKey,
} from "@/features/sala/data/reservas";

const DIAS: { key: DiaSemanaKey; label: string }[] = [
  { key: "lun", label: "Lunes" },
  { key: "mar", label: "Martes" },
  { key: "mie", label: "Miércoles" },
  { key: "jue", label: "Jueves" },
  { key: "vie", label: "Viernes" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

interface Props {
  config: EmpresaReservasConfig;
  onChange: (parche: Partial<EmpresaReservasConfig>) => void;
}

function NumCell({
  value,
  placeholder,
  onChange,
}: {
  value: number | null;
  placeholder?: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <Input
      type="number"
      min={0}
      inputMode="numeric"
      value={value ?? ""}
      placeholder={placeholder ?? "—"}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
      className="h-8 text-center text-sm"
    />
  );
}

type MetricaUI = "cupo" | "maxpax";

function MatrizMetrica({
  config,
  onChange,
  metrica,
}: Props & { metrica: MetricaUI }) {
  const generalComidaKey = metrica === "cupo" ? "generalCupoComida" : "generalMaxpaxComida";
  const generalCenaKey = metrica === "cupo" ? "generalCupoCena" : "generalMaxpaxCena";
  const sufijoComida = metrica === "cupo" ? "cupo_comida" : "maxpax_comida";
  const sufijoCena = metrica === "cupo" ? "cupo_cena" : "maxpax_cena";

  const genComida = config[generalComidaKey];
  const genCena = config[generalCenaKey];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-2 font-medium">Día</th>
            <th className="p-2 font-medium">☀️ Comida</th>
            <th className="p-2 font-medium">🌙 Cena</th>
          </tr>
        </thead>
        <tbody>
          <tr className={cn("border-b", "bg-amber-50/30 dark:bg-amber-950/10")}>
            <td className="p-2 font-semibold">General</td>
            <td className="p-1">
              <NumCell
                value={genComida}
                onChange={(v) => onChange({ [generalComidaKey]: v } as Partial<EmpresaReservasConfig>)}
              />
            </td>
            <td className="p-1">
              <NumCell
                value={genCena}
                onChange={(v) => onChange({ [generalCenaKey]: v } as Partial<EmpresaReservasConfig>)}
              />
            </td>
          </tr>
          {DIAS.map(({ key, label }) => {
            const comidaKey = `${key}_${sufijoComida}` as keyof EmpresaReservasConfig;
            const cenaKey = `${key}_${sufijoCena}` as keyof EmpresaReservasConfig;
            const vComida = config[comidaKey] as number | null;
            const vCena = config[cenaKey] as number | null;
            return (
              <tr key={key} className="border-b">
                <td className="p-2 text-muted-foreground">{label}</td>
                <td className="p-1">
                  <NumCell
                    value={vComida}
                    placeholder={genComida?.toString() ?? "—"}
                    onChange={(v) => onChange({ [comidaKey]: v } as Partial<EmpresaReservasConfig>)}
                  />
                </td>
                <td className="p-1">
                  <NumCell
                    value={vCena}
                    placeholder={genCena?.toString() ?? "—"}
                    onChange={(v) => onChange({ [cenaKey]: v } as Partial<EmpresaReservasConfig>)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LimitesMatriz({ config, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
        <p>
          Estos límites aplican a <strong>todo el restaurante</strong> (sumando todas las salas) y se separan por turno: <strong>Comida</strong> y <strong>Cena</strong>.
        </p>
        <p>
          <strong>Cómo se aplica cada fila:</strong>{" "}
          <strong>General</strong> vale para cualquier día sin valor propio. Si rellenas un día concreto (ej. Viernes), ese valor se usa <strong>siempre</strong> los viernes. Solo las <strong>excepciones por fecha</strong> (otra pestaña) pueden anularlo, y solo en el día indicado.
        </p>
        <p>Deja un campo vacío para que herede del nivel superior.</p>
      </div>

      <section className="space-y-2">
        <div>
          <h4 className="text-sm font-semibold">Aforo total del turno</h4>
          <p className="text-xs text-muted-foreground">
            Número máximo de personas que aceptas en total durante el turno (sumando todas las reservas). Al alcanzar el tope, el turno se cierra a nuevas reservas.
          </p>
        </div>
        <MatrizMetrica config={config} onChange={onChange} metrica="cupo" />
      </section>

      <section className="space-y-2">
        <div>
          <h4 className="text-sm font-semibold">Tamaño máximo por reserva</h4>
          <p className="text-xs text-muted-foreground">
            Personas máximas en una sola reserva (una mesa o combinación de mesas). Si alguien pide más, debe gestionarse como reserva de Grupo.
          </p>
        </div>
        <MatrizMetrica config={config} onChange={onChange} metrica="maxpax" />
      </section>
    </div>
  );
}
