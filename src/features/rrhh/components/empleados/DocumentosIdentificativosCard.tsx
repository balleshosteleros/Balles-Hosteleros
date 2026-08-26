"use client";

/**
 * Documentación identificativa del empleado (DNI/NIE anverso+reverso, IBAN y
 * Seguridad Social). Quien entra por el proceso de selección ya la trae: la
 * aportó como candidato y se copió a su ficha al contratarlo. En las altas
 * hechas a mano no hay nada, y por eso RRHH puede adjuntarla aquí.
 *
 * Los archivos viven en el bucket privado `empleados-docs` y se abren en una
 * pestaña nueva a través de `/api/empleados/doc`, que firma una URL de corta
 * duración.
 */
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Download, Upload, Loader2 } from "lucide-react";
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

const DOCS: { tipo: TipoDocumentoEmpleado; prop: keyof Props; label: string }[] = [
  { tipo: "dni_anverso", prop: "docDniAnversoPath", label: "DNI/NIE — anverso" },
  { tipo: "dni_reverso", prop: "docDniReversoPath", label: "DNI/NIE — reverso" },
  { tipo: "iban", prop: "docIbanPath", label: "Número de cuenta (IBAN)" },
  { tipo: "ss", prop: "docSsPath", label: "Seguridad Social" },
];

const ACEPTADOS = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

function hrefDoc(path: string): string {
  return `/api/empleados/doc?path=${encodeURIComponent(path)}`;
}

export function DocumentosIdentificativosCard(props: Props) {
  const { empleadoId, editable = false } = props;
  const [pending, startTransition] = useTransition();
  const [subiendo, setSubiendo] = useState<TipoDocumentoEmpleado | null>(null);
  const inputs = useRef<Partial<Record<TipoDocumentoEmpleado, HTMLInputElement | null>>>({});

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
    <section className="rounded-xl border bg-card p-4 space-y-2.5">
      <header className="space-y-0.5">
        <h3 className="text-sm font-semibold text-foreground">Documentación identificativa</h3>
        <p className="text-[11px] text-muted-foreground">
          {editable
            ? "Aportada por el empleado en su incorporación. Puedes adjuntar la que falte."
            : "Aportada por el empleado en su incorporación. Solo lectura."}
        </p>
      </header>

      <ul className="divide-y divide-border rounded-md border">
        {DOCS.map((d) => {
          const path = props[d.prop] as string | null | undefined;
          const cargando = subiendo === d.tipo && pending;
          return (
            <li key={d.tipo} className="flex items-center gap-3 px-3 py-2">
              <FileText
                className={`h-4 w-4 shrink-0 ${path ? "text-muted-foreground" : "text-muted-foreground/40"}`}
              />
              <span className="flex-1 text-sm text-foreground">
                {d.label}
                {!path && (
                  <span className="ml-2 text-[11px] text-muted-foreground">Sin adjuntar</span>
                )}
              </span>

              {path && (
                <a
                  href={hrefDoc(path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Ver
                </a>
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
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    {cargando ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
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
