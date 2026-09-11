"use client";

import type { ReactNode } from "react";
import {
  Link as LinkIcon,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
} from "lucide-react";
import {
  TIPO_COMUNICADO_LABEL,
  TIPO_COMUNICADO_COLOR,
  TIPO_COMUNICADO_BORDE,
  TIPO_COMUNICADO_FONDO,
  type TipoComunicado,
} from "@/features/rrhh/data/comunicados";
import { TextoConEnlaces } from "@/shared/components/TextoConEnlaces";
import {
  tamanoLegible,
  urlAdjuntoComunicado,
  type ComunicadoAdjunto,
} from "@/features/gerencia/data/comunicados-adjuntos";

/**
 * EL COMUNICADO TAL Y COMO LO RECIBE EL TRABAJADOR.
 *
 * Una sola pieza para las dos pantallas: la del trabajador (Mi panel) y la
 * previsualización de quien lo escribe. Antes eran dos maquetas distintas y
 * quien publicaba no veía lo que iba a llegar de verdad (Iván, 11-09-2026).
 *
 * Va PLEGADO: se abre el que se pulsa. En la previsualización no hay nada que
 * plegar, así que sin `onAbrir` la cabecera no se pulsa y sale ya abierto.
 */

/** Icono y color del documento según su extensión. */
function pintaDocumento(nombre: string) {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { Icono: FileText, color: "text-rose-600", fondo: "bg-rose-50 dark:bg-rose-950/30" };
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext))
    return { Icono: ImageIcon, color: "text-violet-600", fondo: "bg-violet-50 dark:bg-violet-950/30" };
  if (["xls", "xlsx", "csv", "numbers"].includes(ext))
    return { Icono: FileSpreadsheet, color: "text-emerald-600", fondo: "bg-emerald-50 dark:bg-emerald-950/30" };
  if (["doc", "docx", "txt", "rtf", "pages"].includes(ext))
    return { Icono: FileText, color: "text-blue-600", fondo: "bg-blue-50 dark:bg-blue-950/30" };
  return { Icono: File, color: "text-slate-500", fondo: "bg-muted" };
}

/**
 * Documento como ficha, no como fila de hoja de cálculo. Se llama como el
 * comunicado —los nombres de archivo quedan feos— y se numera si hay varios.
 *
 * `href` en blanco = documento recién elegido que aún no está subido: se ve
 * igual, pero no se puede abrir todavía.
 */
function FichaDocumento({
  nombre,
  size,
  href,
  titulo,
  numero,
}: {
  nombre: string;
  size: number;
  href: string;
  titulo: string;
  numero: number | null;
}) {
  const { Icono, color, fondo } = pintaDocumento(nombre);
  const contenido = (
    <>
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${fondo}`}>
        <Icono className={`h-[18px] w-[18px] ${color}`} strokeWidth={1.75} />
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-tight">
        {titulo}
        {numero !== null ? ` ${numero}` : ""}
      </span>
      {size > 0 && <span className="text-[10px] text-muted-foreground">{tamanoLegible(size)}</span>}
    </>
  );
  const clases =
    "group flex flex-col items-center gap-1.5 rounded-xl border bg-card p-2.5 text-center transition-all";

  if (!href) return <span className={clases}>{contenido}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${clases} hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md`}
    >
      {contenido}
    </a>
  );
}

export interface ComunicadoTarjetaDatos {
  titulo: string;
  tipo: TipoComunicado;
  contenido: string;
  enlace?: string | null;
  enlaceTexto?: string | null;
  /** Documentos ya subidos al almacén. */
  adjuntos: ComunicadoAdjunto[];
  /** Documentos recién elegidos, aún sin subir (solo previsualización). */
  adjuntosPendientes?: { name: string; size: number }[];
  empresaNombre?: string | null;
  isotipoUrl?: string | null;
  /** Lo que se lee bajo el título: la empresa y la fecha. */
  fechaTexto?: string | null;
  /** Etiqueta «Nuevo» en verde: no lo ha abierto todavía. */
  nuevo?: boolean;
}

export function ComunicadoTarjeta({
  datos,
  abierto = true,
  onAbrir,
  pie,
}: {
  datos: ComunicadoTarjetaDatos;
  abierto?: boolean;
  /** Sin esto la cabecera no se pulsa: sale abierto y fijo. */
  onAbrir?: () => void;
  /** Pie del comunicado (el «Visto el…» del trabajador). */
  pie?: ReactNode;
}) {
  const {
    titulo, tipo, contenido, enlace, enlaceTexto, adjuntos,
    adjuntosPendientes = [], empresaNombre, isotipoUrl, fechaTexto, nuevo,
  } = datos;

  const documentos = [
    ...adjuntos.map((a) => ({ nombre: a.name, size: a.size, href: urlAdjuntoComunicado(a.path) })),
    ...adjuntosPendientes.map((a) => ({ nombre: a.name, size: a.size, href: "" })),
  ];

  const cabecera = (
    <>
      {isotipoUrl ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={isotipoUrl} alt="" className="h-6 w-6 object-contain" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold leading-tight">{titulo || "Sin título"}</h3>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TIPO_COMUNICADO_COLOR[tipo]}`}
          >
            {TIPO_COMUNICADO_LABEL[tipo]}
          </span>
          {nuevo && (
            <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              Nuevo
            </span>
          )}
        </div>
        {(empresaNombre || fechaTexto) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[empresaNombre, fechaTexto].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      {onAbrir && (
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      )}
    </>
  );

  return (
    <article
      className={`overflow-hidden rounded-2xl border-2 bg-card shadow-sm transition-shadow ${TIPO_COMUNICADO_BORDE[tipo]} ${
        abierto ? "shadow-md" : "hover:shadow-md"
      }`}
    >
      {onAbrir ? (
        <button
          type="button"
          onClick={onAbrir}
          aria-expanded={abierto}
          className={`flex w-full items-center gap-3 p-4 text-left ${TIPO_COMUNICADO_FONDO[tipo]}`}
        >
          {cabecera}
        </button>
      ) : (
        <div className={`flex w-full items-center gap-3 p-4 ${TIPO_COMUNICADO_FONDO[tipo]}`}>
          {cabecera}
        </div>
      )}

      {abierto && (
        <div className="border-t">
          {contenido && (
            <p className="whitespace-pre-line px-5 pt-5 text-[15px] leading-relaxed text-foreground/90">
              <TextoConEnlaces texto={contenido} />
            </p>
          )}

          {enlace && (
            <div className="px-5 pt-4">
              <a
                href={enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <LinkIcon className="h-4 w-4" />
                {(enlaceTexto ?? "").trim() || "Abrir enlace"}
              </a>
            </div>
          )}

          {documentos.length > 0 && (
            <div className="px-5 pt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {documentos.length === 1 ? "Documento adjunto" : "Documentos adjuntos"}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {documentos.map((d, i) => (
                  <FichaDocumento
                    key={`${d.nombre}-${i}`}
                    nombre={d.nombre}
                    size={d.size}
                    href={d.href}
                    titulo={titulo || "Documento"}
                    numero={documentos.length > 1 ? i + 1 : null}
                  />
                ))}
              </div>
            </div>
          )}

          {pie ? <div className="mt-5 border-t bg-muted/20 px-5 py-2.5">{pie}</div> : <div className="pb-5" />}
        </div>
      )}
    </article>
  );
}
