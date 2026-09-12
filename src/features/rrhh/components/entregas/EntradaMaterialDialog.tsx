"use client";

/**
 * Entrada de material nuevo al almacén.
 *
 * Junto con el saldo inicial, es la única forma de que aparezca material que
 * antes no existía. Sube lo que hay en la estantería y el total de la empresa.
 *
 * A diferencia de una entrega, aquí sí hay cantidad: se compran diez camisetas
 * de golpe, y no tiene sentido registrarlas de una en una.
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
import { Loader2, Shirt, Package } from "lucide-react";
import { toast } from "sonner";
import { listTiposMaterial } from "@/features/rrhh/actions/entregas-tipos-actions";
import { registrarEntradaMaterial } from "@/features/rrhh/actions/material-almacen-actions";
import { TALLAS_ROPA, type TipoMaterial } from "@/features/rrhh/data/entregas";
import { SelectorFecha } from "@/components/ui/selector-fecha";

function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function EntradaMaterialDialog({
  open,
  onOpenChange,
  onHecho,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onHecho: () => void;
}) {
  const [tipos, setTipos] = useState<TipoMaterial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [tipoId, setTipoId] = useState("");
  const [talla, setTalla] = useState("");
  /** Texto, no número: así el campo puede quedarse vacío sin un 0 colgado. */
  const [unidades, setUnidades] = useState("1");
  const [fecha, setFecha] = useState(hoyISO());
  const [proveedor, setProveedor] = useState("");
  const [documento, setDocumento] = useState("");
  const [coste, setCoste] = useState("");
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setCargando(true);
    void listTiposMaterial(false).then((data) => {
      if (cancel) return;
      setTipos(data);
      setCargando(false);
    });
    return () => { cancel = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTipoId("");
    setTalla("");
    setUnidades("1");
    setFecha(hoyISO());
    setProveedor("");
    setDocumento("");
    setCoste("");
    setObservaciones("");
  }, [open]);

  const tipoElegido = useMemo(
    () => tipos.find((t) => t.id === tipoId),
    [tipos, tipoId],
  );

  async function guardar() {
    if (!tipoElegido) {
      toast.error("Elige qué entra");
      return;
    }
    if (tipoElegido.requiereTalla && !talla) {
      toast.error(`Falta la talla de ${tipoElegido.nombre.toLowerCase()}`);
      return;
    }
    const cuantas = Number(unidades);
    if (!Number.isInteger(cuantas) || cuantas < 1) {
      toast.error("Las unidades tienen que ser un número entero de al menos 1");
      return;
    }
    if (!proveedor.trim()) {
      toast.error("Pon el proveedor");
      return;
    }
    if (!documento.trim()) {
      toast.error("Pon el nº de albarán o factura");
      return;
    }
    // La coma decimal es lo que escribe la gente aquí; el número la lleva punto.
    const costeNum = Number(coste.replace(",", "."));
    if (!coste.trim() || !Number.isFinite(costeNum) || costeNum < 0) {
      toast.error("Pon el coste por unidad");
      return;
    }

    setGuardando(true);
    const res = await registrarEntradaMaterial({
      tipoId: tipoElegido.id,
      talla: tipoElegido.requiereTalla ? talla : null,
      unidades: cuantas,
      fecha,
      proveedor: proveedor.trim(),
      documentoReferencia: documento.trim(),
      costeUnitario: costeNum,
      observaciones: observaciones.trim() || null,
    });
    setGuardando(false);
    if (!res.ok) { toast.error(res.error); return; }

    toast.success(
      cuantas === 1 ? "Una unidad más en el almacén" : `${cuantas} unidades más en el almacén`,
    );
    onOpenChange(false);
    onHecho();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entrada de material</DialogTitle>
          <DialogDescription>
            Material que entra en el almacén y todavía no tiene dueño.
          </DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : tipos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No hay tipos de material configurados todavía. Créalos desde el
            engranaje de la barra de herramientas.
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
              <div className="space-y-2">
                <Label htmlFor="entrada-tipo">Qué entra</Label>
                <Select
                  value={tipoId}
                  onValueChange={(v) => { setTipoId(v); setTalla(""); }}
                >
                  <SelectTrigger id="entrada-tipo">
                    <SelectValue placeholder="Selecciona…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex items-center gap-2">
                          {t.categoria === "uniforme" ? (
                            <Shirt className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {t.nombre}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {tipoElegido?.requiereTalla && (
                <div className="space-y-2">
                  <Label htmlFor="entrada-talla">Talla</Label>
                  <Select value={talla} onValueChange={setTalla}>
                    <SelectTrigger id="entrada-talla" className="w-24">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {TALLAS_ROPA.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="entrada-unidades">Unidades</Label>
                <Input
                  id="entrada-unidades"
                  type="number"
                  min={1}
                  step={1}
                  value={unidades}
                  onChange={(e) => setUnidades(e.target.value)}
                  className="w-24"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entrada-fecha">Fecha</Label>
                <SelectorFecha
                  id="entrada-fecha"
                  value={fecha}
                  onChange={setFecha}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entrada-proveedor">Proveedor</Label>
                <Input
                  id="entrada-proveedor"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entrada-documento">Nº de albarán o factura</Label>
                <Input
                  id="entrada-documento"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entrada-coste">Coste por unidad</Label>
                <Input
                  id="entrada-coste"
                  inputMode="decimal"
                  value={coste}
                  onChange={(e) => setCoste(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Permite saber cuánto cuesta lo que se pierde.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entrada-observaciones">Observaciones</Label>
              <Textarea
                id="entrada-observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Opcional"
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || cargando || tipos.length === 0}>
            {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
