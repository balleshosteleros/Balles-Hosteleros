"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  SubmoduleToolbar,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
  coincideBusquedaUniversal,
  ordenarColumnas,
  colVisible,
} from "@/shared/components/SubmoduleToolbar";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { Settings, ClipboardCheck, CheckCircle2, Link2, Copy, RefreshCw, Loader2 } from "lucide-react";
import { listEnvios, getEnvio, revisarEnvio, getToken, rotarToken, setPlantillaActiva, listPlantillas } from "../actions";
import type { EnvioResumen, EnvioCompleto } from "../types";

const columnasDef: ToolbarColumna[] = [
  { campo: "numero_secuencial", label: "Nº", bloqueada: true },
  { campo: "created_at", label: "Recibida" },
  { campo: "fecha_inspeccion", label: "Fecha inspección" },
  { campo: "nombre_inspector", label: "Inspector" },
  { campo: "local_nombre", label: "Local" },
  { campo: "nota_final", label: "Nota" },
  { campo: "estado", label: "Estado" },
];

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function NotaBadge({ nota }: { nota: number | null }) {
  if (nota === null) return <span className="text-muted-foreground">—</span>;
  const color =
    nota >= 9 ? "bg-emerald-100 text-emerald-700" :
    nota >= 7 ? "bg-blue-100 text-blue-700" :
    nota >= 5 ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700";
  return <Badge className={`tabular-nums font-mono ${color} hover:${color}`}>{nota.toFixed(2).replace(".", ",")}</Badge>;
}

function EstadoBadge({ estado }: { estado: EnvioResumen["estado"] }) {
  const map: Record<EnvioResumen["estado"], { label: string; cn: string }> = {
    pendiente_revision: { label: "Pendiente revisión", cn: "bg-amber-100 text-amber-700" },
    revisado: { label: "Revisado", cn: "bg-emerald-100 text-emerald-700" },
    archivado: { label: "Archivado", cn: "bg-muted text-muted-foreground" },
  };
  const { label, cn } = map[estado];
  return <Badge className={`text-[10px] ${cn} hover:${cn}`}>{label}</Badge>;
}

export function RealizadasView() {
  const [envios, setEnvios] = useState<EnvioResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[]>(columnasDef.map((c) => c.campo));
  const [showConfig, setShowConfig] = useState(false);
  const [selectedEnvioId, setSelectedEnvioId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    listEnvios().then((d) => {
      setEnvios(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filtrados = envios.filter((e) => coincideBusquedaUniversal(e, busqueda));
  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="space-y-4">
      <ConfigPanel show={showConfig} onClose={() => setShowConfig(false)} />

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        ocultarNuevo
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraIzquierda={<EnlaceInspectorButton />}
        extraDerecha={
          <Button
            size="icon"
            variant={showConfig ? "default" : "outline"}
            className="h-9 w-9"
            onClick={() => setShowConfig((v) => !v)}
            title="Configuración"
            aria-label="Configuración"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        }
      />

      <ResizableColumnsProvider storageKey="calidad-inspecciones-realizadas">
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {columnasRender.map((c) => (
                  <th key={c.campo} className="text-left px-3 py-2 font-medium text-foreground">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && envios.length === 0 ? (
                <tr><td colSpan={columnasRender.length} className="text-center py-10"><LoadingSpinner /></td></tr>
              ) : !loading && envios.length === 0 ? (
                <tr>
                  <td colSpan={columnasRender.length} className="text-center py-16">
                    <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                    <div className="text-sm text-muted-foreground">Aún no hay inspecciones recibidas.</div>
                    <div className="text-xs text-muted-foreground mt-1">Comparte el enlace con un inspector para empezar.</div>
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={columnasRender.length} className="text-center py-10 text-muted-foreground">Ningún envío coincide con la búsqueda.</td></tr>
              ) : (
                filtrados.map((e) => (
                  <tr key={e.id} className="border-b hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedEnvioId(e.id)}>
                    {columnasRender.map((c) => {
                      const cell = (() => {
                        switch (c.campo) {
                          case "numero_secuencial": return <span className="font-mono text-xs text-muted-foreground">{e.numero_secuencial ?? "—"}</span>;
                          case "created_at": return <span className="text-xs text-muted-foreground">{formatFecha(e.created_at)}</span>;
                          case "fecha_inspeccion": return <span className="text-xs">{formatFecha(e.fecha_inspeccion)}</span>;
                          case "nombre_inspector": return <span className="font-medium">{e.nombre_inspector}</span>;
                          case "local_nombre": return <span className="text-xs">{e.local_nombre ?? "—"}</span>;
                          case "nota_final": return <NotaBadge nota={e.nota_final} />;
                          case "estado": return <EstadoBadge estado={e.estado} />;
                          default: return null;
                        }
                      })();
                      return <td key={c.campo} className="px-3 py-2 align-middle">{cell}</td>;
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>
      <div className="text-xs text-muted-foreground text-right">
        {filtrados.length} de {envios.length} inspecciones
      </div>

      <EnvioDetailDialog
        envioId={selectedEnvioId}
        onClose={() => setSelectedEnvioId(null)}
        onSaved={() => { setSelectedEnvioId(null); reload(); }}
      />
    </div>
  );
}

function EnlaceInspectorButton() {
  const [loading, setLoading] = useState(false);

  async function copy() {
    setLoading(true);
    const t = await getToken();
    setLoading(false);
    if (!t) {
      toast.error("No se pudo obtener el enlace");
      return;
    }
    const url = `${window.location.origin}/inspectores/${t.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  return (
    <Button variant="primary" size="sm" onClick={copy} disabled={loading} className="gap-1.5" title="Copiar enlace público para inspectores externos">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
      Enlace inspector
      <Copy className="h-3.5 w-3.5 opacity-70" />
    </Button>
  );
}

function ConfigPanel({ show, onClose }: { show: boolean; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [plantillaActivaId, setPlantillaActivaId] = useState<string | null>(null);
  const [plantillas, setPlantillas] = useState<{ id: string; nombre: string }[]>([]);
  const [loadingRot, setLoadingRot] = useState(false);

  useEffect(() => {
    if (!show) return;
    Promise.all([getToken(), listPlantillas()]).then(([t, ps]) => {
      setToken(t?.token ?? null);
      setPlantillaActivaId(t?.plantilla_activa_id ?? null);
      setPlantillas(ps.filter((p) => !p.archivada).map((p) => ({ id: p.id, nombre: p.nombre })));
    });
  }, [show]);

  if (!show) return null;

  async function copyLink() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/inspectores/${token}`);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function rotar() {
    if (!confirm("Rotar el enlace invalidará el actual. ¿Continuar?")) return;
    setLoadingRot(true);
    const res = await rotarToken();
    setLoadingRot(false);
    if (res.ok) {
      setToken(res.token);
      toast.success("Enlace rotado");
    } else {
      toast.error(res.error);
    }
  }

  async function cambiarPlantilla(id: string) {
    const res = await setPlantillaActiva(id);
    if (res.ok) {
      setPlantillaActivaId(id);
      toast.success("Plantilla activa actualizada");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Configuración</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Enlace público para inspectores</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs font-mono truncate">
              {token ? `${typeof window !== "undefined" ? window.location.origin : ""}/inspectores/${token}` : "—"}
            </code>
            <Button size="sm" variant="outline" onClick={copyLink} disabled={!token}>
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
            <Button size="sm" variant="outline" onClick={rotar} disabled={loadingRot}>
              {loadingRot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Rotar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Compártelo con los inspectores externos. Al rotar, el enlace anterior deja de funcionar.
          </p>
        </div>
        <div className="space-y-1.5 pt-2 border-t">
          <Label className="text-xs">Plantilla activa</Label>
          <div className="grid gap-1.5">
            {plantillas.length === 0 ? (
              <div className="text-xs text-muted-foreground">Aún no hay plantillas. Crea una en la pestaña PLANTILLAS.</div>
            ) : plantillas.map((p) => (
              <button
                key={p.id}
                onClick={() => cambiarPlantilla(p.id)}
                className={`text-left rounded-md border px-3 py-2 text-sm transition-colors ${
                  plantillaActivaId === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{p.nombre}</span>
                  {plantillaActivaId === p.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            La plantilla activa es la que el inspector verá automáticamente al abrir el enlace.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function EnvioDetailDialog({
  envioId,
  onClose,
  onSaved,
}: {
  envioId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [envio, setEnvio] = useState<EnvioCompleto | null>(null);
  const [loading, setLoading] = useState(false);
  const [notas, setNotas] = useState("");
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    if (!envioId) {
      setEnvio(null);
      return;
    }
    setLoading(true);
    getEnvio(envioId).then((e) => {
      setEnvio(e);
      setNotas(e?.notas_calidad ?? "");
      setLoading(false);
    });
  }, [envioId]);

  function handleMark(estado: EnvioCompleto["estado"]) {
    if (!envio) return;
    startSave(async () => {
      const res = await revisarEnvio(envio.id, { estado, notas_calidad: notas || null });
      if (res.ok) {
        toast.success(estado === "revisado" ? "Marcado como revisado" : "Estado actualizado");
        onSaved();
      } else {
        toast.error(res.error);
      }
    });
  }

  const respuestasPorSeccion = new Map<string, typeof envio extends null ? never : NonNullable<typeof envio>["respuestas"]>();
  if (envio) {
    for (const r of envio.respuestas) {
      const k = r.pregunta_snapshot.seccion_titulo;
      const arr = respuestasPorSeccion.get(k) ?? [];
      arr.push(r);
      respuestasPorSeccion.set(k, arr);
    }
  }

  return (
    <Dialog open={!!envioId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Inspección #{envio?.numero_secuencial ?? "—"}
            {envio && <EstadoBadge estado={envio.estado} />}
            {envio?.nota_final !== undefined && <NotaBadge nota={envio?.nota_final ?? null} />}
          </DialogTitle>
        </DialogHeader>

        {loading || !envio ? (
          <div className="py-10 flex justify-center"><LoadingSpinner /></div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground text-xs">Inspector:</span> <span className="font-medium">{envio.nombre_inspector}</span></div>
              <div><span className="text-muted-foreground text-xs">Teléfono:</span> {envio.telefono_inspector ?? "—"}</div>
              <div><span className="text-muted-foreground text-xs">Fecha inspección:</span> {formatFecha(envio.fecha_inspeccion)}</div>
              <div><span className="text-muted-foreground text-xs">Local:</span> {envio.local_nombre ?? "—"}</div>
              <div className="col-span-2"><span className="text-muted-foreground text-xs">Encargado:</span> {envio.nombre_encargado ?? "—"}</div>
            </div>

            {Array.from(respuestasPorSeccion.entries())
              .sort((a, b) => (a[1][0]?.pregunta_snapshot.seccion_orden ?? 0) - (b[1][0]?.pregunta_snapshot.seccion_orden ?? 0))
              .map(([sec, respuestas]) => (
              <div key={sec} className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{sec}</div>
                <div className="space-y-2">
                  {respuestas
                    .slice()
                    .sort((a, b) => a.pregunta_snapshot.orden - b.pregunta_snapshot.orden)
                    .map((r) => (
                    <div key={r.id} className="text-sm">
                      <div className="text-foreground/90">{r.pregunta_snapshot.enunciado}</div>
                      <div className="mt-0.5">
                        {r.pregunta_snapshot.tipo === "escala" && r.valor_numero !== null ? (
                          <Badge variant="outline" className="font-mono tabular-nums">
                            {r.valor_numero} / {r.pregunta_snapshot.escala_max ?? 5}
                          </Badge>
                        ) : r.valor_texto ? (
                          <div className="rounded bg-muted/30 px-2 py-1.5 text-xs whitespace-pre-wrap">{r.valor_texto}</div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sin respuesta</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="space-y-1.5 pt-2 border-t">
              <Label className="text-xs">Notas de Calidad</Label>
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} placeholder="Notas internas de revisión..." />
            </div>
          </div>
        )}

        {envio && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            {envio.estado !== "archivado" && (
              <Button variant="outline" onClick={() => handleMark("archivado")} disabled={isSaving}>Archivar</Button>
            )}
            {envio.estado !== "revisado" && (
              <Button onClick={() => handleMark("revisado")} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Marcar revisado
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
