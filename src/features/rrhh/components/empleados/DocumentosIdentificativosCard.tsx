"use client";

/**
 * Documentos identificativos del empleado (DNI/NIE anverso+reverso, IBAN y
 * Seguridad Social) que aportó como candidato y se copiaron a su ficha al
 * contratar (bucket privado `empleados-docs`). Cada documento se abre en una
 * pestaña nueva a través del endpoint `/api/empleados/doc`, que resuelve una URL
 * firmada de corta duración. Si el empleado no tiene documentos (altas antiguas
 * o creadas a mano), se indica sin ruido.
 */
import { FileText, Download, FolderOpen } from "lucide-react";

interface Props {
  docDniAnversoPath?: string | null;
  docDniReversoPath?: string | null;
  docIbanPath?: string | null;
  docSsPath?: string | null;
}

const DOCS: { key: keyof Props; label: string }[] = [
  { key: "docDniAnversoPath", label: "DNI/NIE — anverso" },
  { key: "docDniReversoPath", label: "DNI/NIE — reverso" },
  { key: "docIbanPath", label: "Número de cuenta (IBAN)" },
  { key: "docSsPath", label: "Seguridad Social" },
];

function hrefDoc(path: string): string {
  return `/api/empleados/doc?path=${encodeURIComponent(path)}`;
}

export function DocumentosIdentificativosCard(props: Props) {
  const items = DOCS.map((d) => ({ ...d, path: props[d.key] as string | null | undefined }))
    .filter((d) => !!d.path);

  return (
    <section className="rounded-lg border bg-card p-4 md:p-5 space-y-3">
      <header className="space-y-0.5">
        <h3 className="text-base font-semibold text-foreground">Documentación identificativa</h3>
        <p className="text-sm text-muted-foreground">
          Documentos aportados por el empleado en su incorporación. Solo lectura.
        </p>
      </header>

      {items.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border">
          {items.map((d) => (
            <li key={d.key} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm text-foreground">{d.label}</span>
              <a
                href={hrefDoc(d.path as string)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Ver
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No hay documentación identificativa guardada para este empleado.
          </p>
        </div>
      )}
    </section>
  );
}
