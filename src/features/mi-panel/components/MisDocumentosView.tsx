"use client";

import { useState, useEffect, useCallback } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  listMisDocumentos,
  getDocumentoEmpleadoUrl,
  type CategoriaDocumento,
  type DocumentoEmpleado,
} from "@/features/mi-panel/actions/mis-documentos-actions";

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
  { id: "sanciones", nombre: "Sanciones disciplinarias", icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50" },
];

function tamanoLegible(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
          {doc.fecha}
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

  const cargar = useCallback(async () => {
    const res = await listMisDocumentos();
    setDocs(res.ok ? res.data : null);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const conteo = (id: CategoriaDocumento) => docs?.[id]?.length ?? 0;

  if (carpetaActiva) {
    const Icon = carpetaActiva.icon;
    const lista = docs?.[carpetaActiva.id] ?? [];
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
              {lista.length} {lista.length === 1 ? "archivo" : "archivos"}
            </p>
          </div>
        </div>

        {lista.length === 0 ? (
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
