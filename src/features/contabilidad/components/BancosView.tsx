"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Settings, Trash2, Landmark, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SubmoduleToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { bancosIO } from "@/features/contabilidad/io/bancos.io";
import { ConectarBancoDialog } from "./bancos/ConectarBancoDialog";
import {
  EstadoConexionBadge,
  type ConexionStatus,
} from "./bancos/EstadoConexionBadge";
import {
  listarConexiones,
  eliminarConexion,
  renovarConsentimiento,
  sincronizarConexion,
  seedBancosBase,
} from "@/features/contabilidad/actions/psd2-actions";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

interface BankAccount {
  id: string;
  external_id: string;
  iban_last4: string | null;
  nombre: string | null;
  titular: string | null;
  moneda: string | null;
  balance: number | null;
  balance_at: string | null;
  last_sync_at: string | null;
  sync_status: string;
}
interface Connection {
  id: string;
  provider: string;
  institution_id: string;
  institution_name: string;
  institution_logo: string | null;
  status: ConexionStatus;
  expires_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at?: string | null;
  bank_accounts: BankAccount[];
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-ES")} a las ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
}

export function BancosView() {
  const { empresaActual } = useEmpresa();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [conexiones, setConexiones] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogPrefilter, setDialogPrefilter] = useState<string | undefined>();
  const [dialogReconnectId, setDialogReconnectId] = useState<string | undefined>();
  const [sincronizando, setSincronizando] = useState<string | null>(null);
  useGlobalLoadingSync(loading || sincronizando !== null);
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  // `nowMs` fijo al montar para que `necesitaRenovar` sea idempotente en render.
  const [nowMs] = useState(() => Date.now());
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [showConfig, setShowConfig] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await listarConexiones();
    if (res.ok) setConexiones(res.data as unknown as Connection[]);
    setLoading(false);
    return res.ok ? (res.data as unknown as Connection[]) : [];
  }, []);

  useEffect(() => {
    refresh();
  }, [empresaActual?.id, refresh]);

  // Auto-seed idempotente: garantiza que las 9 entradas base existan para la empresa.
  useEffect(() => {
    if (loading || seeded || !empresaActual?.id) return;
    setSeeded(true);
    seedBancosBase().then((res) => {
      if (res.ok && res.creadas > 0) refresh();
    });
  }, [loading, seeded, empresaActual?.id, refresh]);

  useEffect(() => {
    const ok = searchParams?.get("psd2_ok");
    const err = searchParams?.get("psd2_error");
    if (ok) {
      toast.success(
        `Banco conectado · ${ok} cuenta${ok !== "1" ? "s" : ""} importada${ok !== "1" ? "s" : ""}`,
      );
      router.replace("/contabilidad/bancos");
      refresh();
    } else if (err) {
      toast.error(`No se pudo conectar el banco: ${decodeURIComponent(err)}`);
      router.replace("/contabilidad/bancos");
    }
  }, [searchParams, router, refresh]);

  const filtradas = useMemo(() => {
    if (!busqueda) return conexiones;
    const q = busqueda.toLowerCase();
    return conexiones.filter((c) =>
      c.institution_name.toLowerCase().includes(q),
    );
  }, [conexiones, busqueda]);

  async function handleSincronizar(connectionId: string) {
    setSincronizando(connectionId);
    const res = await sincronizarConexion(connectionId);
    setSincronizando(null);
    if (res.ok) {
      const partes = [
        `${res.cuentasSincronizadas} cuenta${res.cuentasSincronizadas !== 1 ? "s" : ""}`,
        `${res.movimientosNuevos} nuevo${res.movimientosNuevos !== 1 ? "s" : ""}`,
      ];
      if (res.movimientosDuplicados > 0) {
        partes.push(`${res.movimientosDuplicados} ya existentes`);
      }
      toast.success(`Sincronizado · ${partes.join(" · ")}`);
      refresh();
    } else {
      toast.error(res.error ?? "Error al sincronizar");
    }
  }

  async function handleRenovar(connectionId: string) {
    const res = await renovarConsentimiento(connectionId);
    if (res.ok) {
      window.location.href = res.redirectUrl;
    } else {
      toast.error(res.error ?? "No se pudo renovar el consentimiento");
    }
  }

  function abrirDialogo(opts?: { prefilter?: string; reconnectId?: string }) {
    setDialogPrefilter(opts?.prefilter);
    setDialogReconnectId(opts?.reconnectId);
    setShowDialog(true);
  }

  function necesitaRenovar(c: Connection): boolean {
    if (c.status === "REQUIRES_RECONSENT" || c.status === "EXPIRED") return true;
    if (c.status === "ACTIVE" && c.expires_at) {
      const diasRestantes = Math.ceil(
        (new Date(c.expires_at).getTime() - nowMs) /
          (24 * 60 * 60 * 1000),
      );
      return diasRestantes <= 7;
    }
    return false;
  }

  async function handleEliminar(connectionId: string, nombre: string) {
    const ok = await confirmDelete({
      title: "Eliminar conexión",
      description: `¿Eliminar la conexión con ${nombre}? Se perderán las cuentas y movimientos importados.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    const res = await eliminarConexion(connectionId);
    if (res.ok) {
      toast.success("Conexión eliminada");
      refresh();
    } else {
      toast.error(res.error ?? "Error al eliminar");
    }
  }

  void columnasVisibles;
  void setColumnasVisibles;

  return (
    <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={() => abrirDialogo()}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        orden={orden}
        onOrdenChange={setOrden}
        extraDerecha={
          <>
            <IOActions config={bancosIO} onSuccess={refresh} />
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
          </>
        }
      />

      {loading && (
        <div className="text-center text-sm text-muted-foreground py-12">
          Cargando bancos...
        </div>
      )}

      {!loading && filtradas.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Landmark className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {busqueda
              ? "Sin coincidencias."
              : "Aún no has conectado ningún banco."}
          </p>
          {!busqueda && (
            <Button onClick={() => abrirDialogo()}>
              Conectar tu primer banco
            </Button>
          )}
        </div>
      )}

      {!loading && filtradas.length > 0 && (
        <div className="space-y-3">
          {filtradas.map((c) => {
            const isManual = c.provider === "manual";
            const isPendingConnect = c.status === "NOT_CONNECTED";
            const cuentas = c.bank_accounts.length;
            const ultimaIso = isManual
              ? c.updated_at ?? c.created_at
              : c.bank_accounts[0]?.last_sync_at ?? null;

            return (
              <div
                key={c.id}
                className="border rounded-xl p-5 flex items-center gap-4 hover:bg-muted/20 transition-colors"
              >
                {c.institution_logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.institution_logo}
                    alt={c.institution_name}
                    className="h-12 w-12 rounded-full object-contain bg-white border shrink-0"
                  />
                ) : (
                  <div
                    className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center shrink-0",
                      isManual
                        ? "bg-gradient-to-br from-fuchsia-400 to-orange-300 text-white"
                        : "bg-muted",
                    )}
                  >
                    <Landmark
                      className={cn(
                        "h-5 w-5",
                        isManual ? "text-white" : "text-muted-foreground",
                      )}
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{c.institution_name}</p>
                    {!isManual && (
                      <EstadoConexionBadge
                        status={c.status}
                        expiresAt={c.expires_at}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cuentas} producto{cuentas !== 1 ? "s" : ""} conectado
                    {cuentas !== 1 ? "s" : ""}
                    {c.bank_accounts[0]?.iban_last4 &&
                      ` · ····${c.bank_accounts[0].iban_last4}`}
                  </p>
                  {c.last_error && (
                    <p className="text-xs text-destructive mt-1">
                      {c.last_error}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Sincronización
                  </p>
                  <p className="text-xs">
                    {isManual ? "Manual" : "Automática"}
                  </p>
                </div>

                <div className="text-right shrink-0 hidden md:block">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {isManual ? "Última modificación" : "Última sincronización"}
                  </p>
                  <p className="text-xs">{formatDateTime(ultimaIso)}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isPendingConnect && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8"
                      onClick={() =>
                        abrirDialogo({
                          prefilter: c.institution_name,
                          reconnectId: c.id,
                        })
                      }
                    >
                      Conectar
                    </Button>
                  )}

                  {!isManual && !isPendingConnect && necesitaRenovar(c) && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8"
                      onClick={() => handleRenovar(c.id)}
                    >
                      Renovar
                    </Button>
                  )}

                  {isManual ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Añadir producto"
                      aria-label="Añadir producto"
                      disabled
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Sincronizar"
                      aria-label="Sincronizar"
                      disabled={
                        sincronizando === c.id || c.status !== "ACTIVE"
                      }
                      onClick={() => handleSincronizar(c.id)}
                    >
                      <RefreshCw
                        className={cn(
                          "h-4 w-4",
                          sincronizando === c.id && "animate-spin",
                        )}
                      />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Configuración"
                    aria-label="Configuración"
                    disabled
                  >
                    <Settings className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleEliminar(c.id, c.institution_name)}
                    title="Eliminar"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConectarBancoDialog
        open={showDialog}
        onOpenChange={(v) => {
          setShowDialog(v);
          if (!v) {
            setDialogPrefilter(undefined);
            setDialogReconnectId(undefined);
          }
        }}
        prefilter={dialogPrefilter}
        reconnectConnectionId={dialogReconnectId}
      />

      {confirmDeleteDialog}
    </div>
  );
}
