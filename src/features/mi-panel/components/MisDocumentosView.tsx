"use client";

import { useState, useEffect, useCallback } from "react";
import { useSincronizacionEnVivo } from "@/shared/hooks/useSincronizacionEnVivo";
import { toast } from "sonner";
import {
  ChevronRight,
  FileText,
  FileSignature,
  Receipt,
  Clock,
  Folder,
  Inbox,
  ArrowLeft,
  Download,
  Loader2,
  ShieldAlert,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  listMisDocumentos,
  getDocumentoEmpleadoUrl,
  type CategoriaDocumento,
  type DocumentoEmpleado,
} from "@/features/mi-panel/actions/mis-documentos-actions";
import {
  listMisNominas,
  getMiNominaUrl,
} from "@/features/rrhh/actions/nominas-archivo-actions";
import { formatearFechaEs } from "@/shared/lib/fecha";

/** Una nómina publicada, para la carpeta "Nóminas". */
interface MiNomina {
  periodo: string;
  periodoLabel: string;
  documentos: number;
}

interface Carpeta {
  id: CategoriaDocumento;
  nombre: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

// Taxonomía fija (coincide con el CHECK de `documentos_empleado`).
const CARPETAS: Carpeta[] = [
  { id: "nominas", nombre: "Nóminas", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  { id: "contratos", nombre: "Contratos", icon: FileSignature, color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "justificantes", nombre: "Justificantes", icon: Receipt, color: "text-amber-600", bg: "bg-amber-50" },
  { id: "registros-jornada", nombre: "Registros de jornada", icon: Clock, color: "text-violet-600", bg: "bg-violet-50" },
  { id: "entregas", nombre: "Entregas de material", icon: PackageCheck, color: "text-cyan-600", bg: "bg-cyan-50" },
  { id: "sanciones", nombre: "Sanciones disciplinarias", icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50" },
];

function tamanoLegible(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Una nómina del mes. No vive en `documentos_empleado` como el resto: sale de
 * `rrhh_pagos_nominas`, que es donde la deja la gestoría. Si el mes tiene varias
 * (finiquito + nómina), se descargan combinadas en un solo PDF.
 */
function FilaNomina({ nomina }: { nomina: MiNomina }) {
  const [bajando, setBajando] = useState(false);

  const descargar = async () => {
    setBajando(true);
    const res = await getMiNominaUrl(nomina.periodo);
    setBajando(false);
    if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
    else toast.error(res.error);
  };

  return (
    <button
      onClick={descargar}
      className="flex items-center gap-3 w-full p-3 rounded-lg border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-left"
    >
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">Nómina de {nomina.periodoLabel.toLowerCase()}</p>
        {nomina.documentos > 1 && (
          <p className="text-xs text-muted-foreground">{nomina.documentos} documentos</p>
        )}
      </div>
      {bajando ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
      ) : (
        <Download className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </button>
  );
}

function FilaDocumento({ doc }: { doc: DocumentoEmpleado }) {
  const [bajando, setBajando] = useState(false);

  const descargar = async () => {
    setBajando(true);
    const res = await getDocumentoEmpleadoUrl(doc.id);
    setBajando(false);
    if (res.ok && res.url) {
      window.open(res.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(res.error ?? "No se pudo abrir el documento");
    }
  };

  return (
    <button
      onClick={descargar}
      className="flex items-center gap-3 w-full p-3 rounded-lg border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-left"
    >
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{doc.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {formatearFechaEs(doc.fecha)}
          {doc.tamanoBytes ? ` · ${tamanoLegible(doc.tamanoBytes)}` : ""}
        </p>
      </div>
      {bajando ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
      ) : (
        <Download className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </button>
  );
}

export function MisDocumentosView() {
  const [carpetaActiva, setCarpetaActiva] = useState<Carpeta | null>(null);
  const [docs, setDocs] = useState<Record<CategoriaDocumento, DocumentoEmpleado[]> | null>(null);
  const [nominas, setNominas] = useState<MiNomina[]>([]);

  const cargar = useCallback(async () => {
    const [res, nom] = await Promise.all([listMisDocumentos(), listMisNominas()]);
    setDocs(res.ok ? res.data : null);
    setNominas(nom.ok ? nom.data : []);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Sincronizacion en vivo: un documento que RRHH sube o pone a firmar aparece
  // en el panel del empleado al momento, sin tener que recargar.
  useSincronizacionEnVivo({
    tablas: ["documentos_empleado", "firmas_documentos"],
    onCambio: () => void cargar(),
  });

  // Las nóminas no están en `documentos_empleado`: se suman aparte a su carpeta.
  const conteo = (id: CategoriaDocumento) =>
    (docs?.[id]?.length ?? 0) + (id === "nominas" ? nominas.length : 0);

  if (carpetaActiva) {
    const Icon = carpetaActiva.icon;
    const lista = docs?.[carpetaActiva.id] ?? [];
    const nominasCarpeta = carpetaActiva.id === "nominas" ? nominas : [];
    const total = lista.length + nominasCarpeta.length;
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setCarpetaActiva(null)}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Mis documentos
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{carpetaActiva.nombre}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${carpetaActiva.bg}`}>
            <Icon className={`h-5 w-5 ${carpetaActiva.color}`} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{carpetaActiva.nombre}</h2>
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? "archivo" : "archivos"}
            </p>
          </div>
        </div>

        {total === 0 ? (
          <Card className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground">
            <Inbox className="h-8 w-8 mb-2" />
            <p className="text-sm font-medium">Esta carpeta está vacía</p>
            <p className="text-xs mt-1 max-w-sm">
              Cuando RRHH publique documentos en {carpetaActiva.nombre.toLowerCase()},
              aparecerán aquí para descarga.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {nominasCarpeta.map((n) => (
              <FilaNomina key={n.periodo} nomina={n} />
            ))}
            {lista.map((d) => (
              <FilaDocumento key={d.id} doc={d} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Folder className="h-5 w-5 text-primary" />
          Mis documentos
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Accede a tus carpetas personales publicadas por RRHH.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {CARPETAS.map((c) => {
          const Icon = c.icon;
          const n = conteo(c.id);
          return (
            <button
              key={c.id}
              onClick={() => setCarpetaActiva(c)}
              className="group relative flex flex-col items-start gap-3 p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-left"
            >
              <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${c.bg}`}>
                <Icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <div className="min-w-0 w-full">
                <p className="text-sm font-semibold truncate">{c.nombre}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {docs === null ? "…" : `${n} ${n === 1 ? "archivo" : "archivos"}`}
                </p>
              </div>
              <ChevronRight className="absolute top-4 right-4 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
