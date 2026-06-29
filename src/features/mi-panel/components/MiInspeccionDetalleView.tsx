import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { MiPanelInspeccionDetalle } from "../actions/inspecciones-actions";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";

interface Props {
  envio: MiPanelInspeccionDetalle;
}

export function MiInspeccionDetalleView({ envio }: Props) {
  // Agrupar respuestas por sección
  const porSeccion = new Map<
    string,
    MiPanelInspeccionDetalle["respuestas"]
  >();
  for (const r of envio.respuestas) {
    const arr = porSeccion.get(r.seccion_titulo) ?? [];
    arr.push(r);
    porSeccion.set(r.seccion_titulo, arr);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/mi-panel/inspecciones"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a inspecciones
        </Link>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">
              Inspección #{envio.numero_secuencial ?? "—"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {envio.plantilla_nombre ?? "Inspección"} ·{" "}
              {envio.local_nombre ?? "—"}
              {envio.empresa_nombre ? ` · ${envio.empresa_nombre}` : ""}
            </p>
          </div>
          {envio.nota_final != null && (
            <div className="text-right">
              <div className="text-3xl font-bold">{envio.nota_final.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Nota final</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-2 border-t">
          <Dato label="Inspector" value={envio.nombre_inspector} />
          <Dato label="Jefe de sala" value={envio.nombre_jefe_sala ?? "—"} />
          <Dato
            label="Fecha inspección"
            value={
              envio.fecha_inspeccion
                ? formatFechaHoraEnZona(envio.fecha_inspeccion, envio.zona_horaria)
                : "—"
            }
          />
          <Dato
            label="Verificada"
            value={
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {formatFechaHoraEnZona(envio.verificado_at, envio.zona_horaria)}
              </span>
            }
          />
        </div>
      </div>

      {[...porSeccion.entries()].map(([titulo, respuestas]) => (
        <div key={titulo} className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">{titulo}</h2>
          <div className="space-y-3">
            {respuestas.map((r) => (
              <div key={r.id} className="space-y-1">
                <div className="text-sm font-medium">{r.enunciado}</div>
                <div className="text-sm text-muted-foreground">
                  {renderValor(r)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {envio.notas_calidad && (
        <div className="rounded-xl border bg-amber-50 border-amber-200 p-4 space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
            Notas internas de Calidad
          </div>
          <div className="text-sm text-amber-900 whitespace-pre-wrap">
            {envio.notas_calidad}
          </div>
        </div>
      )}
    </div>
  );
}

function Dato({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function renderValor(r: MiPanelInspeccionDetalle["respuestas"][number]): string {
  if (r.valor_numero != null) {
    if (r.escala_max != null) return `${r.valor_numero} / ${r.escala_max}`;
    return String(r.valor_numero);
  }
  if (r.valor_texto) {
    // empleado_select se guarda como JSON
    if (r.tipo === "empleado_select") {
      try {
        const p = JSON.parse(r.valor_texto) as { nombre_completo?: string };
        return p.nombre_completo ?? r.valor_texto;
      } catch {
        return r.valor_texto;
      }
    }
    return r.valor_texto;
  }
  return "—";
}
