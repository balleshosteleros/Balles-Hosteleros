"use client";

/**
 * Dar de baja material que se ha estropeado EN LA ESTANTERÍA.
 *
 * No hay acta que firmar porque no hay trabajador de por medio: la pieza nunca
 * llegó a manos de nadie. Baja el almacén y baja el total de la empresa.
 *
 * Si la pieza se le rompió a alguien que la llevaba puesta, eso no es esto: es
 * la merma, y esa sí la firma el trabajador.
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { listSaldosMaterial, registrarBajaAlmacen } from "@/features/rrhh/actions/material-almacen-actions";
import { nombrePieza, type SaldoMaterial } from "@/features/rrhh/data/material-stock";

function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Clave de una pieza en el selector: tipo y talla juntos. */
function claveDe(s: SaldoMaterial): string {
  return `${s.tipoId ?? ""}|${s.talla ?? ""}`;
}

export function BajaAlmacenDialog({
  open,
  onOpenChange,
  onHecho,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onHecho: () => void;
}) {
  const [saldos, setSaldos] = useState<SaldoMaterial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [clave, setClave] = useState("");
  const [unidades, setUnidades] = useState("1");
  const [fecha, setFecha] = useState(hoyISO());
  const [motivo, setMotivo] = useState("");
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setCargando(true);
    void listSaldosMaterial().then((data) => {
      if (cancel) return;
      // Solo se puede dar de baja lo que hay en la estantería.
      setSaldos(data.filter((s) => s.enAlmacen > 0));
      setCargando(false);
    });
    return () => { cancel = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setClave("");
    setUnidades("1");
    setFecha(hoyISO());
    setMotivo("");
    setObservaciones("");
  }, [open]);

  const elegida = useMemo(
    () => saldos.find((s) => claveDe(s) === clave),
    [saldos, clave],
  );

  async function guardar() {
    if (!elegida?.tipoId) {
      toast.error("Elige qué se da de baja");
      return;
    }
    const cuantas = Number(unidades);
    if (!Number.isInteger(cuantas) || cuantas < 1) {
      toast.error("Las unidades tienen que ser un número entero de al menos 1");
      return;
    }
    if (cuantas > elegida.enAlmacen) {
      toast.error(`Solo hay ${elegida.enAlmacen} en el almacén`);
      return;
    }
    if (!motivo.trim()) {
      toast.error("Explica por qué se da de baja");
      return;
    }

    setGuardando(true);
    const res = await registrarBajaAlmacen({
      tipoId: elegida.tipoId,
      talla: elegida.talla,
      unidades: cuantas,
      fecha,
      motivo,
      observaciones: observaciones.trim() || null,
    });
    setGuardando(false);
    if (!res.ok) { toast.error(res.error); return; }

    toast.success("Material dado de baja");
    onOpenChange(false);
    onHecho();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dar de baja del almacén</DialogTitle>
          <DialogDescription>
            Material que se ha estropeado en la estantería, sin llegar a
            entregarse a nadie.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : saldos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No hay nada en el almacén que dar de baja.
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="baja-pieza">Qué se da de baja</Label>
                <Select value={clave} onValueChange={setClave}>
                  <SelectTrigger id="baja-pieza">
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {saldos.map((s) => (
                      <SelectItem key={claveDe(s)} value={claveDe(s)}>
                        {nombrePieza(s.tipoNombre, s.talla)} — {s.enAlmacen} en almacén
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baja-unidades">Unidades</Label>
                <Input
                  id="baja-unidades"
                  type="number"
                  min={1}
                  step={1}
                  max={elegida?.enAlmacen}
                  value={unidades}
                  onChange={(e) => setUnidades(e.target.value)}
                  className="w-24"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="baja-fecha">Fecha</Label>
              <Input
                id="baja-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="baja-motivo">Motivo</Label>
              <Textarea
                id="baja-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Por ejemplo: se mancharon de lejía en el almacén; llegaron rotas del proveedor…"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="baja-observaciones">Observaciones</Label>
              <Textarea
                id="baja-observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Opcional"
                rows={2}
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <AlertTriangle className="h-4 w-4 text-rose-700 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-900">
                El total de la empresa baja: son unidades que ya no existen.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={guardando || cargando || saldos.length === 0}
          >
            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
