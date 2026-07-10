"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  /** Endpoint POST al que se suben las nóminas. */
  endpoint: string;
  empresaNombre: string;
  mesLabel: string;
}

interface MesIncorrecto {
  etiqueta: string;
  periodoLeido: string;
}

interface Resultado {
  guardadas: number;
  yaExistian: number;
  sinEmpleado: string[];
  mesIncorrecto: MesIncorrecto[];
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function nombreMesCorto(periodo: string): string {
  const [y, m] = (periodo ?? "").split("-");
  const mes = MESES_ES[Number(m) - 1];
  return mes ? `${mes} ${y}` : periodo;
}

const TIPOS_OK = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
];

export function SubirNominasView({ endpoint, empresaNombre, mesLabel }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelect = (f: File | null) => {
    setError(null);
    setResultado(null);
    if (!f) return setFile(null);
    const tipoOk = TIPOS_OK.includes(f.type) || /\.pdf$/i.test(f.name);
    if (!tipoOk) {
      setError("Formato no admitido. Usa un PDF (recomendado) o una imagen.");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError("El archivo supera 25 MB.");
      return;
    }
    setFile(f);
  };

  const subir = async () => {
    if (!file) return;
    setEnviando(true);
    setError(null);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) {
        setResultado({
          guardadas: json.guardadas ?? 0,
          yaExistian: json.yaExistian ?? 0,
          sinEmpleado: json.sinEmpleado ?? [],
          mesIncorrecto: json.mesIncorrecto ?? [],
        });
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setError(json.error ?? "No se pudieron subir las nóminas.");
      }
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <h1 className="text-lg font-semibold text-zinc-900">Subir nóminas de {mesLabel}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {empresaNombre} te pide adjuntar las nóminas de <b>{mesLabel}</b>.
        </p>

        <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p className="font-semibold">Cómo subirlas</p>
          <p className="mt-1">
            Puedes adjuntar <b>un único PDF con todas las nóminas</b> (una por página) o subir
            varios archivos, uno cada vez. Se leen y vuelcan automáticamente al sistema.
          </p>
        </div>

        {/* Resumen del último volcado (permite seguir subiendo). */}
        {resultado && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-900">
                <p className="font-semibold">Nóminas recibidas</p>
                <p className="mt-1">
                  {resultado.guardadas} nómina{resultado.guardadas === 1 ? "" : "s"} volcada
                  {resultado.guardadas === 1 ? "" : "s"} al sistema
                  {resultado.yaExistian > 0
                    ? ` · ${resultado.yaExistian} ya estaba${resultado.yaExistian === 1 ? "" : "n"}`
                    : ""}
                  .
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  Puedes seguir subiendo más archivos si te faltan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mes incorrecto: NO se han volcado. La gestoría debe anularlas. */}
        {resultado && resultado.mesIncorrecto.length > 0 && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                <p className="font-semibold">
                  {resultado.mesIncorrecto.length} nómina
                  {resultado.mesIncorrecto.length === 1 ? "" : "s"} de otro mes · NO se
                  {resultado.mesIncorrecto.length === 1 ? " ha" : " han"} subido
                </p>
                <p className="mt-1">
                  Solo se admiten nóminas de <b>{mesLabel}</b>. Estas pertenecen a otro mes, así
                  que <b>no se han volcado</b>. Anúlalas y no las vuelvas a adjuntar:
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {resultado.mesIncorrecto.map((x, i) => (
                    <li key={i}>
                      {x.etiqueta} — leída como <b>{nombreMesCorto(x.periodoLeido)}</b>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Empleados no dados de alta: no hay a quién asignarlas. */}
        {resultado && resultado.sinEmpleado.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold">
                  {resultado.sinEmpleado.length} nómina
                  {resultado.sinEmpleado.length === 1 ? "" : "s"} sin trabajador · NO se
                  {resultado.sinEmpleado.length === 1 ? " ha" : " han"} subido
                </p>
                <p className="mt-1">
                  Est{resultado.sinEmpleado.length === 1 ? "e trabajador no está dado" : "os trabajadores no están dados"} de
                  alta en el sistema, así que no se {resultado.sinEmpleado.length === 1 ? "ha" : "han"} podido asignar.
                  Avisa a la empresa para que {resultado.sinEmpleado.length === 1 ? "lo dé" : "los dé"} de alta:
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {resultado.sinEmpleado.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Zona de subida */}
        <div
          className="mt-5 border-2 border-dashed border-zinc-300 rounded-xl p-6 text-center cursor-pointer hover:border-zinc-400 transition"
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
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
              <span className="text-sm">Pulsa para elegir el archivo de nóminas</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-sm text-rose-600">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={subir}
          disabled={!file || enviando}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-50 hover:bg-emerald-700 transition"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {enviando ? "Leyendo y volcando…" : "Subir nóminas"}
        </button>

        {enviando && (
          <p className="mt-2 text-center text-xs text-zinc-500">
            Un PDF con muchas nóminas puede tardar un poco. No cierres la ventana.
          </p>
        )}
      </div>
    </div>
  );
}
