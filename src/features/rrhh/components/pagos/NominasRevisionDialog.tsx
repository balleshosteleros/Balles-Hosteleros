"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  listarNominasRevision,
  revisarNomina,
  listarSubidasHistorico,
  borrarNominaSubida,
  type NominaRevision,
  type SubidaHistorico,
} from "@/features/rrhh/actions/nominas-revision-actions";
import { getNominaArchivoUrl, procesarNominasLeidas } from "@/features/rrhh/actions/nominas-archivo-actions";
import type { NominaLeida } from "@/features/rrhh/services/nominas/procesar-nominas";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

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
  const { confirm, dialog: confirmDialog } = useConfirmDelete();
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState({ hechas: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Subida desde la propia ventana de revisión: lee con IA y vuelca, igual que
  // el botón de Pagos. Así el ciclo "borrar la mala → subir la buena" se hace sin
  // cerrar el diálogo.
  const subir = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const lista = Array.from(files);
    setSubiendo(true);
    setProgreso({ hechas: 0, total: lista.length });

    const todas: NominaLeida[] = [];
    let fallos = 0;
    for (const file of lista) {
      try {
        const fd = new FormData();
        fd.set("archivo", file);
        const res = await fetch("/api/nominas/extraer", { method: "POST", body: fd });
        const data = await res.json();
        if (data.ok && Array.isArray(data.nominas)) todas.push(...(data.nominas as NominaLeida[]));
        else fallos++;
      } catch {
        fallos++;
      }
      setProgreso((p) => ({ ...p, hechas: p.hechas + 1 }));
    }

    if (todas.length === 0) {
      setSubiendo(false);
      toast.error("No se pudo leer ninguna nómina.");
      return;
    }

    const nombreArchivo = lista.length === 1 ? lista[0].name : `${lista.length} archivos`;
    const proc = await procesarNominasLeidas(todas, periodo, nombreArchivo);
    setSubiendo(false);

    if (!proc.ok || !proc.resultado) {
      toast.error(proc.error ?? "No se pudieron guardar las nóminas.");
      return;
    }
    const r = proc.resultado;
    if (r.rechazadoTodo) {
      toast.error("El archivo tiene errores: no se ha guardado nada.", {
        description:
          r.sinEmpleado.length > 0
            ? `Sin trabajador asignado: ${r.sinEmpleado.slice(0, 4).join(", ")}.`
            : "Hay nóminas de otro mes.",
      });
    } else {
      const avisos: string[] = [];
      if (r.yaExistian > 0) avisos.push(`${r.yaExistian} ya estaba${r.yaExistian === 1 ? "" : "n"} subida${r.yaExistian === 1 ? "" : "s"}`);
      if (fallos > 0) avisos.push(`${fallos} archivo${fallos === 1 ? "" : "s"} con error`);
      toast.success(`${r.guardadas} nómina${r.guardadas === 1 ? "" : "s"} volcada${r.guardadas === 1 ? "" : "s"}.`, {
        description: avisos.length > 0 ? avisos.join(" · ") : undefined,
      });
    }
    await recargar();
    onCambio?.();
  };

  // Borrado REAL (fila + documento). Es la vía para corregir una nómina mal
  // leída: los importes no se editan a mano, se borra y se sube la correcta.
  const borrar = async (n: NominaRevision) => {
    const ok = await confirm({
      title: `Borrar la nómina de ${n.empleadoNombre}`,
      description:
        "Se borrará la nómina y su documento, y los importes del pago se recalcularán sin ella. " +
        "Después podrás subir la nómina correcta. Esta acción no se puede deshacer.",
      confirmLabel: "Borrar nómina",
    });
    if (!ok) return;
    setAccionando(n.id);
    const res = await borrarNominaSubida(n.id);
    setAccionando(null);
    if (res.ok) {
      toast.success("Nómina borrada. Ya puedes subir la correcta.");
      await recargar();
      onCambio?.();
    } else {
      toast.error(res.error ?? "No se pudo borrar la nómina.");
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

        {/* Subir desde aquí mismo: tras borrar una nómina mal leída, se sube la
            correcta sin salir de la ventana de revisión. */}
        {tab === "revision" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              ¿Alguna nómina mal leída? Bórrala y sube la correcta.
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={(e) => {
                void subir(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              disabled={subiendo}
              onClick={() => inputRef.current?.click()}
            >
              {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {subiendo ? `Leyendo… ${progreso.hechas}/${progreso.total}` : "Subir nóminas"}
            </Button>
          </div>
        )}

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
              onBorrar={borrar}
            />
          ) : (
            <HistoricoLista historico={historico} />
          )}
        </div>
        {confirmDialog}
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
  onBorrar,
  abriendo,
  onAbrir,
  onRevisar,
}: {
  nominas: NominaRevision[];
  accionando: string | null;
  abriendo: string | null;
  onAbrir: (n: NominaRevision) => void;
  onRevisar: (n: NominaRevision, a: "aprobar" | "denegar") => void;
  onBorrar: (n: NominaRevision) => void;
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

          {/* Borrado REAL: es la vía para corregir importes mal leídos — se borra
              la nómina y se sube la correcta, en vez de editar los datos a mano. */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 shrink-0 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
            disabled={accionando === n.id}
            onClick={() => onBorrar(n)}
            title="Borrar esta nómina y su documento (para volver a subir la correcta)"
          >
            <Trash2 className="h-4 w-4" />
            Borrar
          </Button>
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
