"use client";

import { useState, useTransition } from "react";
import { Database, Loader2, RefreshCw, ChevronRight, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getMigracionAgoraEstado,
  sincronizarDiaAgora,
  type MigracionEstado,
  type MigracionFactura,
} from "@/features/sala/actions/agora-migracion-actions";

const eur = (n: number) => `${(n ?? 0).toFixed(2)} €`;
const fechaCorta = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

export function MigracionAgoraDialog() {
  const [open, setOpen] = useState(false);
  const [estado, setEstado] = useState<MigracionEstado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [dia, setDia] = useState(hoyIso());
  const [aviso, setAviso] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cargar = () => {
    setCargando(true);
    setError(null);
    getMigracionAgoraEstado().then((r) => {
      if (r.ok) setEstado(r);
      else setError(r.error);
      setCargando(false);
    });
  };

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (o && !estado) cargar();
  };

  const sincronizar = () => {
    setAviso(null);
    startTransition(async () => {
      const r = await sincronizarDiaAgora(dia);
      if (r.ok) {
        setAviso(`Día ${dia}: ${r.facturas} facturas · ${r.lineas} líneas · ${r.sinProducto} sin producto.`);
        cargar();
      } else {
        setAviso(`Error: ${r.error}`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Database className="h-4 w-4" />
          Tripas de migración Ágora
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Migración de Ágora — interior
          </DialogTitle>
          <DialogDescription>
            Lo que el sistema trae de Ágora a Balles: estado, sincronizaciones y las facturas crudas con su formato de venta.
          </DialogDescription>
        </DialogHeader>

        {cargando && !estado ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : estado ? (
          <div className="space-y-5">
            {/* Estado */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="Facturas en Balles" value={String(estado.tickets)} />
              <Kpi label="Primer día" value={fechaCorta(estado.primerDia)} />
              <Kpi label="Último día" value={fechaCorta(estado.ultimoDia)} />
              <Kpi
                label="Conexión Ágora"
                value={estado.envsConfigurados ? "Configurada" : "Sin claves"}
                ok={estado.envsConfigurados}
              />
            </div>

            {/* Traer un día a demanda */}
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Traer un día a demanda</p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Business-day</label>
                  <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="h-9 w-44" />
                </div>
                <Button onClick={sincronizar} disabled={pending} size="sm" className="gap-2">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sincronizar día
                </Button>
                {aviso && <span className="text-xs text-muted-foreground">{aviso}</span>}
              </div>
            </div>

            {/* Log de sincronizaciones */}
            <div>
              <p className="mb-2 text-sm font-medium">Últimas sincronizaciones</p>
              {estado.log.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aún no hay registros de sincronización.</p>
              ) : (
                <ul className="space-y-1">
                  {estado.log.map((l, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      {l.status === "error" ? (
                        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      )}
                      <span className="text-muted-foreground">{l.sync_at.replace("T", " ").slice(0, 16)}</span>
                      <span className="flex-1">{l.resumen}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Facturas crudas */}
            <div>
              <p className="mb-2 text-sm font-medium">Facturas traídas (crudo)</p>
              {estado.facturas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Todavía no hay facturas de Ágora en Balles.</p>
              ) : (
                <div className="space-y-1">
                  {estado.facturas.map((f) => (
                    <FacturaCruda key={f.id} f={f} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-lg border p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${ok === false ? "text-destructive" : ok ? "text-emerald-600" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function FacturaCruda({ f }: { f: MigracionFactura }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/40"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="font-medium">{f.numero}</span>
        <span className="text-muted-foreground">· {fechaCorta(f.fecha)} · {f.comensales} pax · {f.lineas.length} líneas</span>
        <span className="ml-auto font-semibold tabular-nums">{eur(f.total)}</span>
      </button>
      {open && (
        <div className="border-t bg-muted/20 px-3 py-2">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] uppercase text-muted-foreground">
                <th className="py-1">Cant.</th>
                <th>Producto</th>
                <th>Formato</th>
                <th className="text-right">Ratio</th>
                <th className="text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {f.lineas.map((l, i) => (
                <tr key={i} className="border-t border-border/50">
                  <td className="py-1 tabular-nums">{l.cantidad}</td>
                  <td>
                    {l.nombre}
                    {!l.conProducto && (
                      <Badge variant="outline" className="ml-1 text-[9px] text-amber-600 border-amber-300">
                        sin mapear
                      </Badge>
                    )}
                  </td>
                  <td className="text-muted-foreground">{l.formato ?? "—"}</td>
                  <td className="text-right tabular-nums">{l.ratio}</td>
                  <td className="text-right tabular-nums">{eur(l.precioUnitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
