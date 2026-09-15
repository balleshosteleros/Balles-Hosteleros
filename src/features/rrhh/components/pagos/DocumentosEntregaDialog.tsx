"use client";

/**
 * Los papeles que subió la gestoría, en un sitio y sin ruido.
 *
 * Se entra por dos palabras —«Nóminas» o «Seguros sociales»— y dentro está la
 * lista de documentos de esa mitad, cada uno para abrirlo o descargarlo. Antes
 * la única forma de ver un documento era el diálogo de SUBIDA, que está lleno de
 * selectores de mes y avisos de cuadre: para mirar un papel había que pasar por
 * la pantalla de trabajar con ellos.
 *
 * Cada mitad mira SU mes: las nóminas, el que se está viendo; los seguros
 * sociales, el que cotiza el recibo (a mes vencido, el anterior).
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  ReceiptText,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  listarNominasRevision,
  getTc1MesUrl,
  type NominaRevision,
  type Tc1Mes,
} from "@/features/rrhh/actions/nominas-revision-actions";
import {
  getNominaArchivoUrl,
  getNominasMesUrl,
} from "@/features/rrhh/actions/nominas-archivo-actions";

type Seccion = "nominas" | "seguros";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Mes que se está viendo (AAAA-MM): de él son las nóminas. */
  periodo: string;
  /** "agosto 2026" */
  mesLabelNominas: string;
  /** "julio 2026": el mes que cotizan los recibos. */
  mesLabelSeguros: string;
  /** Recibos de cotizaciones del mes cotizado, vengan en la entrega que vengan. */
  tc1: Tc1Mes[];
  /** Fechas de visto bueno, para poder reabrir desde aquí. */
  nominasAprobadoEn: string | null;
  segurosAprobadoEn: string | null;
  puedeGestionar: boolean;
  onReabrir: (seccion: Seccion) => void;
  /** Abre el diálogo de subida (para corregir o añadir un recibo). */
  onSubir: () => void;
}

function eur(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export function DocumentosEntregaDialog({
  open,
  onOpenChange,
  periodo,
  mesLabelNominas,
  mesLabelSeguros,
  tc1,
  nominasAprobadoEn,
  segurosAprobadoEn,
  puedeGestionar,
  onReabrir,
  onSubir,
}: Props) {
  const [seccion, setSeccion] = useState<Seccion | null>(null);
  // `null` = todavía no se han pedido. Distingue "cargando" de "no hay ninguna"
  // sin un segundo estado que haya que poner a mano antes de cada consulta.
  const [nominas, setNominas] = useState<NominaRevision[] | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  const cargar = useCallback(async () => {
    setNominas(await listarNominasRevision(periodo));
  }, [periodo]);

  useEffect(() => {
    if (!open) return;
    void cargar();
  }, [open, cargar]);

  // Al cerrar se vuelve al menú: la próxima vez que se abra, se abre por donde
  // se elige, no por donde se quedó la vez anterior.
  const cerrar = (v: boolean) => {
    if (!v) {
      setSeccion(null);
      setNominas(null);
    }
    onOpenChange(v);
  };

  const abrirNomina = async (n: NominaRevision) => {
    setAbriendo(n.id);
    const res = await getNominaArchivoUrl(periodo, n.empleadoId);
    setAbriendo(null);
    if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
    else toast.error(res.error ?? "No se pudo abrir la nómina.");
  };

  const descargarTodas = async () => {
    setDescargando(true);
    const res = await getNominasMesUrl(periodo);
    setDescargando(false);
    if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
    else toast.error(res.error);
  };

  const abrirRecibo = async (t: Tc1Mes) => {
    setAbriendo(t.id);
    const res = await getTc1MesUrl(t.id);
    setAbriendo(null);
    if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
    else toast.error(res.error ?? "No se pudo abrir el recibo.");
  };

  const lista = nominas ?? [];
  const conDocumento = lista.filter((n) => n.tieneDocumento);
  const aprobadoEn = seccion === "seguros" ? segurosAprobadoEn : nominasAprobadoEn;

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {seccion && (
              <button
                type="button"
                onClick={() => setSeccion(null)}
                className="-ml-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Volver"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {seccion === "nominas"
              ? "Nóminas"
              : seccion === "seguros"
                ? "Seguros sociales"
                : "Documentos"}
          </DialogTitle>
        </DialogHeader>

        {/* MENÚ: dos palabras, nada más. */}
        {!seccion && (
          <div className="space-y-2">
            <Opcion
              icono={<FileText className="h-4 w-4" />}
              titulo="Nóminas"
              detalle={`${mesLabelNominas} · ${lista.length || "sin"} document${lista.length === 1 ? "o" : "os"}`}
              onClick={() => setSeccion("nominas")}
            />
            <Opcion
              icono={<ReceiptText className="h-4 w-4" />}
              titulo="Seguros sociales"
              detalle={`${mesLabelSeguros} · ${tc1.length || "sin"} recibo${tc1.length === 1 ? "" : "s"}`}
              onClick={() => setSeccion("seguros")}
            />
          </div>
        )}

        {/* NÓMINAS del mes visto. */}
        {seccion === "nominas" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{mesLabelNominas}</p>
              {conDocumento.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={descargarTodas}
                  disabled={descargando}
                >
                  {descargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Descargar
                </Button>
              )}
            </div>

            {nominas == null ? (
              <Cargando />
            ) : lista.length === 0 ? (
              <Vacio texto={`La gestoría todavía no ha entregado las nóminas de ${mesLabelNominas}.`} />
            ) : (
              <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
                {lista.map((n) => (
                  <Fila
                    key={n.id}
                    titulo={n.empleadoNombre}
                    detalle={eur(n.neto)}
                    ocupado={abriendo === n.id}
                    deshabilitado={!n.tieneDocumento}
                    onClick={() => abrirNomina(n)}
                  />
                ))}
              </div>
            )}

            <Pie
              aprobadoEn={aprobadoEn}
              puedeGestionar={puedeGestionar}
              onReabrir={() => {
                setSeccion(null);
                onReabrir("nominas");
              }}
              onSubir={() => {
                setSeccion(null);
                onSubir();
              }}
            />
          </div>
        )}

        {/* SEGUROS SOCIALES del mes que cotizan. */}
        {seccion === "seguros" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Recibos que cotizan {mesLabelSeguros}.
            </p>

            {tc1.length === 0 ? (
              <Vacio texto={`Todavía no hay recibo de cotizaciones de ${mesLabelSeguros}.`} />
            ) : (
              <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
                {tc1.map((t) => (
                  <Fila
                    key={t.id}
                    titulo={t.nombre}
                    detalle={t.importe != null ? eur(t.importe) : "Importe no leído"}
                    ocupado={abriendo === t.id}
                    onClick={() => abrirRecibo(t)}
                  />
                ))}
              </div>
            )}

            <Pie
              aprobadoEn={aprobadoEn}
              puedeGestionar={puedeGestionar}
              onReabrir={() => {
                setSeccion(null);
                onReabrir("seguros");
              }}
              onSubir={() => {
                setSeccion(null);
                onSubir();
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Opcion({
  icono,
  titulo,
  detalle,
  onClick,
}: {
  icono: ReactNode;
  titulo: string;
  detalle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/60"
    >
      <span className="text-muted-foreground">{icono}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block truncate text-xs text-muted-foreground">{detalle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function Fila({
  titulo,
  detalle,
  ocupado,
  deshabilitado,
  onClick,
}: {
  titulo: string;
  detalle: string;
  ocupado: boolean;
  deshabilitado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado || ocupado}
      title={deshabilitado ? "Esta nómina no tiene documento adjunto" : "Abrir"}
      className="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{titulo}</span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{detalle}</span>
      {ocupado ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

function Cargando() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{texto}</p>;
}

/**
 * Lo que se puede hacer con estos papeles. Aquí vive el «Reabrir» de la mitad
 * aprobada: la franja de cuadre desaparece cuando la entrega está cerrada, y sin
 * esto no habría forma de volver a abrirla.
 */
function Pie({
  aprobadoEn,
  puedeGestionar,
  onReabrir,
  onSubir,
}: {
  aprobadoEn: string | null;
  puedeGestionar: boolean;
  onReabrir: () => void;
  onSubir: () => void;
}) {
  if (!puedeGestionar) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-t pt-3">
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={onSubir}>
        <Upload className="h-3.5 w-3.5" />
        Subir
      </Button>
      {aprobadoEn && (
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onReabrir}>
          <Undo2 className="h-3.5 w-3.5" />
          Reabrir
        </Button>
      )}
    </div>
  );
}
