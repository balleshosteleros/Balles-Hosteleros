"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  /** Endpoint POST al que se sube el contrato (por-token o por-hash). */
  endpoint: string;
  trabajador: { nombre: string; dniNie: string | null };
  empresaNombre: string;
}

export function SubirContratoView({ endpoint, trabajador, empresaNombre }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelect = (f: File | null) => {
    setError(null);
    if (!f) return setFile(null);
    if (f.type !== "application/pdf") {
      setError("El contrato debe ser un PDF.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("El PDF supera 10 MB.");
      return;
    }
    setFile(f);
  };

  const subir = async () => {
    if (!file || !confirmado) return;
    setEnviando(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("contrato", file);
      const res = await fetch(endpoint, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (json.ok) setHecho(true);
      else setError(json.error ?? "No se pudo subir el contrato.");
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (hecho) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 text-center">
          <div className="flex justify-center mb-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-900">Contrato enviado</h1>
          <p className="mt-2 text-sm text-zinc-600">
            El contrato de <b>{trabajador.nombre}</b> se ha recibido y se ha enviado al trabajador
            para su firma. Gracias.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <h1 className="text-lg font-semibold text-zinc-900">Subir contrato firmado</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {empresaNombre} te pide adjuntar el contrato de este trabajador.
        </p>

        {/* Aviso destacado: a QUIÉN pertenece este enlace, para no confundirse. */}
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900">
                Vas a subir el contrato de este trabajador:
              </p>
              <p className="mt-1 text-amber-900">
                <span className="font-bold">{trabajador.nombre}</span>
                {trabajador.dniNie ? (
                  <>
                    {" · "}DNI/NIE: <span className="font-mono font-bold">{trabajador.dniNie}</span>
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Asegúrate de que el contrato corresponde a esta persona antes de subirlo.
              </p>
            </div>
          </div>
        </div>

        {/* Zona de subida */}
        <div
          className="mt-5 border-2 border-dashed border-zinc-300 rounded-xl p-6 text-center cursor-pointer hover:border-zinc-400 transition"
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-zinc-800">
              <FileText className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <UploadCloud className="h-8 w-8" />
              <span className="text-sm">Pulsa para elegir el PDF del contrato</span>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <label className="mt-4 flex items-start gap-2 text-sm text-zinc-700 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Confirmo que este contrato pertenece a <b>{trabajador.nombre}</b>
            {trabajador.dniNie ? ` (${trabajador.dniNie})` : ""}.
          </span>
        </label>

        <button
          onClick={subir}
          disabled={!file || !confirmado || enviando}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-50 hover:bg-emerald-700 transition"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {enviando ? "Subiendo…" : "Subir y enviar al trabajador"}
        </button>
      </div>
    </div>
  );
}
