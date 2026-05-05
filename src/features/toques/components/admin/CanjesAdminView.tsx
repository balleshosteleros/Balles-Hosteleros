"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Inbox,
  ShoppingBag,
  PartyPopper,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { aprobarCanje, rechazarCanje, marcarCanjeDisfrutado } from "@/features/toques/actions/toques-actions";
import type { Canje } from "@/features/toques/types/toques.types";
import { CANJE_ESTADO_COLOR, CANJE_ESTADO_LABEL } from "@/features/toques/types/toques.types";
import { OtorgarToqueDialog } from "./OtorgarToqueDialog";

type Row = Record<string, unknown>;
function s(r: Row, k: string): string {
  return typeof r[k] === "string" ? (r[k] as string) : r[k] == null ? "" : String(r[k]);
}
function n(r: Row, k: string): number {
  return typeof r[k] === "number" ? (r[k] as number) : Number(r[k] ?? 0) || 0;
}
function nul<T>(r: Row, k: string): T | null {
  return r[k] == null ? null : (r[k] as T);
}

function mapCanje(r: Row): Canje {
  return {
    id: s(r, "id"),
    empresaId: s(r, "empresa_id"),
    userId: s(r, "user_id"),
    empleadoNombre: s(r, "empleado_nombre"),
    recompensaId: s(r, "recompensa_id"),
    recompensaNombre: s(r, "recompensa_nombre"),
    costeToques: n(r, "coste_toques"),
    estado: (s(r, "estado") || "pendiente") as Canje["estado"],
    solicitadoAt: s(r, "solicitado_at"),
    resueltoAt: nul<string>(r, "resuelto_at"),
    resueltoPor: nul<string>(r, "resuelto_por"),
    fechaDisfrute: nul<string>(r, "fecha_disfrute"),
    notasSolicitud: s(r, "notas_solicitud"),
    notasRevision: s(r, "notas_revision"),
  };
}

function formatFecha(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s.includes("T") ? s : `${s}T12:00:00Z`).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

function formatFechaHora(s: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

export function CanjesAdminView() {
  const [canjes, setCanjes] = useState<Canje[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [tab, setTab] = useState("pendiente");
  const [aprobando, setAprobando] = useState<{ canje: Canje; fecha: string; notas: string } | null>(null);
  const [rechazando, setRechazando] = useState<{ canje: Canje; motivo: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otorgarOpen, setOtorgarOpen] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Sin sesión");
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const eId = (profile?.empresa_id as string) ?? null;
      setEmpresaId(eId);
      if (!eId) {
        setError("No estás asignado a una empresa");
        setLoading(false);
        return;
      }
      const { data, error: errD } = await supabase
        .from("toques_canjes")
        .select("*")
        .eq("empresa_id", eId)
        .order("solicitado_at", { ascending: false })
        .limit(200);
      if (errD) {
        setError(errD.message);
        setLoading(false);
        return;
      }
      setCanjes((data ?? []).map((r) => mapCanje(r as Row)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const handleAprobar = async () => {
    if (!aprobando) return;
    setBusy(true);
    const res = await aprobarCanje({
      canjeId: aprobando.canje.id,
      fechaDisfrute: aprobando.fecha || undefined,
      notas: aprobando.notas,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAprobando(null);
    void cargar();
  };

  const handleRechazar = async () => {
    if (!rechazando) return;
    if (!rechazando.motivo.trim()) {
      setError("Indica un motivo");
      return;
    }
    setBusy(true);
    const res = await rechazarCanje({
      canjeId: rechazando.canje.id,
      motivo: rechazando.motivo,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRechazando(null);
    void cargar();
  };

  const handleDisfrutar = async (c: Canje) => {
    setBusy(true);
    const res = await marcarCanjeDisfrutado({ canjeId: c.id });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    void cargar();
  };

  const grupos = {
    pendiente: canjes.filter((c) => c.estado === "pendiente"),
    aprobada: canjes.filter((c) => c.estado === "aprobada"),
    historico: canjes.filter((c) => c.estado === "rechazada" || c.estado === "disfrutada" || c.estado === "anulada"),
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-500" />
            Points: canjes y bonus
          </h1>
          <p className="text-sm text-muted-foreground">
            Aprueba canjes, otorga points manuales y revisa el histórico.
          </p>
        </div>
        <Button variant="default" size="lg" onClick={() => setOtorgarOpen(true)}>
          <PartyPopper className="h-4 w-4 mr-1.5" />
          Otorgar points
        </Button>
      </div>

      {error && (
        <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 text-sm">{error}</Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pendiente">Pendientes ({grupos.pendiente.length})</TabsTrigger>
          <TabsTrigger value="aprobada">Aprobados ({grupos.aprobada.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({grupos.historico.length})</TabsTrigger>
        </TabsList>

        {(["pendiente", "aprobada", "historico"] as const).map((key) => (
          <TabsContent key={key} value={key} className="mt-4">
            {loading ? (
              <Card className="p-6 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </Card>
            ) : grupos[key].length === 0 ? (
              <Card className="p-6 flex flex-col items-center text-muted-foreground text-sm">
                <Inbox className="h-6 w-6 mb-1.5" />
                No hay canjes en esta vista.
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <ul className="divide-y">
                  {grupos[key].map((c) => (
                    <li key={c.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{c.empleadoNombre || "—"}</span>
                          <Badge variant="outline" className={`text-[10px] ${CANJE_ESTADO_COLOR[c.estado]}`}>
                            {CANJE_ESTADO_LABEL[c.estado]}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-medium text-slate-700">{c.recompensaNombre}</span>
                          {" · "}
                          Solicitado {formatFechaHora(c.solicitadoAt)}
                          {c.fechaDisfrute ? ` · Disfrute ${formatFecha(c.fechaDisfrute)}` : ""}
                        </div>
                        {c.notasSolicitud && (
                          <div className="text-xs text-slate-600 italic mt-1">"{c.notasSolicitud}"</div>
                        )}
                        {c.notasRevision && (
                          <div className="text-xs text-rose-600 mt-0.5">Revisión: {c.notasRevision}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-lg font-bold text-amber-600 tabular-nums">
                            −{c.costeToques}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            points
                          </div>
                        </div>
                        {c.estado === "pendiente" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setAprobando({ canje: c, fecha: "", notas: "" })}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRechazando({ canje: c, motivo: "" })}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Rechazar
                            </Button>
                          </div>
                        )}
                        {c.estado === "aprobada" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDisfrutar(c)}
                            disabled={busy}
                          >
                            Marcar disfrutado
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Aprobar dialog */}
      <Dialog open={!!aprobando} onOpenChange={(o) => !o && setAprobando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar canje</DialogTitle>
            <DialogDescription>
              {aprobando ? (
                <>
                  <span className="font-semibold">{aprobando.canje.empleadoNombre}</span>
                  {" canjea "}
                  <span className="font-semibold">{aprobando.canje.recompensaNombre}</span>
                  {` (${aprobando.canje.costeToques} points).`}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="fecha-disfrute" className="text-xs">
                Fecha de disfrute (opcional)
              </Label>
              <Input
                id="fecha-disfrute"
                type="date"
                className="mt-1"
                value={aprobando?.fecha ?? ""}
                onChange={(e) =>
                  setAprobando((prev) => (prev ? { ...prev, fecha: e.target.value } : prev))
                }
              />
            </div>
            <div>
              <Label htmlFor="notas-aprobar" className="text-xs">
                Notas (opcional)
              </Label>
              <Textarea
                id="notas-aprobar"
                className="mt-1"
                rows={2}
                maxLength={500}
                value={aprobando?.notas ?? ""}
                onChange={(e) =>
                  setAprobando((prev) => (prev ? { ...prev, notas: e.target.value } : prev))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAprobando(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleAprobar} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Aprobar y descontar points
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rechazar dialog */}
      <Dialog open={!!rechazando} onOpenChange={(o) => !o && setRechazando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar canje</DialogTitle>
            <DialogDescription>
              Explica el motivo. El empleado lo verá en su historial.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="motivo-rechazar" className="text-xs">
              Motivo
            </Label>
            <Textarea
              id="motivo-rechazar"
              className="mt-1"
              rows={3}
              maxLength={500}
              value={rechazando?.motivo ?? ""}
              onChange={(e) =>
                setRechazando((prev) => (prev ? { ...prev, motivo: e.target.value } : prev))
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRechazando(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRechazar} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {empresaId && (
        <OtorgarToqueDialog
          open={otorgarOpen}
          onOpenChange={setOtorgarOpen}
          empresaId={empresaId}
          onOtorgado={() => {
            setOtorgarOpen(false);
            void cargar();
          }}
        />
      )}
    </div>
  );
}
