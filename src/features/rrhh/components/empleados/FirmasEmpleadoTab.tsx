"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FileSignature, Download, Eye, Loader2, ShieldCheck, ShieldAlert,
  CheckCircle2, Clock, XCircle, FileX2, Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import {
  listFirmasPorEmpleado,
  getDescargaFirmadoUrl,
  getVisorFirmadoUrl,
  getAuditTrail,
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
import { cn } from "@/shared/lib/utils";

type Firma = {
  id: string;
  titulo: string;
  tipo: TipoDocumento;
  modalidad: ModalidadFirma;
  validez: ValidezLegal;
  estado: EstadoFirma;
  enviadoPor: string;
  enviadoEn: string;
  expiraEn: string | null;
  firmadoEn: string | null;
  leidoEn: string | null;
  ipFirma: string | null;
  sha256Original: string | null;
  sha256Acta: string | null;
  decisionReconocimiento: "si" | "no" | null;
};

type EventoUI = {
  id: string;
  tipo: string;
  ocurridoEn: string;
  ip: string | null;
  userAgent: string | null;
  hash: string;
};

/**
 * Documentos de firma OBLIGATORIOS del ciclo laboral. Se pintan siempre como
 * recuadro, aunque el empleado todavía no tenga ninguno: un hueco apagado dice
 * "esto falta por firmar", que es justo lo que RRHH necesita ver de un vistazo.
 * El orden es el del ciclo real: alta → durante → salida.
 */
const DOCUMENTOS_OBLIGATORIOS: { tipo: TipoDocumento; etiqueta: string }[] = [
  { tipo: "contrato_interno",      etiqueta: "Contrato interno"      },
  { tipo: "contrato_oficial",      etiqueta: "Contrato laboral"      },
  { tipo: "reconocimiento_medico", etiqueta: "Reconocimiento médico" },
  { tipo: "nda",                   etiqueta: "Confidencialidad"      },
  { tipo: "cesion_imagen",         etiqueta: "Cesión de imagen"      },
  { tipo: "sancion_disciplinaria", etiqueta: "Sanción disciplinaria" },
  { tipo: "baja_voluntaria",       etiqueta: "Preaviso / baja voluntaria" },
  { tipo: "baja_empresa",          etiqueta: "Baja de contrato"      },
  { tipo: "finiquito",             etiqueta: "Finiquito"             },
];

const TIPOS_OBLIGATORIOS = new Set<TipoDocumento>(
  DOCUMENTOS_OBLIGATORIOS.map((d) => d.tipo),
);

const IPS_LOCALES = new Set(["::1", "127.0.0.1", "localhost"]);

function displayIp(value: string | null | undefined): string {
  if (!value) return "—";
  return IPS_LOCALES.has(value.trim()) ? "—" : value;
}

function deduplicarEventos(eventos: EventoUI[]): { evento: EventoUI; count: number }[] {
  const out: { evento: EventoUI; count: number }[] = [];
  for (const e of eventos) {
    const last = out[out.length - 1];
    if (last && last.evento.tipo === e.tipo) {
      last.count += 1;
      last.evento = e; // mantener fecha del más reciente
    } else {
      out.push({ evento: e, count: 1 });
    }
  }
  return out;
}

export function FirmasEmpleadoTab({ empleadoId }: { empleadoId: string }) {
  const { empresaActual } = useEmpresa();
  const fmt = useCallback(
    (s: string | null): string => {
      if (!s) return "—";
      return formatFechaHoraEnZona(s, empresaActual.zonaHoraria) || s;
    },
    [empresaActual.zonaHoraria],
  );

  const [items, setItems] = useState<Firma[]>([]);
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState<string | null>(null);

  // Panel de acreditación: documento abierto, su PDF incrustado y su acta.
  const [verDoc, setVerDoc] = useState<Firma | null>(null);
  const [visorUrl, setVisorUrl] = useState<string | null>(null);
  const [auditoria, setAuditoria] = useState<EventoUI[] | null>(null);
  const [auditoriaOk, setAuditoriaOk] = useState<boolean | null>(null);

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
        expiraEn: d.expiraEn,
        firmadoEn: d.firmadoEn,
        leidoEn: d.leidoEn,
        ipFirma: d.ipFirma,
        sha256Original: d.sha256Original,
        sha256Acta: d.sha256Acta,
        decisionReconocimiento: d.decisionReconocimiento,
      })),
    );
  }, [empleadoId]);

  useEffect(() => { void cargar(); }, [cargar]);

  /**
   * Para cada documento obligatorio, el ejemplar que vale es el más relevante:
   * el firmado más reciente si existe; si no, el último movimiento habido.
   * `listFirmasPorEmpleado` ya devuelve ordenado por envío descendente.
   */
  const recuadros = useMemo(() => {
    return DOCUMENTOS_OBLIGATORIOS.map((def) => {
      const delTipo = items.filter((d) => d.tipo === def.tipo);
      const doc =
        delTipo.find((d) => d.estado === "firmado") ?? delTipo[0] ?? null;
      return { ...def, doc, total: delTipo.length };
    });
  }, [items]);

  // Documentos que no son de los obligatorios: van abajo, en la tabla.
  const otros = useMemo(
    () => items.filter((d) => !TIPOS_OBLIGATORIOS.has(d.tipo)),
    [items],
  );

  const stats = {
    total: items.length,
    firmados: items.filter((d) => d.estado === "firmado").length,
    pendientes: items.filter((d) => d.estado === "pendiente").length,
  };

  async function descargar(id: string) {
    setDescargando(id);
    const res = await getDescargaFirmadoUrl(id);
    setDescargando(null);
    if (!res.ok) return toast.error(res.error);
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function abrirDetalle(doc: Firma) {
    setVerDoc(doc);
    setVisorUrl(null);
    setAuditoria(null);
    setAuditoriaOk(null);

    // El PDF solo existe si está firmado; el acta se pide siempre porque
    // acredita también los envíos, aperturas y rechazos.
    const [visor, audit] = await Promise.all([
      doc.estado === "firmado" ? getVisorFirmadoUrl(doc.id) : Promise.resolve(null),
      getAuditTrail(doc.id),
    ]);

    if (visor) {
      if (visor.ok) setVisorUrl(visor.url);
      else toast.error(visor.error);
    }
    if (audit.ok) {
      setAuditoria(
        audit.eventos.map((e) => ({
          id: e.id,
          tipo: e.tipo,
          ocurridoEn: e.ocurridoEn,
          ip: e.ip,
          userAgent: e.userAgent,
          hash: e.hash,
        })),
      );
      setAuditoriaOk(audit.verificacion.ok);
    } else {
      setAuditoria([]);
      toast.error(audit.error);
    }
  }

  return (
    <div className="p-6 space-y-6">
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
      ) : (
        <>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {recuadros.map((r) => (
              <RecuadroDocumento
                key={r.tipo}
                etiqueta={r.etiqueta}
                doc={r.doc}
                total={r.total}
                fmt={fmt}
                onAbrir={abrirDetalle}
              />
            ))}
          </div>

          {otros.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Otros documentos</h4>
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
                    {otros.map((d) => (
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
                              onClick={() => abrirDetalle(d)}
                              title="Ver documento y acreditación"
                            >
                              <Eye className="h-4 w-4" />
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
            </div>
          )}
        </>
      )}

      <Dialog
        open={!!verDoc}
        onOpenChange={(v) => {
          if (!v) {
            setVerDoc(null);
            setVisorUrl(null);
            setAuditoria(null);
            setAuditoriaOk(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{verDoc?.titulo}</DialogTitle>
            <DialogDescription>
              Documento oficial firmado y acreditación legal de la firma.
            </DialogDescription>
          </DialogHeader>

          {verDoc && (
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="rounded-md border bg-muted/30 overflow-hidden min-h-[420px] flex items-center justify-center">
                {verDoc.estado !== "firmado" ? (
                  <div className="text-center text-sm text-muted-foreground p-6">
                    <FileX2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                    Este documento todavía no está firmado, así que no hay copia
                    oficial que mostrar.
                  </div>
                ) : visorUrl === null ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Cargando documento…
                  </div>
                ) : (
                  <iframe
                    src={visorUrl}
                    title={verDoc.titulo}
                    className="w-full h-[520px]"
                  />
                )}
              </div>

              <div className="space-y-4 text-sm max-h-[520px] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-2">
                  <Info label="Tipo" value={TIPO_LABEL[verDoc.tipo]} />
                  <Info
                    label="Estado"
                    value={
                      <Badge variant="outline" className={ESTADO_COLOR[verDoc.estado]}>
                        {ESTADO_LABEL[verDoc.estado]}
                      </Badge>
                    }
                  />
                  <Info label="Modalidad de firma" value={MODALIDAD_LABEL[verDoc.modalidad]} />
                  <Info label="Validez legal" value={VALIDEZ_LABEL[verDoc.validez]} />
                  <Info label="Enviado por" value={verDoc.enviadoPor} />
                  <Info label="Enviado el" value={fmt(verDoc.enviadoEn)} />
                  <Info label="Abierto el" value={fmt(verDoc.leidoEn)} />
                  <Info label="Firmado el" value={fmt(verDoc.firmadoEn)} />
                  <Info label="IP de firma" value={displayIp(verDoc.ipFirma)} />
                  <Info label="Expiraba" value={fmt(verDoc.expiraEn)} />
                  {verDoc.decisionReconocimiento && (
                    <Info
                      label="Contestó"
                      value={
                        verDoc.decisionReconocimiento === "si"
                          ? "Sí quiere pasarlo"
                          : "No quiere pasarlo"
                      }
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <Info
                    label="Huella del documento (SHA-256)"
                    value={
                      <span className="font-mono text-[11px] break-all">
                        {verDoc.sha256Original ?? "—"}
                      </span>
                    }
                  />
                  <Info
                    label="Huella del acta (SHA-256)"
                    value={
                      <span className="font-mono text-[11px] break-all">
                        {verDoc.sha256Acta ?? "—"}
                      </span>
                    }
                  />
                </div>

                <div className="rounded-md border bg-muted/40 px-3 py-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Acta de firma
                    </div>
                    {auditoriaOk !== null && (
                      <Badge
                        variant="outline"
                        className={
                          auditoriaOk
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-rose-300 bg-rose-50 text-rose-700"
                        }
                      >
                        {auditoriaOk ? (
                          <><ShieldCheck className="h-3 w-3 mr-1" /> Cadena íntegra</>
                        ) : (
                          <><ShieldAlert className="h-3 w-3 mr-1" /> Cadena rota</>
                        )}
                      </Badge>
                    )}
                  </div>
                  {auditoria === null ? (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
                    </div>
                  ) : auditoria.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Sin eventos registrados.</div>
                  ) : (
                    <ol className="space-y-1.5 text-xs">
                      {deduplicarEventos(auditoria).map(({ evento: e, count }) => {
                        const ipMostrar = displayIp(e.ip);
                        return (
                          <li key={e.id} className="font-mono">
                            <span className="text-muted-foreground">{fmt(e.ocurridoEn)}</span>{" "}
                            <span className="font-semibold text-foreground">{e.tipo}</span>
                            {count > 1 && (
                              <span className="ml-1 text-[10px] font-bold text-primary">
                                ×{count}
                              </span>
                            )}
                            {ipMostrar !== "—" && (
                              <span className="text-muted-foreground"> · IP {ipMostrar}</span>
                            )}
                            {e.userAgent && (
                              <div className="text-[10px] text-muted-foreground/80 line-clamp-1">
                                {e.userAgent}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVerDoc(null)}>
              Cerrar
            </Button>
            {verDoc?.estado === "firmado" && (
              <Button
                variant="primary"
                onClick={() => verDoc && descargar(verDoc.id)}
                disabled={descargando === verDoc?.id}
              >
                {descargando === verDoc?.id ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Descargar PDF firmado
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecuadroDocumento({
  etiqueta,
  doc,
  total,
  fmt,
  onAbrir,
}: {
  etiqueta: string;
  doc: Firma | null;
  total: number;
  fmt: (s: string | null) => string;
  onAbrir: (doc: Firma) => void;
}) {
  const esReconocimiento = doc?.tipo === "reconocimiento_medico";

  // Sin documento: recuadro apagado y no pinchable. Es un hueco, no un error.
  if (!doc) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-4 h-full flex flex-col justify-between opacity-70">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{etiqueta}</span>
          <FileX2 className="h-4 w-4 text-muted-foreground/50 shrink-0" />
        </div>
        <span className="text-xs text-muted-foreground mt-3">Sin enviar</span>
      </div>
    );
  }

  const firmado = doc.estado === "firmado";
  const Icono =
    firmado ? CheckCircle2
    : doc.estado === "pendiente" ? Clock
    : doc.estado === "rechazado" ? XCircle
    : FileSignature;

  return (
    <button
      type="button"
      onClick={() => onAbrir(doc)}
      className={cn(
        "rounded-lg border bg-card p-4 h-full text-left flex flex-col justify-between",
        "transition-colors hover:border-primary/50 hover:bg-accent/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        firmado && "border-emerald-200",
      )}
      title="Ver documento firmado y acreditación legal"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground line-clamp-2">{etiqueta}</span>
        <Icono
          className={cn(
            "h-4 w-4 shrink-0",
            firmado ? "text-emerald-600"
              : doc.estado === "pendiente" ? "text-amber-600"
              : doc.estado === "rechazado" ? "text-rose-600"
              : "text-muted-foreground",
          )}
        />
      </div>

      <div className="mt-3 space-y-1.5">
        <Badge variant="outline" className={cn("text-[11px]", ESTADO_COLOR[doc.estado])}>
          {ESTADO_LABEL[doc.estado]}
        </Badge>
        <div className="text-xs text-muted-foreground">
          {firmado ? fmt(doc.firmadoEn) : `Enviado ${fmt(doc.enviadoEn)}`}
        </div>
        {esReconocimiento && doc.decisionReconocimiento && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Stethoscope className="h-3 w-3" />
            {doc.decisionReconocimiento === "si" ? "Sí quiere pasarlo" : "No quiere pasarlo"}
          </div>
        )}
        {total > 1 && (
          <div className="text-[11px] text-muted-foreground">
            {total} documentos de este tipo
          </div>
        )}
      </div>
    </button>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}
