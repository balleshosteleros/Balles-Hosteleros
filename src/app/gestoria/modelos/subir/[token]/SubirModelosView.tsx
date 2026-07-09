"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, FileUp, Upload } from "lucide-react";

interface Modelo {
  tipo: string;
  label: string;
  tienePdf: boolean;
}

interface Props {
  /** Endpoint POST al que se sube cada modelo (por-token). */
  endpoint: string;
  empresaNombre: string;
  /** p.ej. "2026 · 1T" o "Ejercicio 2025" */
  periodoLabel: string;
  grupo: "TRIMESTRALES" | "ANUALES";
  /** Lista de modelos del periodo con su estado. */
  modelos: Modelo[];
}

type EstadoFila = "idle" | "subiendo" | "ok" | "error";

interface FilaState {
  estado: EstadoFila;
  error: string | null;
  file: File | null;
}

export function SubirModelosView({ endpoint, empresaNombre, periodoLabel, modelos }: Props) {
  // Estado por-fila, keyed por modelo.tipo. Arranca en "ok" si ya tiene PDF.
  const [filas, setFilas] = useState<Record<string, FilaState>>(() => {
    const inicial: Record<string, FilaState> = {};
    for (const m of modelos) {
      inicial[m.tipo] = {
        estado: m.tienePdf ? "ok" : "idle",
        error: null,
        file: null,
      };
    }
    return inicial;
  });

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const todosRecibidos = useMemo(
    () => modelos.length > 0 && modelos.every((m) => filas[m.tipo]?.estado === "ok"),
    [modelos, filas],
  );

  const onSelect = (tipo: string, f: File | null) => {
    setFilas((prev) => {
      const actual = prev[tipo];
      if (!f) {
        return { ...prev, [tipo]: { ...actual, file: null, error: null } };
      }
      if (f.type !== "application/pdf") {
        return {
          ...prev,
          [tipo]: { ...actual, file: null, estado: "error", error: "El modelo debe ser un PDF." },
        };
      }
      if (f.size > 10 * 1024 * 1024) {
        return {
          ...prev,
          [tipo]: { ...actual, file: null, estado: "error", error: "El PDF supera 10 MB." },
        };
      }
      // Al elegir un fichero nuevo volvemos a idle para poder subirlo.
      return { ...prev, [tipo]: { estado: "idle", error: null, file: f } };
    });
  };

  const subir = async (modelo: Modelo) => {
    const fila = filas[modelo.tipo];
    if (!fila?.file) return;

    setFilas((prev) => ({
      ...prev,
      [modelo.tipo]: { ...prev[modelo.tipo], estado: "subiendo", error: null },
    }));

    try {
      const fd = new FormData();
      fd.append("tipo", modelo.tipo);
      fd.append("file", fila.file);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) {
        setFilas((prev) => ({
          ...prev,
          [modelo.tipo]: { estado: "ok", error: null, file: null },
        }));
      } else {
        const motivo = json.iaMotivo ?? json.error ?? "No se pudo subir el modelo.";
        setFilas((prev) => ({
          ...prev,
          [modelo.tipo]: { ...prev[modelo.tipo], estado: "error", error: motivo },
        }));
      }
    } catch {
      setFilas((prev) => ({
        ...prev,
        [modelo.tipo]: {
          ...prev[modelo.tipo],
          estado: "error",
          error: "No se pudo conectar. Inténtalo de nuevo.",
        },
      }));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <h1 className="text-lg font-semibold text-zinc-900">Subir modelos {periodoLabel}</h1>
        <p className="mt-1 text-sm text-zinc-600">{empresaNombre}</p>
        <p className="mt-3 text-sm text-zinc-600">
          Adjunta cada modelo en su casilla. Verificaremos automáticamente que cada documento es
          correcto.
        </p>

        {todosRecibidos && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-emerald-900">
                Has subido todos los modelos. ¡Gracias!
              </p>
            </div>
          </div>
        )}

        {/* Lista de modelos */}
        <div className="mt-5 divide-y divide-zinc-100">
          {modelos.map((modelo) => {
            const fila = filas[modelo.tipo] ?? { estado: "idle", error: null, file: null };
            const esOk = fila.estado === "ok";
            const subiendo = fila.estado === "subiendo";

            return (
              <div key={modelo.tipo} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {esOk ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : (
                      <FileUp className="h-5 w-5 text-zinc-400 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-zinc-900 truncate">
                      {modelo.label}
                    </span>
                  </div>
                  {esOk && (
                    <span className="text-xs font-semibold text-emerald-600 shrink-0">Recibido</span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <input
                    ref={(el) => {
                      inputRefs.current[modelo.tipo] = el;
                    }}
                    type="file"
                    accept="application/pdf"
                    className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
                    onChange={(e) => onSelect(modelo.tipo, e.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => subir(modelo)}
                    disabled={!fila.file || subiendo}
                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-emerald-700 transition shrink-0"
                  >
                    {subiendo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {subiendo ? "Subiendo…" : esOk ? "Reemplazar" : "Subir"}
                  </button>
                </div>

                {fila.estado === "error" && fila.error && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-rose-600">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{fila.error}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
