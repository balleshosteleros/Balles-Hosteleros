"use client";

import { useMemo, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileUp,
  Upload,
  ShieldCheck,
} from "lucide-react";

interface Modelo {
  tipo: string;
  label: string;
  yaEnSoftware: boolean; // ya confirmado antes (subido definitivamente)
  enStaging: boolean; // adjuntado en esta sesión, pendiente de confirmar
  iaOk: boolean; // validación IA OK del que está en staging
  obligatorio: boolean; // hay que subirlo para poder enviar
}

interface Props {
  /** Endpoint POST por-token: "/api/gestoria/modelos/subir/<token>" */
  endpoint: string;
  empresaNombre: string;
  /** p.ej. "2026 · 1T" o "Ejercicio 2025" */
  periodoLabel: string;
  grupo: "TRIMESTRALES" | "ANUALES";
  /** Lista de modelos del periodo con su estado. */
  modelos: Modelo[];
}

type EstadoFila = "idle" | "subiendo" | "validado" | "error";

interface FilaState {
  estado: EstadoFila;
  /** Mensaje asociado (motivo IA en verde, o error en rojo). */
  msg: string | null;
  /** Fichero seleccionado pendiente de adjuntar. */
  file: File | null;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export function SubirModelosView({
  endpoint,
  empresaNombre,
  periodoLabel,
  modelos,
}: Props) {
  // Estado por-fila, keyed por modelo.tipo.
  const [filas, setFilas] = useState<Record<string, FilaState>>(() => {
    const inicial: Record<string, FilaState> = {};
    for (const m of modelos) {
      if (m.yaEnSoftware) {
        inicial[m.tipo] = { estado: "validado", msg: "Ya en el software", file: null };
      } else if (m.enStaging && m.iaOk) {
        inicial[m.tipo] = { estado: "validado", msg: "Validado ✓", file: null };
      } else {
        inicial[m.tipo] = { estado: "idle", msg: null, file: null };
      }
    }
    return inicial;
  });

  // Estado del envío final (todo-o-nada).
  const [enviando, setEnviando] = useState(false);
  const [envioError, setEnvioError] = useState<string | null>(null);
  const [faltan, setFaltan] = useState<string[]>([]);
  const [exito, setExito] = useState<{ confirmados: number } | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Mapa tipo → label, para pintar la lista de "faltan".
  const labelPorTipo = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of modelos) m[x.tipo] = x.label;
    return m;
  }, [modelos]);

  // Contador de obligatorios adjuntados (validados o ya en software).
  const obligatorios = useMemo(
    () => modelos.filter((m) => m.obligatorio),
    [modelos],
  );
  const obligatoriosListos = useMemo(
    () =>
      obligatorios.filter((m) => filas[m.tipo]?.estado === "validado").length,
    [obligatorios, filas],
  );

  const onSelect = (tipo: string, f: File | null) => {
    // Al elegir un fichero nuevo se limpia cualquier aviso de envío previo.
    setEnvioError(null);
    setFaltan([]);

    setFilas((prev) => {
      const actual = prev[tipo];
      if (!f) {
        return { ...prev, [tipo]: { ...actual, file: null } };
      }
      if (f.type !== "application/pdf") {
        return {
          ...prev,
          [tipo]: { estado: "error", msg: "El modelo debe ser un PDF.", file: null },
        };
      }
      if (f.size > MAX_BYTES) {
        return {
          ...prev,
          [tipo]: { estado: "error", msg: "El PDF supera 25 MB.", file: null },
        };
      }
      // Fichero válido en local: queda pendiente de adjuntar (idle con file).
      return { ...prev, [tipo]: { estado: "idle", msg: null, file: f } };
    });
  };

  const adjuntar = async (modelo: Modelo) => {
    const fila = filas[modelo.tipo];
    if (!fila?.file) return;

    setFilas((prev) => ({
      ...prev,
      [modelo.tipo]: { ...prev[modelo.tipo], estado: "subiendo", msg: null },
    }));

    try {
      const fd = new FormData();
      fd.append("accion", "validar");
      fd.append("tipo", modelo.tipo);
      fd.append("file", fila.file);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json();

      if (json.ok) {
        setFilas((prev) => ({
          ...prev,
          [modelo.tipo]: {
            estado: "validado",
            msg: json.iaMotivo ?? "Validado ✓",
            file: null,
          },
        }));
      } else {
        const motivo =
          json.iaMotivo ?? json.error ?? "El documento no coincide con el modelo.";
        setFilas((prev) => ({
          ...prev,
          [modelo.tipo]: { ...prev[modelo.tipo], estado: "error", msg: motivo },
        }));
      }
    } catch {
      setFilas((prev) => ({
        ...prev,
        [modelo.tipo]: {
          ...prev[modelo.tipo],
          estado: "error",
          msg: "No se pudo conectar. Inténtalo de nuevo.",
        },
      }));
    }
  };

  const enviarTodo = async () => {
    setEnviando(true);
    setEnvioError(null);
    setFaltan([]);

    try {
      const fd = new FormData();
      fd.append("accion", "confirmar");
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json();

      if (json.ok) {
        setExito({ confirmados: json.confirmados ?? 0 });
      } else {
        setEnvioError(
          json.error ??
            "Debes subir TODOS los modelos requeridos antes de enviar.",
        );
        setFaltan(Array.isArray(json.faltan) ? json.faltan : []);
      }
    } catch {
      setEnvioError("No se pudo conectar. Inténtalo de nuevo.");
      setFaltan([]);
    } finally {
      setEnviando(false);
    }
  };

  // ---- Pantalla de ÉXITO ----
  if (exito) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-zinc-900">¡Listo!</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Se han integrado {exito.confirmados}{" "}
            {exito.confirmados === 1 ? "modelo" : "modelos"} en el software. Gracias.
          </p>
          <p className="mt-4 text-xs text-zinc-500">
            {empresaNombre} · {periodoLabel}
          </p>
        </div>
      </div>
    );
  }

  // ---- Formulario ----
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <h1 className="text-lg font-semibold text-zinc-900">
          Subir modelos {periodoLabel}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">{empresaNombre}</p>
        <p className="mt-3 text-sm text-zinc-600">
          Adjunta cada modelo; se verifica al momento. No se guardará nada hasta que
          pulses &laquo;Enviar todo&raquo; con todos los modelos requeridos.
        </p>

        {/* Lista de modelos */}
        <div className="mt-5 divide-y divide-zinc-100">
          {modelos.map((modelo) => {
            const fila =
              filas[modelo.tipo] ?? { estado: "idle", msg: null, file: null };
            const validado = fila.estado === "idle" ? false : fila.estado === "validado";
            const subiendo = fila.estado === "subiendo";
            const esError = fila.estado === "error";

            return (
              <div key={modelo.tipo} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {validado ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : esError ? (
                      <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
                    ) : (
                      <FileUp className="h-5 w-5 text-zinc-400 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-zinc-900 truncate">
                      {modelo.label}
                    </span>
                  </div>
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                      (modelo.obligatorio
                        ? "bg-amber-100 text-amber-700"
                        : "bg-zinc-100 text-zinc-500")
                    }
                  >
                    {modelo.obligatorio ? "Requerido" : "Opcional"}
                  </span>
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
                    onClick={() => adjuntar(modelo)}
                    disabled={!fila.file || subiendo}
                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 hover:bg-emerald-700 transition shrink-0"
                  >
                    {subiendo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {subiendo
                      ? "Validando…"
                      : validado || fila.file
                        ? "Reemplazar"
                        : "Adjuntar"}
                  </button>
                </div>

                {/* Mensaje verde (validado) */}
                {validado && fila.msg && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{fila.msg}</span>
                  </p>
                )}

                {/* Mensaje rojo (error / IA no coincide) */}
                {esError && fila.msg && (
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-rose-600">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{fila.msg}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Aviso de envío fallido (todo-o-nada) */}
        {envioError && (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-rose-900">{envioError}</p>
                {faltan.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-rose-700 space-y-0.5">
                    {faltan.map((f) => (
                      <li key={f}>{labelPorTipo[f] ?? f}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contador de obligatorios */}
        <div className="mt-6 flex items-center gap-1.5 text-sm text-zinc-600">
          <ShieldCheck className="h-4 w-4 text-zinc-400" />
          <span>
            Requeridos: {obligatoriosListos}/{obligatorios.length} adjuntados
          </span>
        </div>

        {/* Enviar todo */}
        <button
          onClick={enviarTodo}
          disabled={enviando}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60 hover:bg-emerald-700 transition"
        >
          {enviando ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <Upload className="h-5 w-5" />
              Enviar todo
            </>
          )}
        </button>

        <p className="mt-2 text-center text-xs text-zinc-500">
          Es todo o nada: si falta algún modelo requerido, no se guarda ninguno.
        </p>
      </div>
    </div>
  );
}
