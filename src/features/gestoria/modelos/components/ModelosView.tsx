"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefreshCw, AlertTriangle, Plus } from "lucide-react";
import {
  asegurarModelosDelPeriodo,
  listModelos,
} from "../actions/modelos-actions";
import { ModeloCard } from "./ModeloCard";
import { ModelosConfigDialog } from "./ModelosConfigDialog";
import { CalendarioFiscal } from "./CalendarioFiscal";
import type { ModeloAeat, ModeloTipo } from "../types/modelos";
import { grupoDeModelo } from "../types/modelos";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

const AÑO_ACTUAL = new Date().getFullYear();
const AÑOS = [AÑO_ACTUAL, AÑO_ACTUAL - 1, AÑO_ACTUAL - 2];

export function ModelosView() {
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
        <div className="flex-1" />
        <Select
          value={String(ejercicio)}
          onValueChange={(v) => setEjercicio(Number.parseInt(v, 10))}
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

      {loading ? (
        <LoadingSpinner className="py-12" />
      ) : modelos.length === 0 ? null : (
        <>
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
