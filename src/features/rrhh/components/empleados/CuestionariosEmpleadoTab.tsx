"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { FileQuestion, Loader2, Eye, CheckCircle2, XCircle, MinusCircle, BellRing } from "lucide-react";
import { toast } from "sonner";
import {
  listCuestionariosEmpleado,
  getCuestionarioEnvioEmpleadoDetalle,
  enviarRecordatorioCuestionario,
  type CuestionarioEmpleadoItem,
  type CuestionarioEmpleadoDetalle,
} from "@/features/rrhh/actions/cuestionarios-empleado-actions";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

function fmtFecha(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return s; }
}

function NotaCell({ item }: { item: CuestionarioEmpleadoItem }) {
  if (!item.respondido) return <span className="text-muted-foreground">—</span>;
  if (item.puntuacion == null || item.notaSobre == null)
    return <span className="text-muted-foreground">—</span>;
  return (
    <span className="font-semibold">
      {item.puntuacion}
      <span className="text-muted-foreground font-normal"> / {item.notaSobre}</span>
    </span>
  );
}

function EstadoBadge({ item }: { item: CuestionarioEmpleadoItem }) {
  if (!item.respondido)
    return <Badge variant="outline" className="border-muted text-muted-foreground bg-muted/40">Pendiente</Badge>;
  if (item.aprobado === true)
    return <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">Aprobado</Badge>;
  if (item.aprobado === false)
    return <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">No aprobado</Badge>;
  return <Badge variant="outline">Respondido</Badge>;
}

export function CuestionariosEmpleadoTab({ empleadoId }: { empleadoId: string }) {
  const [items, setItems] = useState<CuestionarioEmpleadoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<CuestionarioEmpleadoDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [recordando, setRecordando] = useState<string | null>(null);
  useGlobalLoadingSync(loading);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listCuestionariosEmpleado(empleadoId);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setItems(res.data);
  }, [empleadoId]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function abrirDetalle(envioId: string) {
    setAbierto(true);
    setDetalle(null);
    setCargandoDetalle(true);
    const res = await getCuestionarioEnvioEmpleadoDetalle(envioId);
    setCargandoDetalle(false);
    if (!res.ok) {
      toast.error(res.error);
      setAbierto(false);
      return;
    }
    setDetalle(res.data);
  }

  async function recordar(envioId: string) {
    setRecordando(envioId);
    const res = await enviarRecordatorioCuestionario(envioId);
    setRecordando(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Recordatorio enviado a ${res.email}`);
  }

  const respondidos = items.filter((i) => i.respondido).length;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileQuestion className="h-5 w-5 text-primary" />
          Cuestionarios
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {items.length > 0
            ? `${items.length} en total · ${respondidos} respondidos`
            : "Solo lectura"}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileQuestion className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            No existe aún ningún cuestionario vinculado a su nombre.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuestionario</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Respondido</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.plantillaNombre}</TableCell>
                  <TableCell className="text-sm">{i.periodo}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtFecha(i.respondidoAt)}
                  </TableCell>
                  <TableCell><NotaCell item={i} /></TableCell>
                  <TableCell><EstadoBadge item={i} /></TableCell>
                  <TableCell className="text-right">
                    {i.respondido ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirDetalle(i.id)}
                        title="Ver cuestionario (solo lectura)"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => recordar(i.id)}
                        disabled={recordando === i.id}
                        title="Enviar recordatorio por email"
                        className="gap-1.5"
                      >
                        {recordando === i.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <BellRing className="h-4 w-4" />
                        )}
                        Recordatorio
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-primary" />
              {detalle?.plantillaNombre ?? "Cuestionario"}
            </DialogTitle>
            <DialogDescription>
              Vista de solo lectura. La gestión de cuestionarios vive en el módulo de Calidad.
            </DialogDescription>
          </DialogHeader>

          {cargandoDetalle || !detalle ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Campo label="Periodo" value={detalle.periodo} />
                <Campo label="Respondido" value={fmtFecha(detalle.respondidoAt)} />
                <Campo
                  label="Nota"
                  value={
                    detalle.puntuacion != null && detalle.notaSobre != null
                      ? `${detalle.puntuacion} / ${detalle.notaSobre}`
                      : "—"
                  }
                />
                <Campo
                  label="Resultado"
                  value={
                    detalle.aprobado === true
                      ? "Aprobado"
                      : detalle.aprobado === false
                        ? "No aprobado"
                        : "—"
                  }
                />
              </div>

              {detalle.respuestas.length > 0 && (
                <div className="space-y-3">
                  {agruparPorBloque(detalle.respuestas).map((b) => (
                    <div key={b.titulo} className="rounded-lg border bg-card overflow-hidden">
                      <div className="bg-muted/40 px-3 py-2 text-sm font-medium">{b.titulo}</div>
                      <div className="divide-y">
                        {b.respuestas.map((r) => (
                          <div key={r.preguntaId} className="px-3 py-2.5 flex items-start gap-2">
                            <CorrectaIcon correcta={r.correcta} />
                            <div className="min-w-0">
                              <p className="text-sm text-muted-foreground">{r.enunciado}</p>
                              <p className="text-sm font-medium mt-0.5">{r.respuesta}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {detalle.reunionNotas && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Notas de la reunión {detalle.reunionFecha ? `· ${fmtFecha(detalle.reunionFecha)}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap">{detalle.reunionNotas}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function CorrectaIcon({ correcta }: { correcta: boolean | null }) {
  if (correcta === true) return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />;
  if (correcta === false) return <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
  return <MinusCircle className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />;
}

function agruparPorBloque(respuestas: CuestionarioEmpleadoDetalle["respuestas"]) {
  const grupos: { titulo: string; respuestas: typeof respuestas }[] = [];
  for (const r of respuestas) {
    let g = grupos.find((x) => x.titulo === r.bloqueTitulo);
    if (!g) {
      g = { titulo: r.bloqueTitulo, respuestas: [] };
      grupos.push(g);
    }
    g.respuestas.push(r);
  }
  return grupos;
}
