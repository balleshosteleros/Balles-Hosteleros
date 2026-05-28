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

export function LimitesMatriz({ config, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold mb-2">Cupos y máximos por turno</h4>
        <p className="text-xs text-muted-foreground mb-3">
          La prioridad es: <strong>excepción por fecha</strong> &gt; <strong>día de la semana</strong> &gt; <strong>general</strong>.
          Deja un campo vacío para que herede del nivel superior.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium">Día</th>
              <th className="p-2 font-medium">☀️ Cupo Comida</th>
              <th className="p-2 font-medium">🌙 Cupo Cena</th>
              <th className="p-2 font-medium">☀️ Máx pax Comida</th>
              <th className="p-2 font-medium">🌙 Máx pax Cena</th>
            </tr>
          </thead>
          <tbody>
            <tr className={cn("border-b", "bg-amber-50/30 dark:bg-amber-950/10")}>
              <td className="p-2 font-semibold">General</td>
              <td className="p-1">
                <NumCell
                  value={config.generalCupoComida}
                  onChange={(v) => onChange({ generalCupoComida: v })}
                />
              </td>
              <td className="p-1">
                <NumCell
                  value={config.generalCupoCena}
                  onChange={(v) => onChange({ generalCupoCena: v })}
                />
              </td>
              <td className="p-1">
                <NumCell
                  value={config.generalMaxpaxComida}
                  onChange={(v) => onChange({ generalMaxpaxComida: v })}
                />
              </td>
              <td className="p-1">
                <NumCell
                  value={config.generalMaxpaxCena}
                  onChange={(v) => onChange({ generalMaxpaxCena: v })}
                />
              </td>
            </tr>
            {DIAS.map(({ key, label }) => {
              const cc = config[`${key}_cupo_comida`];
              const ce = config[`${key}_cupo_cena`];
              const mc = config[`${key}_maxpax_comida`];
              const me = config[`${key}_maxpax_cena`];
              return (
                <tr key={key} className="border-b">
                  <td className="p-2 text-muted-foreground">{label}</td>
                  <td className="p-1">
                    <NumCell
                      value={cc}
                      placeholder={config.generalCupoComida?.toString() ?? "—"}
                      onChange={(v) => onChange({ [`${key}_cupo_comida`]: v } as Partial<EmpresaReservasConfig>)}
                    />
                  </td>
                  <td className="p-1">
                    <NumCell
                      value={ce}
                      placeholder={config.generalCupoCena?.toString() ?? "—"}
                      onChange={(v) => onChange({ [`${key}_cupo_cena`]: v } as Partial<EmpresaReservasConfig>)}
                    />
                  </td>
                  <td className="p-1">
                    <NumCell
                      value={mc}
                      placeholder={config.generalMaxpaxComida?.toString() ?? "—"}
                      onChange={(v) => onChange({ [`${key}_maxpax_comida`]: v } as Partial<EmpresaReservasConfig>)}
                    />
                  </td>
                  <td className="p-1">
                    <NumCell
                      value={me}
                      placeholder={config.generalMaxpaxCena?.toString() ?? "—"}
                      onChange={(v) => onChange({ [`${key}_maxpax_cena`]: v } as Partial<EmpresaReservasConfig>)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
