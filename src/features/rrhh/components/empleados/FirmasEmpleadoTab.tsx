"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSignature, Download, Eye, Loader2, ShieldCheck, Stethoscope } from "lucide-react";
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
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";

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
  decisionReconocimiento: "si" | "no" | null;
};

export function FirmasEmpleadoTab({ empleadoId }: { empleadoId: string }) {
  const { empresaActual } = useEmpresa();
  const fmt = (s: string | null): string => {
    if (!s) return "—";
    return formatFechaHoraEnZona(s, empresaActual.zonaHoraria) || s;
  };
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
        decisionReconocimiento: d.decisionReconocimiento,
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

  // Reconocimiento médico: es voluntario, así que RRHH necesita ver de un vistazo
  // qué contestó el trabajador y poder abrir el documento que lo acredita.
  const reconocimiento = items.find(
    (d) => d.tipo === "reconocimiento_medico" && d.decisionReconocimiento !== null,
  );
  const reconocimientoPendiente = items.find(
    (d) => d.tipo === "reconocimiento_medico" && d.estado === "pendiente",
  );

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

      {!loading && (reconocimiento || reconocimientoPendiente) && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Reconocimiento médico</span>
              {reconocimiento ? (
                <Badge
                  variant="outline"
                  className={
                    reconocimiento.decisionReconocimiento === "si"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600"
                  }
                >
                  {reconocimiento.decisionReconocimiento === "si"
                    ? "Sí quiere pasarlo"
                    : "No quiere pasarlo"}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                  Pendiente de firma
                </Badge>
              )}
            </div>
            {reconocimiento && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => descargar(reconocimiento.id)}
                disabled={descargando === reconocimiento.id}
              >
                {descargando === reconocimiento.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Ver documento firmado
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {reconocimiento
              ? reconocimiento.decisionReconocimiento === "si"
                ? "Contestó que sí lo desea. Firmado el " + fmt(reconocimiento.firmadoEn) + "."
                : "Contestó que no lo desea. Firmado el " + fmt(reconocimiento.firmadoEn) + "."
              : "Enviado para firma. El trabajador aún no ha contestado."}
          </p>
        </div>
      )}

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
                    {d.decisionReconocimiento && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Contestó:{" "}
                        <strong>
                          {d.decisionReconocimiento === "si"
                            ? "sí quiere pasarlo"
                            : "no quiere pasarlo"}
                        </strong>
                      </div>
                    )}
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
