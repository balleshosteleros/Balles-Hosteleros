"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefreshCw, AlertTriangle, Plus, Clock, Info, CalendarClock, CheckCircle2 } from "lucide-react";
import {
  asegurarModelosDelPeriodo,
  listModelos,
} from "../actions/modelos-actions";
import { ModeloCard } from "./ModeloCard";
import { ModelosConfigDialog } from "./ModelosConfigDialog";
import { CalendarioFiscal } from "./CalendarioFiscal";
import { AnaliticaModelos } from "./AnaliticaModelos";
import type { EstadoVisualModelo, ModeloAeat, ModeloTipo } from "../types/modelos";
import { grupoDeModelo, estadoVisualModelo, ESTADO_VISUAL_LABEL } from "../types/modelos";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

const AÑO_ACTUAL = new Date().getFullYear();
// Hay modelos presentados importados desde 2023: el selector debe alcanzarlos.
const AÑOS = [AÑO_ACTUAL, AÑO_ACTUAL - 1, AÑO_ACTUAL - 2, AÑO_ACTUAL - 3, AÑO_ACTUAL - 4];

/**
 * Resumen del ejercicio: un contador por estado visual. Los colores son los
 * mismos que los badges de ModeloCard para que la vista se lea de un vistazo.
 * El orden va de lo más urgente (fuera de plazo) a lo ya cerrado (presentado).
 */
const ORDEN_RESUMEN: EstadoVisualModelo[] = [
  "FUERA_PLAZO",
  "EN_PLAZO",
  "SOLICITADO",
  "SIN_ABRIR",
  "PRESENTADO",
];

const RESUMEN_STYLE: Record<
  EstadoVisualModelo,
  { icono: typeof AlertTriangle; iconCls: string; bgCls: string; barCls: string }
> = {
  FUERA_PLAZO: { icono: AlertTriangle, iconCls: "text-red-600", bgCls: "bg-red-50", barCls: "bg-red-500" },
  EN_PLAZO: { icono: Clock, iconCls: "text-amber-600", bgCls: "bg-amber-50", barCls: "bg-amber-500" },
  SOLICITADO: { icono: Info, iconCls: "text-sky-600", bgCls: "bg-sky-50", barCls: "bg-sky-500" },
  SIN_ABRIR: { icono: CalendarClock, iconCls: "text-slate-600", bgCls: "bg-slate-100", barCls: "bg-slate-400" },
  PRESENTADO: { icono: CheckCircle2, iconCls: "text-green-600", bgCls: "bg-green-50", barCls: "bg-green-500" },
};

function ResumenEjercicio({ modelos }: { modelos: ModeloAeat[] }) {
  const conteo = useMemo(() => {
    const base: Record<EstadoVisualModelo, number> = {
      FUERA_PLAZO: 0,
      EN_PLAZO: 0,
      SOLICITADO: 0,
      SIN_ABRIR: 0,
      PRESENTADO: 0,
    };
    for (const m of modelos) base[estadoVisualModelo(m)] += 1;
    return base;
  }, [modelos]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {ORDEN_RESUMEN.map((estado) => {
        const { icono: Icono, iconCls, bgCls, barCls } = RESUMEN_STYLE[estado];
        return (
          <div
            key={estado}
            className="relative overflow-hidden rounded-lg border bg-card px-3 py-2.5 hover:shadow-sm transition-shadow"
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${barCls}`} />
            <div className="flex items-center gap-2.5 pl-1">
              <div className={`flex items-center justify-center h-7 w-7 rounded-md ${bgCls} shrink-0`}>
                <Icono className={`h-3.5 w-3.5 ${iconCls}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none tracking-tight">{conteo[estado]}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                  {ESTADO_VISUAL_LABEL[estado]}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type SubVista = "modelos" | "analitica";

export function ModelosView() {
  const [vista, setVista] = useState<SubVista>("modelos");
  const [ejercicio, setEjercicio] = useState<number>(AÑO_ACTUAL);
  const [modelos, setModelos] = useState<ModeloAeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refrescar(año: number) {
    setLoading(true);
    setError(null);
    const asegurar = await asegurarModelosDelPeriodo(año);
    if (!asegurar.ok) {
      setError(
        `No se pudieron crear los modelos: ${asegurar.error ?? "error desconocido"}`,
      );
      console.error("[modelos] asegurar:", asegurar.error);
    }
    const res = await listModelos(año);
    if (res.ok) setModelos(res.data);
    else setError(`Error al listar modelos: ${res.error ?? "desconocido"}`);
    setLoading(false);
  }

  async function crearModelosManual() {
    await refrescar(ejercicio);
  }

  useEffect(() => {
    refrescar(ejercicio);
  }, [ejercicio]);

  const trimestrales = useMemo(
    () => modelos.filter((m) => grupoDeModelo(m.tipo) === "TRIMESTRALES"),
    [modelos],
  );
  const anuales = useMemo(() => {
    const orden: ModeloTipo[] = ["390", "347", "200", "190", "PYG", "BALANCE", "LIBRO_MAYOR"];
    return modelos
      .filter((m) => grupoDeModelo(m.tipo) === "ANUALES")
      .sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo));
  }, [modelos]);

  const porTipoQ = useMemo(() => {
    const tipos: ModeloTipo[] = ["303", "130", "111", "115"];
    return tipos.map((t) => ({
      tipo: t,
      modelos: trimestrales
        .filter((m) => m.tipo === t)
        .sort((a, b) => a.periodo.localeCompare(b.periodo)),
    }));
  }, [trimestrales]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-lg border p-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => startTransition(() => refrescar(ejercicio))}
          disabled={isPending || loading}
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          Refrescar
        </Button>
        <CalendarioFiscal ejercicio={ejercicio} />

        {/* Sub-vistas del submódulo: el listado de huecos y la analítica de lo
            presentado. La analítica no depende del ejercicio elegido: pinta la
            serie histórica completa. */}
        <div className="inline-flex rounded-md border p-0.5">
          {(["modelos", "analitica"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                vista === v ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              {v === "modelos" ? "Modelos" : "Analítica"}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <Select
          value={String(ejercicio)}
          onValueChange={(v) => setEjercicio(Number.parseInt(v, 10))}
          disabled={vista === "analitica"}
        >
          <SelectTrigger className="w-32 h-9 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AÑOS.map((a) => (
              <SelectItem key={a} value={String(a)}>
                Ejercicio {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ModelosConfigDialog onSaved={() => refrescar(ejercicio)} />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error al cargar los modelos</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{error}</p>
            <p className="text-xs">
              Si es un error de permisos RLS, aplica el fix del SQL Editor y vuelve a pulsar
              &quot;Crear modelos&quot;.
            </p>
            <Button size="sm" variant="outline" onClick={crearModelosManual} disabled={isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Reintentar / Crear modelos ahora
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!error && !loading && modelos.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-muted-foreground">
            Aún no hay modelos para el ejercicio {ejercicio}.
          </p>
          <Button onClick={crearModelosManual} disabled={isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Crear los 18 modelos del ejercicio
          </Button>
        </div>
      ) : null}

      {vista === "analitica" ? (
        <AnaliticaModelos />
      ) : loading ? (
        <LoadingSpinner className="py-12" />
      ) : modelos.length === 0 ? null : (
        <>
          <ResumenEjercicio modelos={modelos} />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold border-b pb-2">Modelos trimestrales</h2>
            {porTipoQ
              .filter((grupo) => grupo.modelos.length > 0)
              .map((grupo) => (
                <div key={grupo.tipo} className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Modelo {grupo.tipo}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {grupo.modelos.map((m) => (
                      <ModeloCard key={m.id} modelo={m} />
                    ))}
                  </div>
                </div>
              ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold border-b pb-2">Modelos anuales</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {anuales.map((m) => (
                <ModeloCard key={m.id} modelo={m} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
