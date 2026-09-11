"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { MAX_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES } from "@/shared/lib/documentos";
import { friendlyError } from "@/shared/lib/friendly-errors";

interface Props {
  endpoint: string;
  trabajador: { nombre: string; dniNie: string | null };
  empresaNombre: string;
  fechaBaja: string;
  yaSubido: boolean;
}

/**
 * Pantalla pública donde la gestoría devuelve el comprobante de haber tramitado
 * una baja médica. Sin sesión: el enlace del correo es la credencial.
 *
 * Antes de dejar subir nada enseña de quién es la baja y obliga a confirmarlo:
 * una gestoría lleva varias empresas y varios trabajadores a la vez, y subir el
 * papel de otra persona es el error fácil de cometer y difícil de detectar.
 */
export function SubirComprobanteView({
  endpoint,
  trabajador,
  empresaNombre,
  fechaBaja,
  yaSubido,
}: Props) {
  const [subido, setSubido] = useState(yaSubido);
  const [confirmado, setConfirmado] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelect = (f: File | null) => {
    setError(null);
    if (!f) return setFile(null);
    if (f.type !== "application/pdf") return setError("El comprobante debe ser un PDF.");
    if (f.size > MAX_DOCUMENTO_BYTES) return setError(`El PDF supera ${MAX_DOCUMENTO_MB} MB.`);
    setFile(f);
  };

  const subir = async () => {
    if (!file) return;
    setEnviando(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("documento", file);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) setSubido(true);
      else setError(json.error ?? "No se pudo subir el comprobante.");
    } catch (err) {
      setError(friendlyError(err, "subir"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <h1 className="text-lg font-semibold text-zinc-900">Comprobante de la baja médica</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {empresaNombre} te pide el justificante de haber tramitado esta baja.
        </p>

        {/* De QUIÉN es esta baja: la gestoría lleva varias empresas a la vez. */}
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-900">Baja médica de:</p>
              <p className="mt-1 text-amber-900">
                <span className="font-bold">{trabajador.nombre}</span>
                {trabajador.dniNie ? (
                  <>
                    {" · "}DNI/NIE:{" "}
                    <span className="font-mono font-bold">{trabajador.dniNie}</span>
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-amber-900">
                Desde el <span className="font-bold">{fechaBaja}</span>
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Comprueba que el comprobante corresponde a esta persona y a esta baja antes de
                subirlo.
              </p>
            </div>
          </div>
        </div>

        {subido ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="mt-2 text-sm font-medium text-emerald-900">
              Hemos recibido el comprobante. Gracias.
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Ya consta en el expediente del trabajador. Puedes cerrar esta página.
            </p>
          </div>
        ) : (
          <>
            <label className="mt-5 flex items-start gap-2 text-sm text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Confirmo que el comprobante pertenece a <b>{trabajador.nombre}</b>
                {trabajador.dniNie ? ` (${trabajador.dniNie})` : ""}.
              </span>
            </label>

            <div className={`mt-4 rounded-xl border border-zinc-200 p-4 ${confirmado ? "" : "opacity-50"}`}>
              <p className="text-sm font-medium text-zinc-900">
                Comprobante de la baja <span className="text-rose-600">*</span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                El justificante de haber tramitado la baja médica ante la Seguridad Social.
              </p>

              <div
                className="mt-3 border-2 border-dashed border-zinc-300 rounded-lg p-4 text-center cursor-pointer hover:border-zinc-400 transition"
                onClick={() => confirmado && inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  disabled={!confirmado}
                  onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2 text-zinc-800">
                    <FileText className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium">{file.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-zinc-500">
                    <UploadCloud className="h-6 w-6" />
                    <span className="text-xs">Pulsa para elegir el PDF</span>
                  </div>
                )}
              </div>

              {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

              <button
                onClick={subir}
                disabled={!file || !confirmado || enviando}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 hover:bg-emerald-700 transition"
              >
                {enviando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                {enviando ? "Subiendo…" : "Subir"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
