"use client";

import { useRef, useState } from "react";
import { UploadCloud, CheckCircle2, AlertTriangle, Loader2, FileText, X } from "lucide-react";
import { MAX_NOMINAS_MB, MAX_NOMINAS_BYTES } from "@/shared/lib/documentos";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { Desplegable } from "@/components/ui/desplegable";

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
          PDF o imagen · puedes adjuntar varios · máximo {MAX_NOMINAS_MB} MB cada uno
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
  // VARIOS archivos por entrega: un mes puede venir en más de un PDF (por
  // lotes, o porque la gestoría los saca por centro de trabajo). Se envían de
  // uno en uno al servidor, que ya sabe acumular en el mismo mes.
  const [files, setFiles] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Meses ya entregados de este tipo: se enseñan, pero no se pueden elegir.
  const libres = meses.filter((m) => !entregado(m, tipo));
  const sinMesesLibres = libres.length === 0;
  // Los más recientes primero, y solo unos pocos: es un recordatorio de qué
  // está hecho, no el histórico completo.
  const mesesEntregados = meses
    .filter((m) => entregado(m, tipo))
    .map((m) => m.periodo)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 4);

  const elegirArchivos = (nuevos: File[]) => {
    setError(null);
    setHecho(null);
    if (nuevos.length === 0) return;

    const malFormato = nuevos.find(
      (f) => !TIPOS_OK.includes(f.type) && !/\.pdf$/i.test(f.name),
    );
    if (malFormato) {
      setError(`«${malFormato.name}» no es un PDF ni una imagen.`);
      return;
    }
    const muyGrande = nuevos.find((f) => f.size > MAX_NOMINAS_BYTES);
    if (muyGrande) {
      setError(`«${muyGrande.name}» supera ${MAX_NOMINAS_MB} MB. Divídelo en varios archivos.`);
      return;
    }
    // Se acumulan: adjuntar por segunda vez añade, no reemplaza. Se descartan
    // los repetidos por nombre y tamaño, que es el despiste habitual.
    setFiles((prev) => {
      const clave = (f: File) => `${f.name}|${f.size}`;
      const yaEstan = new Set(prev.map(clave));
      return [...prev, ...nuevos.filter((f) => !yaEstan.has(clave(f)))];
    });
  };

  const quitarArchivo = (i: number) => {
    setError(null);
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    if (inputRef.current) inputRef.current.value = "";
  };

  const enviar = async () => {
    if (files.length === 0) return;
    setEnviando(true);
    setError(null);
    try {
      // De uno en uno, no en paralelo: cada archivo dispara una lectura por IA
      // pesada, y mandarlos a la vez agota el tiempo de la función. Si uno
      // falla se para ahí y se dice cuál: los ya subidos quedan guardados.
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const fd = new FormData();
        fd.append("archivo", f);
        fd.append("documento", tipo);
        fd.append("periodo", mes);
        if (tipo === "tc1") {
          // El recibo se guarda con la entrega del mes siguiente, pero lo que
          // manda es el mes que COTIZA: es el que elige aquí la gestoría.
          fd.append("periodoCotizacion", mes);
        }
        const res = await fetch(endpoint, { method: "POST", body: fd });
        const json = await res.json();
        if (!json.ok) {
          const cual = files.length > 1 ? `«${f.name}»: ` : "";
          setError(`${cual}${json.error ?? "No se pudo subir el archivo."}`);
          // Se quitan los que YA entraron: al reintentar no se repiten.
          setFiles((prev) => prev.slice(i));
          return;
        }
      }
      setHecho(nombreMes(mes));
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
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
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Acabas de enviar
            </p>
            <p className="mt-0.5 text-sm font-semibold text-emerald-900">
              {titulo} de {hecho}
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Pendiente de revisión. Te avisaremos por correo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Nada pendiente de ESTE documento: mismo verde que al enviar. Que la caja
  // sea gris cuando todo está bien se lee como "algo va mal" o "está apagado",
  // que es justo lo contrario de lo que pasa.
  if (sinMesesLibres) {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900">{titulo}</p>
            <p className="mt-0.5 text-sm text-emerald-700">
              Entregado. No hay ningún mes pendiente.
            </p>
            {mesesEntregados.length > 0 ? (
              <ul className="mt-2.5 space-y-1 border-t border-emerald-200 pt-2.5">
                {mesesEntregados.map((m) => (
                  <li key={m} className="flex items-center gap-2 text-sm text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{nombreMes(m)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900">{titulo}</h2>

          <label
            htmlFor={`mes-${tipo}`}
            className="mt-3 block text-xs font-medium text-zinc-700"
          >
            Mes
          </label>
          <Desplegable
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
                  {bloqueado ? " · Entregado" : ""}
                </option>
              );
            })}
          </Desplegable>

          <label
            htmlFor={`archivo-${tipo}`}
            className={`mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-sm transition-colors ${
              files.length > 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50"
            }`}
          >
            <UploadCloud className="h-5 w-5 shrink-0" />
            <span className="truncate">
              {files.length === 0 ? "Adjuntar archivos" : "Adjuntar otro archivo"}
            </span>
          </label>
          <input
            ref={inputRef}
            id={`archivo-${tipo}`}
            type="file"
            accept=".pdf,image/*"
            multiple
            className="hidden"
            disabled={enviando}
            onChange={(e) => elegirArchivos(Array.from(e.target.files ?? []))}
          />

          {files.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${f.size}-${i}`}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2"
                >
                  <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => quitarArchivo(i)}
                    disabled={enviando}
                    aria-label={`Quitar ${f.name}`}
                    className="shrink-0 rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {error ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-sm text-rose-800">{error}</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={enviar}
            disabled={files.length === 0 || enviando}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando…
              </>
            ) : files.length > 1 ? (
              `Enviar ${files.length} archivos`
            ) : (
              "Enviar"
            )}
          </button>
    </div>
  );
}
