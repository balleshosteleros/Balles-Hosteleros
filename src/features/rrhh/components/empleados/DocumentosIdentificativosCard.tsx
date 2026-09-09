"use client";

/**
 * Documentación identificativa del empleado (DNI/NIE anverso+reverso, certificado
 * bancario y Seguridad Social). Quien entra por el proceso de selección ya la trae:
 * la aportó como candidato y se copió a su ficha al contratarlo. En las altas
 * hechas a mano no hay nada, y por eso RRHH puede adjuntarla aquí.
 *
 * Se pintan SIEMPRE los cuatro recuadros, en el mismo orden y con el mismo
 * aspecto, tenga documento o no: así se ve de un vistazo qué falta sin tener que
 * leer etiqueta por etiqueta. El recuadro entero abre el documento original que
 * mandó el empleado — no solo el certificado bancario, cualquiera de los cuatro.
 *
 * Los archivos viven en el bucket privado `empleados-docs` y se abren en una
 * pestaña nueva a través de `/api/empleados/doc`, que firma una URL de corta
 * duración.
 */
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CreditCard, IdCard, Loader2, ShieldCheck, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  subirDocumentoEmpleado,
  type TipoDocumentoEmpleado,
} from "@/features/rrhh/actions/documentos-empleado-actions";

interface Props {
  empleadoId: string;
  docDniAnversoPath?: string | null;
  docDniReversoPath?: string | null;
  docIbanPath?: string | null;
  docSsPath?: string | null;
  /** RRHH puede adjuntar; el propio empleado, no. */
  editable?: boolean;
}

type ClaveDoc = "docDniAnversoPath" | "docDniReversoPath" | "docIbanPath" | "docSsPath";

/**
 * Orden fijo: primero la identidad, luego el banco y por último la Seguridad
 * Social. Los títulos son los mismos que ve el empleado en el correo cuando se
 * le pide el documento, para que no tenga que traducir de un sitio a otro.
 */
const DOCS: { tipo: TipoDocumentoEmpleado; prop: ClaveDoc; label: string; icono: LucideIcon }[] = [
  { tipo: "dni_anverso", prop: "docDniAnversoPath", label: "DNI o NIE (cara delantera)", icono: IdCard },
  { tipo: "dni_reverso", prop: "docDniReversoPath", label: "DNI o NIE (cara trasera)", icono: IdCard },
  { tipo: "iban", prop: "docIbanPath", label: "Certificado bancario", icono: CreditCard },
  { tipo: "ss", prop: "docSsPath", label: "Documento de la Seguridad Social", icono: ShieldCheck },
];

const ACEPTADOS = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

function hrefDoc(path: string): string {
  return `/api/empleados/doc?path=${encodeURIComponent(path)}`;
}

/** Extensión en mayúsculas (JPG, PDF…) para saber qué se va a abrir antes de pulsar. */
function formatoDe(path: string): string {
  const ext = path.split(".").pop();
  return ext ? ext.toUpperCase() : "Archivo";
}

export function DocumentosIdentificativosCard(props: Props) {
  const { empleadoId, editable = false } = props;
  const [pending, startTransition] = useTransition();
  const [subiendo, setSubiendo] = useState<TipoDocumentoEmpleado | null>(null);
  const inputs = useRef<Partial<Record<TipoDocumentoEmpleado, HTMLInputElement | null>>>({});

  const total = DOCS.length;
  const entregados = DOCS.filter((d) => Boolean(props[d.prop])).length;

  function elegir(tipo: TipoDocumentoEmpleado, file: File | undefined) {
    if (!file) return;
    setSubiendo(tipo);
    startTransition(async () => {
      const res = await subirDocumentoEmpleado({ empleadoId, tipo, file });
      setSubiendo(null);
      if (res.ok) toast.success("Documento adjuntado");
      else toast.error(res.error ?? "No se pudo adjuntar el documento");
      // Limpia el input para poder volver a elegir el mismo archivo.
      const el = inputs.current[tipo];
      if (el) el.value = "";
    });
  }

  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">Documentación identificativa</h3>
          <p className="text-[11px] text-muted-foreground">
            {editable
              ? "Pulsa un documento para abrir el original que envió el empleado."
              : "Pulsa un documento para abrir el original que envió el empleado. Solo lectura."}
          </p>
        </div>
        <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground">
          {entregados} de {total}
        </span>
      </header>

      <ul className="grid gap-2 sm:grid-cols-2">
        {DOCS.map((d) => {
          const path = props[d.prop];
          const cargando = subiendo === d.tipo && pending;
          const Icono = d.icono;

          return (
            <li
              key={d.tipo}
              className={`relative flex min-h-[76px] flex-col justify-between gap-2 rounded-lg border p-3 transition-colors ${
                path
                  ? "bg-background hover:border-primary/50 hover:bg-accent/40"
                  : "border-dashed bg-muted/30"
              }`}
            >
              <div className="flex items-start gap-2">
                <Icono
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    path ? "text-primary" : "text-muted-foreground/40"
                  }`}
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[13px] font-medium leading-snug text-foreground">{d.label}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {path ? `Ver documento · ${formatoDe(path)}` : "Sin adjuntar"}
                  </p>
                </div>
              </div>

              {/* Enlace que cubre el recuadro entero: pulsar en cualquier punto
                  abre el documento. Va por debajo del botón de adjuntar (z-10). */}
              {path && (
                <a
                  href={hrefDoc(path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${d.label}`}
                  className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              )}

              {editable && (
                <>
                  <input
                    ref={(el) => {
                      inputs.current[d.tipo] = el;
                    }}
                    type="file"
                    accept={ACEPTADOS}
                    className="hidden"
                    onChange={(e) => elegir(d.tipo, e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => inputs.current[d.tipo]?.click()}
                    className="relative z-10 self-start inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline disabled:opacity-50"
                  >
                    {cargando ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    {path ? "Reemplazar" : "Adjuntar"}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
