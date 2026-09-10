"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Inbox,
  Link as LinkIcon,
  Check,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
} from "lucide-react";
import {
  listarComunicadosVisibles,
  type ComunicadoVisible,
} from "@/features/mi-panel/actions/mi-panel-actions";
import { marcarComunicadosVistos } from "@/features/mi-panel/actions/comunicados-vistos-actions";
import { formatFechaHoraEnZona, claveDiaEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  TIPO_COMUNICADO_LABEL,
  TIPO_COMUNICADO_COLOR,
  TIPO_COMUNICADO_BORDE,
  TIPO_COMUNICADO_FONDO,
  tipoComunicado,
} from "@/features/rrhh/data/comunicados";
import {
  tamanoLegible,
  urlAdjuntoComunicado,
  type ComunicadoAdjunto,
} from "@/features/gerencia/data/comunicados-adjuntos";

/**
 * Los comunicados del trabajador.
 *
 * Van todos PLEGADOS, uno debajo de otro, y solo se abre el que se pulsa: así se
 * ve de un vistazo lo que hay sin bajar media pantalla por cada uno. Cada
 * comunicado lleva su recuadro del color de su tipo, y mientras no se ha abierto
 * lleva la etiqueta «Nuevo» en verde; al abrirlo por primera vez queda visto
 * (Iván, 10-09-2026).
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
 */
function FichaDocumento({
  a,
  titulo,
  numero,
}: {
  a: ComunicadoAdjunto;
  titulo: string;
  numero: number | null;
}) {
  const { Icono, color, fondo } = pintaDocumento(a.name);
  return (
    <a
      href={urlAdjuntoComunicado(a.path)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center gap-1.5 rounded-xl border bg-card p-2.5 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${fondo}`}>
        <Icono className={`h-[18px] w-[18px] ${color}`} strokeWidth={1.75} />
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-tight">
        {titulo}
        {numero !== null ? ` ${numero}` : ""}
      </span>
      {a.size > 0 && (
        <span className="text-[10px] text-muted-foreground">{tamanoLegible(a.size)}</span>
      )}
    </a>
  );
}

/** En qué montón va cada comunicado: hoy, esta semana o antiguos. */
function grupoDe(iso: string, tz: string): "hoy" | "semana" | "antes" {
  const hoy = claveDiaEnZona(new Date().toISOString(), tz);
  const dia = claveDiaEnZona(iso, tz);
  if (dia === hoy) return "hoy";
  const diff = Date.now() - new Date(iso).getTime();
  return diff < 7 * 86_400_000 ? "semana" : "antes";
}

const GRUPO_LABEL: Record<string, string> = {
  hoy: "Hoy",
  semana: "Esta semana",
  antes: "Anteriores",
};

function TarjetaComunicado({
  c,
  abierto,
  onAbrir,
}: {
  c: ComunicadoVisible;
  abierto: boolean;
  onAbrir: () => void;
}) {
  const tipo = tipoComunicado(c.tipo);
  const nuevo = !c.vistoEl;
  return (
    <article
      className={`overflow-hidden rounded-2xl border-2 bg-card shadow-sm transition-shadow ${TIPO_COMUNICADO_BORDE[tipo]} ${
        abierto ? "shadow-md" : "hover:shadow-md"
      }`}
    >
      <button
        type="button"
        onClick={onAbrir}
        aria-expanded={abierto}
        className={`flex w-full items-center gap-3 p-4 text-left ${TIPO_COMUNICADO_FONDO[tipo]}`}
      >
        {c.isotipoUrl ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-border/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.isotipoUrl} alt="" className="h-6 w-6 object-contain" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-tight">{c.titulo}</h3>
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
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatFechaHoraEnZona(c.createdAt, c.zonaHoraria, { month: "long" })}
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
            abierto ? "rotate-180" : ""
          }`}
        />
      </button>

      {abierto && (
        <div className="border-t">
          {c.contenido && (
            <p className="whitespace-pre-line px-5 pt-5 text-[15px] leading-relaxed text-foreground/90">
              {c.contenido}
            </p>
          )}

          {c.enlace && (
            <div className="px-5 pt-4">
              <a
                href={c.enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <LinkIcon className="h-4 w-4" />
                {(c.enlaceTexto ?? "").trim() || "Abrir enlace"}
              </a>
            </div>
          )}

          {c.adjuntos.length > 0 && (
            <div className="px-5 pt-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {c.adjuntos.length === 1 ? "Documento adjunto" : "Documentos adjuntos"}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {c.adjuntos.map((a, i) => (
                  <FichaDocumento
                    key={a.path}
                    a={a}
                    titulo={c.titulo}
                    numero={c.adjuntos.length > 1 ? i + 1 : null}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 border-t bg-muted/20 px-5 py-2.5">
            {c.vistoEl ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Visto el {formatFechaHoraEnZona(c.vistoEl, c.zonaHoraria, { month: "long" })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Sin leer</p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export function MisComunicadosView() {
  const [items, setItems] = useState<ComunicadoVisible[]>([]);
  const [loading, setLoading] = useState(true);
  /** Solo hay uno abierto a la vez: el que se acaba de pulsar. */
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    listarComunicadosVisibles().then((res) => {
      if (cancel) return;
      setItems(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, []);

  /**
   * Abrir un comunicado es leerlo: de ahí sale el «visto» del trabajador y el
   * alcance que ve quien lo publicó. Se apunta la primera vez y ya no cambia.
   */
  const abrir = (c: ComunicadoVisible) => {
    if (abierto === c.id) {
      setAbierto(null);
      return;
    }
    setAbierto(c.id);
    if (!c.vistoEl) {
      const ahora = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, vistoEl: ahora } : x)));
      void marcarComunicadosVistos([c.id]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center text-muted-foreground">
          <Inbox className="mb-3 h-8 w-8" />
          <p className="text-sm font-medium">Sin comunicados</p>
          <p className="mt-1 text-xs">No hay anuncios publicados por el momento.</p>
        </div>
      </div>
    );
  }

  const tz = items[0]?.zonaHoraria ?? "Europe/Madrid";
  const grupos: { clave: string; lista: ComunicadoVisible[] }[] = [];
  for (const c of items) {
    const g = grupoDe(c.createdAt, tz);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.clave === g) ultimo.lista.push(c);
    else grupos.push({ clave: g, lista: [c] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7 p-4 md:p-6">
      {grupos.map((g, i) => (
        <section key={`${g.clave}-${i}`} className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {GRUPO_LABEL[g.clave]}
            </h2>
            <span className="h-px flex-1 bg-border" />
          </div>
          {g.lista.map((c) => (
            <TarjetaComunicado
              key={c.id}
              c={c}
              abierto={abierto === c.id}
              onAbrir={() => abrir(c)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
