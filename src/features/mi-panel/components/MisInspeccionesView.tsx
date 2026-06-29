import Link from "next/link";
import { CheckCircle2, FileSearch } from "lucide-react";
import type { MiPanelInspeccionItem } from "../actions/inspecciones-actions";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";

interface Props {
  inspecciones: MiPanelInspeccionItem[];
}

export function MisInspeccionesView({ inspecciones }: Props) {
  if (inspecciones.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center space-y-3">
        <FileSearch className="h-10 w-10 mx-auto text-muted-foreground" />
        <h2 className="text-lg font-semibold">Aún no has verificado ninguna inspección</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Cuando un inspector externo te enseñe su QR de verificación y lo
          escanees con tu móvil, la inspección aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium">Nº</th>
            <th className="px-4 py-2 font-medium">Local</th>
            <th className="px-4 py-2 font-medium">Inspector</th>
            <th className="px-4 py-2 font-medium">Fecha inspección</th>
            <th className="px-4 py-2 font-medium">Nota</th>
            <th className="px-4 py-2 font-medium">Verificada</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {inspecciones.map((i) => (
            <tr key={i.id} className="border-t hover:bg-muted/20">
              <td className="px-4 py-3 font-mono text-xs">
                #{i.numero_secuencial ?? "—"}
              </td>
              <td className="px-4 py-3">{i.local_nombre ?? "—"}</td>
              <td className="px-4 py-3">{i.nombre_inspector}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {i.fecha_inspeccion
                  ? formatFechaHoraEnZona(i.fecha_inspeccion, i.zona_horaria)
                  : "—"}
              </td>
              <td className="px-4 py-3">
                {i.nota_final != null ? (
                  <span className="font-semibold">{i.nota_final.toFixed(2)}</span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {formatFechaHoraEnZona(i.verificado_at, i.zona_horaria)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/mi-panel/inspecciones/${i.id}`}
                  className="text-sm font-medium text-emerald-700 hover:underline"
                >
                  Ver detalle
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
