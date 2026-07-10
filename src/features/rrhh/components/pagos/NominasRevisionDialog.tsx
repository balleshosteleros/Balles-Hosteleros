"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Check,
  X,
  Upload,
  History,
} from "lucide-react";
import { toast } from "sonner";
import {
  listarNominasRevision,
  revisarNomina,
  listarSubidasHistorico,
  type NominaRevision,
  type SubidaHistorico,
} from "@/features/rrhh/actions/nominas-revision-actions";
import { getNominaArchivoUrl } from "@/features/rrhh/actions/nominas-archivo-actions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  periodo: string; // AAAA-MM en curso en la vista de pagos
  mesLabel: string; // "julio 2026"
  /** Se llama tras aprobar/denegar para que Pagos refresque su caché. */
  onCambio?: () => void;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function nombreMes(p: string): string {
  const [y, m] = (p ?? "").split("-");
  const mes = MESES[Number(m) - 1];
  return mes ? `${mes} ${y}` : p;
}
function eur(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Tab = "revision" | "historico";

export function NominasRevisionDialog({ open, onOpenChange, periodo, mesLabel, onCambio }: Props) {
  const [tab, setTab] = useState<Tab>("revision");
  const [cargando, setCargando] = useState(false);
  const [nominas, setNominas] = useState<NominaRevision[]>([]);
  const [historico, setHistorico] = useState<SubidaHistorico[]>([]);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    const [nom, hist] = await Promise.all([
      listarNominasRevision(periodo),
      listarSubidasHistorico(),
    ]);
    setNominas(nom);
    setHistorico(hist);
    setCargando(false);
  }, [periodo]);

  useEffect(() => {
    if (open) recargar();
  }, [open, recargar]);

  const revisar = async (n: NominaRevision, accion: "aprobar" | "denegar") => {
    setAccionando(n.id);
    const res = await revisarNomina(n.id, accion);
    setAccionando(null);
    if (res.ok) {
      toast.success(accion === "aprobar" ? "Nómina aprobada." : "Nómina denegada.");
      await recargar();
      onCambio?.();
    } else {
      toast.error(res.error ?? "No se pudo completar la acción.");
    }
  };

  const abrirDocumento = async (n: NominaRevision) => {
    if (!n.tieneDocumento) return;
    setAbriendo(n.id);
    const nueva = window.open("about:blank", "_blank");
    const res = await getNominaArchivoUrl(n.periodo, n.empleadoId);
    setAbriendo(null);
    if (res.ok) {
      if (nueva) nueva.location.href = res.url;
    } else {
      nueva?.close();
      toast.error(res.error ?? "No se pudo abrir el documento.");
    }
  };

  const conIncidencia = nominas.filter((n) => n.estado === "con_incidencia").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Nóminas subidas</DialogTitle>
        </DialogHeader>

        {/* Pestañas */}
        <div className="flex items-center gap-1 border-b">
          <button
            onClick={() => setTab("revision")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === "revision"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Revisión de {nombreMes(periodo)}
            {conIncidencia > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                {conIncidencia}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setTab("historico")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition inline-flex items-center gap-1.5 ${
              tab === "historico"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Histórico de subidas
          </button>
        </div>

        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {cargando ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : tab === "revision" ? (
            <RevisionLista
              nominas={nominas}
              accionando={accionando}
              abriendo={abriendo}
              onAbrir={abrirDocumento}
              onRevisar={revisar}
            />
          ) : (
            <HistoricoLista historico={historico} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function estadoBadge(n: NominaRevision) {
  if (n.estado === "denegada") {
    return (
      <span className="inline-flex items-center gap-1 text-rose-600 text-xs font-medium">
        <X className="h-3.5 w-3.5" /> Denegada
      </span>
    );
  }
  if (n.estado === "con_incidencia") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
        <AlertTriangle className="h-3.5 w-3.5" /> Incidencia
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
      <CheckCircle2 className="h-3.5 w-3.5" /> Correcta
    </span>
  );
}

function RevisionLista({
  nominas,
  accionando,
  abriendo,
  onAbrir,
  onRevisar,
}: {
  nominas: NominaRevision[];
  accionando: string | null;
  abriendo: string | null;
  onAbrir: (n: NominaRevision) => void;
  onRevisar: (n: NominaRevision, a: "aprobar" | "denegar") => void;
}) {
  if (nominas.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No hay nóminas subidas para este mes todavía.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {nominas.map((n) => (
        <li key={n.id} className="py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{n.empleadoNombre}</span>
              {estadoBadge(n)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Neto {eur(n.neto)} · SS empl. {eur(n.ssEmpleado)} · IRPF {eur(n.irpf)}
            </p>
            {n.incidencia && n.estado !== "correcta" && (
              <p className="text-xs text-amber-700 mt-0.5">{n.incidencia}</p>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 shrink-0"
            disabled={!n.tieneDocumento || abriendo === n.id}
            onClick={() => onAbrir(n)}
            title={n.tieneDocumento ? "Ver documento" : "Sin documento"}
          >
            {abriendo === n.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Ver
          </Button>

          {n.estado === "denegada" ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              disabled={accionando === n.id}
              onClick={() => onRevisar(n, "aprobar")}
            >
              {accionando === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Restaurar
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              {n.estado === "con_incidencia" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  disabled={accionando === n.id}
                  onClick={() => onRevisar(n, "aprobar")}
                >
                  {accionando === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Aprobar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-rose-600 hover:bg-rose-50"
                disabled={accionando === n.id}
                onClick={() => onRevisar(n, "denegar")}
                title="Denegar: la nómina deja de contar en el pago"
              >
                {accionando === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Denegar
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function HistoricoLista({ historico }: { historico: SubidaHistorico[] }) {
  if (historico.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Aún no se ha subido ningún archivo de nóminas.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {historico.map((h) => {
        const conIncidencia = h.sinEmpleado > 0 || h.mesIncorrecto > 0;
        return (
          <li key={h.id} className="py-3 flex items-center gap-3">
            <div className="shrink-0">
              {conIncidencia ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {h.archivoNombre || "Nóminas"}
                </span>
                <Badge variant="secondary" className="h-5 px-1.5 gap-1">
                  {h.origen === "gestoria" ? "Gestoría" : (<><Upload className="h-3 w-3" />Manual</>)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {nombreMes(h.periodo)} · {fechaCorta(h.createdAt)} · {h.guardadas} volcada
                {h.guardadas === 1 ? "" : "s"}
                {h.yaExistian > 0 ? ` · ${h.yaExistian} ya estaba${h.yaExistian === 1 ? "" : "n"}` : ""}
              </p>
              {conIncidencia && (
                <p className="text-xs text-amber-700 mt-0.5">
                  {h.mesIncorrecto > 0 && `${h.mesIncorrecto} de otro mes (rechazada${h.mesIncorrecto === 1 ? "" : "s"}). `}
                  {h.sinEmpleado > 0 && `${h.sinEmpleado} sin empleado dado de alta.`}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
