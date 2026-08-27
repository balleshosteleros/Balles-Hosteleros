"use client";

/**
 * PRP-079 — Panel de Archivos en Ajustes → Herramientas.
 *
 * De momento muestra el uso real del almacenamiento (total y por
 * departamento). Las opciones de configuración se decidirán más adelante.
 */

import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { getUsoArchivos, type UsoArchivos } from "@/features/archivos/actions/uso-actions";
import { ImportarDrivePanel } from "@/features/archivos/components/ImportarDrivePanel";

function tamano(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}

export function ArchivosConfigPanel() {
  const [uso, setUso] = useState<UsoArchivos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    void getUsoArchivos().then((res) => {
      if (res.ok) setUso(res.data);
      setCargando(false);
    });
  }, []);

  if (cargando) {
    return (
      <div className="flex h-24 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!uso) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No se pudo cargar el uso de almacenamiento.
      </p>
    );
  }

  const porcentaje = Math.min(100, (uso.bytesTotal / uso.bytesLimite) * 100);

  return (
    <div className="space-y-4 py-2">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-cyan-600" />
          <span className="text-sm font-medium">Almacenamiento</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${
              porcentaje >= 90
                ? "bg-destructive"
                : porcentaje >= 80
                  ? "bg-amber-500"
                  : "bg-cyan-600"
            }`}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {tamano(uso.bytesTotal)} de {tamano(uso.bytesLimite)} usados en total.{" "}
          {uso.numArchivos === 0
            ? "Todavía no hay archivos."
            : `Archivos: ${tamano(uso.bytesArchivos)} en ${uso.numArchivos} ${
                uso.numArchivos === 1 ? "archivo" : "archivos"
              }.`}
        </p>
      </div>

      {uso.porDepartamento.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Por departamento</p>
          <div className="space-y-1">
            {uso.porDepartamento.map((d) => (
              <div
                key={d.departamento}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate text-muted-foreground">{d.departamento}</span>
                <span className="shrink-0 tabular-nums">
                  {tamano(d.bytes)} · {d.num}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Cada departamento tiene su propia carpeta. Solo la ve quien tenga ese
        departamento visible en su rol.
      </p>

      <div className="border-t pt-4">
        <ImportarDrivePanel />
      </div>
    </div>
  );
}
