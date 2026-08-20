"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  listDocumentos, crearUrlsSubidaDocumentos, guardarDocumentos,
  getUrlDocumento, borrarDocumento,
  type DocumentoVencimiento,
} from "@/features/gerencia/actions/vencimientos-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

const BUCKET = "vencimientos-docs";

/**
 * Tope por archivo: 500 MB. Es el máximo que ya usa el proyecto y el bucket
 * aplica el mismo límite del lado del servidor. No puede vivir en el fichero de
 * acciones porque "use server" solo permite exportar funciones asíncronas.
 */
const MAX_TAMANO_DOCUMENTO = 524_288_000;

function formatearTamano(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Documentos oficiales del vencimiento: el acta del extintor, la licencia, la
 * póliza... Admite varios y son pesados, así que el navegador los sube DIRECTO
 * al bucket con URL firmada, sin pasar por la Server Action.
 */
export function DocumentosVencimiento({ vencimientoId }: { vencimientoId: string }) {
  const [docs, setDocs] = useState<DocumentoVencimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialog } = useConfirmDelete();

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await listDocumentos(vencimientoId);
    setDocs(res.ok ? res.data : []);
    setCargando(false);
  }, [vencimientoId]);

  useEffect(() => { cargar(); }, [cargar]);

  async function subir(files: FileList | null) {
    if (!files?.length) return;
    const lista = Array.from(files);

    const grande = lista.find((f) => f.size > MAX_TAMANO_DOCUMENTO);
    if (grande) {
      toast.error(`«${grande.name}» supera el máximo de 500 MB`);
      return;
    }

    setSubiendo(true);
    try {
      const urls = await crearUrlsSubidaDocumentos(
        vencimientoId,
        lista.map((f) => ({ name: f.name })),
      );
      if (!urls.ok || !urls.data) {
        toast.error(urls.error ?? "No se pudo preparar la subida");
        return;
      }

      const supabase = createClient();
      const subidos: Array<{ path: string; nombre: string; tamano: number; mime: string | null }> = [];

      for (const [i, file] of lista.entries()) {
        setProgreso(`Subiendo ${i + 1} de ${lista.length}…`);
        const { token, path } = urls.data[i];
        const { error } = await supabase.storage
          .from(BUCKET)
          .uploadToSignedUrl(path, token, file);
        if (error) {
          toast.error(`No se pudo subir «${file.name}»`);
          continue;
        }
        subidos.push({
          path,
          nombre: file.name,
          tamano: file.size,
          mime: file.type || null,
        });
      }

      if (subidos.length === 0) return;

      const res = await guardarDocumentos(vencimientoId, subidos);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudieron registrar los documentos");
        return;
      }
      toast.success(
        subidos.length === 1 ? "Documento adjuntado" : `${subidos.length} documentos adjuntados`,
      );
      await cargar();
    } finally {
      setSubiendo(false);
      setProgreso(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function abrir(doc: DocumentoVencimiento) {
    const res = await getUrlDocumento(doc.id);
    if (!res.ok || !res.url) {
      toast.error(res.error ?? "No se pudo abrir");
      return;
    }
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function eliminar(doc: DocumentoVencimiento) {
    const ok = await confirm({
      title: "¿Eliminar este documento?",
      description: `Se borrará «${doc.nombre}». Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const res = await borrarDocumento(doc.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo eliminar");
      return;
    }
    toast.success("Documento eliminado");
    await cargar();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="text-sm">
          <p className="font-medium">Documentación oficial</p>
          <p className="text-xs text-muted-foreground">
            Actas, certificados, licencias o pólizas. Puedes adjuntar varios; hasta 500 MB cada uno.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
        >
          {subiendo ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {progreso ?? "Subiendo…"}</>
          ) : (
            <><Upload className="h-4 w-4" /> Adjuntar</>
          )}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => subir(e.target.files)}
        />
      </div>

      {cargando && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {!cargando && docs.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Todavía no hay ningún documento adjunto.
        </p>
      )}

      {!cargando && docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {formatearTamano(d.tamano)}
                  {d.tamano ? " · " : ""}
                  {format(parseISO(d.created_at), "d MMM yyyy", { locale: es })}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => abrir(d)} aria-label="Abrir documento">
                <Download className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => eliminar(d)} aria-label="Eliminar documento">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {dialog}
    </div>
  );
}
