"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSignature, Download, Eye, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  listFirmasPorEmpleado,
  getDescargaFirmadoUrl,
} from "@/features/rrhh/actions/firmas-actions";
import {
  TIPO_LABEL,
  MODALIDAD_LABEL,
  VALIDEZ_LABEL,
  ESTADO_LABEL,
  ESTADO_COLOR,
  type TipoDocumento,
  type ModalidadFirma,
  type ValidezLegal,
  type EstadoFirma,
} from "@/features/rrhh/data/firmas";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

type Firma = {
  id: string;
  titulo: string;
  tipo: TipoDocumento;
  modalidad: ModalidadFirma;
  validez: ValidezLegal;
  estado: EstadoFirma;
  enviadoPor: string;
  enviadoEn: string;
  firmadoEn: string | null;
  sha256Acta: string | null;
};

function fmt(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
}

export function FirmasEmpleadoTab({ empleadoId }: { empleadoId: string }) {
  const [items, setItems] = useState<Firma[]>([]);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState<string | null>(null);
  useGlobalLoadingSync(loading || descargando !== null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listFirmasPorEmpleado(empleadoId);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setItems(
      res.data.map((d) => ({
        id: d.id,
        titulo: d.titulo,
        tipo: d.tipo as TipoDocumento,
        modalidad: d.modalidad,
        validez: d.validez as ValidezLegal,
        estado: d.estado as EstadoFirma,
        enviadoPor: d.enviadoPor,
        enviadoEn: d.enviadoEn,
        firmadoEn: d.firmadoEn,
        sha256Acta: d.sha256Acta,
      })),
    );
  }, [empleadoId]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function descargar(id: string) {
    setDescargando(id);
    const res = await getDescargaFirmadoUrl(id);
    setDescargando(null);
    if (!res.ok) return toast.error(res.error);
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  const stats = {
    total: items.length,
    firmados: items.filter((d) => d.estado === "firmado").length,
    pendientes: items.filter((d) => d.estado === "pendiente").length,
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Documentos firmados
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats.total} en total · {stats.firmados} firmados · {stats.pendientes} pendientes
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/rrhh/firmas">Ir al módulo de Firmas</a>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileSignature className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Este empleado todavía no tiene documentos enviados para firma.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Modalidad</TableHead>
                <TableHead>Validez</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead>Firmado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium max-w-[260px]">
                    <div className="line-clamp-1">{d.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      Enviado por {d.enviadoPor}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{TIPO_LABEL[d.tipo]}</TableCell>
                  <TableCell className="text-sm">{MODALIDAD_LABEL[d.modalidad]}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {VALIDEZ_LABEL[d.validez]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmt(d.enviadoEn)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmt(d.firmadoEn)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ESTADO_COLOR[d.estado]}>
                      {ESTADO_LABEL[d.estado]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        title="Ver en módulo Firmas"
                      >
                        <a href={`/rrhh/firmas?ver=${d.id}`}>
                          <Eye className="h-4 w-4" />
                        </a>
                      </Button>
                      {d.estado === "firmado" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => descargar(d.id)}
                          disabled={descargando === d.id}
                          title="Descargar PDF firmado"
                        >
                          {descargando === d.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
