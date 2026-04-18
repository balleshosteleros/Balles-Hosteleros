"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileSearch, RefreshCw, AlertTriangle, Plus } from "lucide-react";
import {
  asegurarModelosDelPeriodo,
  listModelos,
} from "../actions/modelos-actions";
import { ModeloCard } from "./ModeloCard";
import type { ModeloAeat, ModeloTipo } from "../types/modelos";

type GrupoTipo = "TRIMESTRALES" | "ANUALES";

const AÑO_ACTUAL = new Date().getFullYear();
const AÑOS = [AÑO_ACTUAL, AÑO_ACTUAL - 1, AÑO_ACTUAL - 2];

function grupoDeModelo(tipo: ModeloTipo): GrupoTipo {
  return tipo === "390" || tipo === "347" ? "ANUALES" : "TRIMESTRALES";
}

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
  const anuales = useMemo(
    () => modelos.filter((m) => grupoDeModelo(m.tipo) === "ANUALES"),
    [modelos],
  );

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileSearch className="h-8 w-8 text-primary" />
            Modelos AEAT
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Borradores oficiales listos para presentar a la Agencia Tributaria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(ejercicio)}
            onValueChange={(v) => setEjercicio(Number.parseInt(v, 10))}
          >
            <SelectTrigger className="w-32">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => startTransition(() => refrescar(ejercicio))}
            disabled={isPending || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
            Refrescar
          </Button>
        </div>
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
        <div className="text-center py-12 text-muted-foreground">Cargando modelos...</div>
      ) : modelos.length === 0 ? null : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold border-b pb-2">Modelos trimestrales</h2>
            {porTipoQ.map((grupo) => (
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
