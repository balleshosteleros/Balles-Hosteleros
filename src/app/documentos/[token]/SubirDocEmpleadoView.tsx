"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { MAX_DOCUMENTO_MB, MAX_DOCUMENTO_BYTES } from "@/shared/lib/documentos";
import { friendlyError } from "@/shared/lib/friendly-errors";

/** Lo mismo que admite el servidor. Se valida aquí solo para avisar antes. */
const TIPOS_OK = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

interface Props {
  endpoint: string;
  empleadoNombre: string;
  empresaNombre: string;
  titulo: string;
  descripcion: string;
  yaSubido: boolean;
}

export function SubirDocEmpleadoView({
  endpoint,
  empleadoNombre,
  empresaNombre,
  titulo,
  descripcion,
  yaSubido,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(yaSubido);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelect = (f: File | null) => {
    setError(null);
    if (!f) return setFile(null);
    if (!TIPOS_OK.includes(f.type)) {
      return setError("Formato no admitido. Sube una foto (JPG, PNG) o un PDF.");
    }
    if (f.size > MAX_DOCUMENTO_BYTES) return setError(`El archivo supera ${MAX_DOCUMENTO_MB} MB.`);
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
      if (json.ok) setHecho(true);
      else setError(json.error ?? "No se pudo subir el documento.");
    } catch (err) {
      setError(friendlyError(err, "subir"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <h1 className="text-lg font-semibold text-zinc-900">{titulo}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Hola {empleadoNombre}. {empresaNombre} necesita este documento para completar tu ficha.
        </p>

        {hecho ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="mt-2 text-sm font-medium text-emerald-900">
              Recibido. Muchas gracias, ya no tienes que hacer nada más.
            </p>
            <button
              onClick={() => {
                setHecho(false);
                setFile(null);
              }}
              className="mt-3 text-xs text-emerald-700 underline"
            >
              Subir otro archivo
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-sm text-zinc-700">{descripcion}</p>
            </div>

            <div
              className="mt-4 border-2 border-dashed border-zinc-300 rounded-lg p-6 text-center cursor-pointer hover:border-zinc-400 transition"
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-zinc-800">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-zinc-500">
                  <UploadCloud className="h-7 w-7" />
                  <span className="text-sm">Pulsa para hacer una foto o elegir el archivo</span>
                  <span className="text-xs">Foto (JPG, PNG) o PDF · máximo {MAX_DOCUMENTO_MB} MB</span>
                </div>
              )}
            </div>

            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

            <button
              onClick={subir}
              disabled={!file || enviando}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-emerald-700 transition"
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {enviando ? "Subiendo…" : "Enviar"}
            </button>

            <p className="mt-4 text-xs text-zinc-500">
              Este enlace es solo tuyo: lo que subas va directo a tu ficha y no lo ve ningún otro
              compañero.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
