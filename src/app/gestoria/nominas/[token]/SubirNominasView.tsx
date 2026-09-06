"use client";

import { useRef, useState } from "react";
import { UploadCloud, CheckCircle2, AlertTriangle, Loader2, Lock } from "lucide-react";
import { MAX_NOMINAS_MB, MAX_NOMINAS_BYTES } from "@/shared/lib/documentos";
import { friendlyError } from "@/shared/lib/friendly-errors";

/**
 * Pantalla que ve la GESTORÍA al abrir el enlace del correo.
 *
 * Es de un tercero que entra una vez al mes, sin cuenta ni formación: solo dos
 * cosas que hacer —nóminas y seguros sociales—, cada una con su mes y su
 * archivo. Nada más. Antes esta vista mostraba cuadres, desgloses por mes
 * cotizado, avisos de trabajadores de baja y comparativas TC1↔nóminas: es
 * información de control INTERNO, útil para RRHH dentro de la app, pero que
 * aquí solo tapaba las dos únicas acciones posibles.
 *
 * Un mes con documento ya entregado NO se puede volver a elegir: sale marcado
 * como entregado y deshabilitado. Se cierra POR TIPO, no el mes entero, porque
 * los dos documentos llegan por separado (la Seguridad Social liquida a mes
 * vencido: con las nóminas de agosto llega el recibo de julio).
 */

interface Props {
  /** Endpoint POST al que se suben los documentos. */
  endpoint: string;
  empresaNombre: string;
  /** Meses elegibles y su estado. El enlace es permanente: el mes se elige aquí. */
  meses: EstadoMes[];
  /** Mes preseleccionado: el anterior al actual, que es el habitual. */
  mesSugerido: string;
}

export interface EstadoMes {
  periodo: string;
  /** Confirmado por RRHH: no admite nada. */
  cerrado: boolean;
  /** Ya tiene nóminas entregadas. */
  tieneNominas: boolean;
  /** Ya tiene recibo de seguros sociales que cotiza ese mes. */
  tieneSegurosSociales: boolean;
  /** Devuelto por RRHH para corregir: vuelve a estar libre. */
  rechazado: boolean;
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function nombreMes(periodo: string): string {
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

type Tipo = "nominas" | "tc1";

/** ¿Está ya entregado ese mes para este tipo de documento? */
function entregado(m: EstadoMes, tipo: Tipo): boolean {
  if (m.rechazado) return false; // RRHH lo devolvió: vuelve a admitir envío.
  if (m.cerrado) return true;
  return tipo === "nominas" ? m.tieneNominas : m.tieneSegurosSociales;
}

export function SubirNominasView({ endpoint, empresaNombre, meses, mesSugerido }: Props) {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-zinc-900">Subir documentos</h1>
          <p className="mt-1 text-sm text-zinc-600">{empresaNombre}</p>
        </div>

        <Bloque
          tipo="nominas"
          titulo="Nóminas"
          endpoint={endpoint}
          meses={meses}
          mesSugerido={mesSugerido}
        />

        <Bloque
          tipo="tc1"
          titulo="Seguros sociales"
          endpoint={endpoint}
          meses={meses}
          mesSugerido={mesSugerido}
        />

        <p className="text-center text-xs text-zinc-400">
          PDF o imagen · máximo {MAX_NOMINAS_MB} MB
        </p>
      </div>
    </div>
  );
}

/**
 * Un bloque = un documento. Elegir mes, adjuntar y enviar. Cada bloque lleva su
 * propio estado: subir las nóminas no interfiere con los seguros sociales.
 */
function Bloque({
  tipo,
  titulo,
  endpoint,
  meses,
  mesSugerido,
}: {
  tipo: Tipo;
  titulo: string;
  endpoint: string;
  meses: EstadoMes[];
  mesSugerido: string;
}) {
  // Primer mes libre para ESTE documento: si el sugerido ya está entregado, no
  // tiene sentido dejarlo puesto para que el envío falle después.
  const primerLibre =
    meses.find((m) => m.periodo === mesSugerido && !entregado(m, tipo))?.periodo ??
    meses.find((m) => !entregado(m, tipo))?.periodo ??
    mesSugerido;

  const [mes, setMes] = useState(primerLibre);
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Meses ya entregados de este tipo: se enseñan, pero no se pueden elegir.
  const libres = meses.filter((m) => !entregado(m, tipo));
  const sinMesesLibres = libres.length === 0;

  const elegirArchivo = (f: File | null) => {
    setError(null);
    setHecho(null);
    if (!f) return setFile(null);
    const tipoOk = TIPOS_OK.includes(f.type) || /\.pdf$/i.test(f.name);
    if (!tipoOk) {
      setError("Formato no admitido. Adjunta un PDF o una imagen.");
      return;
    }
    if (f.size > MAX_NOMINAS_BYTES) {
      setError(`El archivo supera ${MAX_NOMINAS_MB} MB.`);
      return;
    }
    setFile(f);
  };

  const enviar = async () => {
    if (!file) return;
    setEnviando(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      fd.append("documento", tipo);
      if (tipo === "nominas") {
        fd.append("periodo", mes);
      } else {
        // El recibo se guarda con la entrega del mes siguiente, pero lo que
        // manda es el mes que COTIZA: es el que elige aquí la gestoría.
        fd.append("periodo", mes);
        fd.append("periodoCotizacion", mes);
      }
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) {
        setHecho(nombreMes(mes));
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setError(json.error ?? "No se pudo subir el archivo.");
      }
    } catch (err) {
      setError(friendlyError(err, "subirDocumentoGestoria"));
    } finally {
      setEnviando(false);
    }
  };

  // Enviado: se sustituye el bloque por la confirmación, para que quede claro
  // que eso ya está hecho y no se vuelva a subir por si acaso.
  if (hecho) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">{titulo} de {hecho}</p>
            <p className="text-sm text-emerald-700">Recibido correctamente.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900">{titulo}</h2>

      {sinMesesLibres ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-zinc-50 p-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
          <p className="text-sm text-zinc-600">
            Ya está todo entregado. Si falta algo, avisa a la empresa.
          </p>
        </div>
      ) : (
        <>
          <label
            htmlFor={`mes-${tipo}`}
            className="mt-3 block text-xs font-medium text-zinc-700"
          >
            Mes
          </label>
          <select
            id={`mes-${tipo}`}
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            disabled={enviando}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 disabled:opacity-50"
          >
            {meses.map((m) => {
              const bloqueado = entregado(m, tipo);
              return (
                <option key={m.periodo} value={m.periodo} disabled={bloqueado}>
                  {nombreMes(m.periodo)}
                  {bloqueado ? " — ya entregado" : ""}
                </option>
              );
            })}
          </select>

          <label
            htmlFor={`archivo-${tipo}`}
            className={`mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-sm transition-colors ${
              file
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50"
            }`}
          >
            <UploadCloud className="h-5 w-5 shrink-0" />
            <span className="truncate">{file ? file.name : "Adjuntar archivo"}</span>
          </label>
          <input
            ref={inputRef}
            id={`archivo-${tipo}`}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            disabled={enviando}
            onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
          />

          {error ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-sm text-rose-800">{error}</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={enviar}
            disabled={!file || enviando}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando…
              </>
            ) : (
              "Enviar"
            )}
          </button>
        </>
      )}
    </div>
  );
}
