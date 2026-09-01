"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  TICKET_COBRO_MODO_LABELS,
  TICKET_MODO_PRECIO_LABELS,
  TICKET_STOCK_MODO_LABELS,
  validarTicketInput,
  type ReservaTicketProducto,
  type ReservaTicketProductoInput,
  type TicketCobroModo,
  type TicketModoPrecio,
  type TicketStockModo,
} from "@/features/sala/data/ticket-productos";
import {
  TicketCondicionesPanel,
  type CondicionesState,
} from "./TicketCondicionesPanel";
import {
  createTicketProducto,
  updateTicketProducto,
} from "@/features/sala/actions/ticket-productos-actions";

interface Props {
  producto: ReservaTicketProducto | null;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  nombre: string;
  descripcion: string;
  precio: string;
  iva: string;
  modoPrecio: TicketModoPrecio;
  comentarios: string;
  stockModo: TicketStockModo;
  stockTotal: string;
  ocultarAlAgotar: boolean;
  activo: boolean;
  cobroModo: TicketCobroModo;
  ventaPublica: boolean;
  validezDias: string;
  canjeHasta: string;
  condiciones: CondicionesState;
}

function toState(p: ReservaTicketProducto | null): FormState {
  return {
    nombre: p?.nombre ?? "",
    descripcion: p?.descripcion ?? "",
    precio: p ? String(p.precio) : "",
    iva: p ? String(p.iva) : "10",
    modoPrecio: p?.modoPrecio ?? "por_persona",
    comentarios: p?.comentarios ?? "",
    stockModo: p?.stockModo ?? "ilimitado",
    stockTotal: p?.stockTotal != null ? String(p.stockTotal) : "",
    ocultarAlAgotar: p?.ocultarAlAgotar ?? true,
    activo: p?.activo ?? true,
    cobroModo: p?.cobroModo ?? "revolut",
    ventaPublica: p?.ventaPublica ?? true,
    validezDias: p?.validezDias != null ? String(p.validezDias) : "",
    canjeHasta: p?.canjeHasta ?? "",
    condiciones: {
      diasSemana: p?.diasSemana ?? [],
      diasExcluidos: p?.diasExcluidos ?? [],
      turnos: p?.turnos ?? [],
      horaDesde: p?.horaDesde ?? "",
      horaHasta: p?.horaHasta ?? "",
      horasExcluidas: p?.horasExcluidas ?? [],
      grupoZonaIds: p?.grupoZonaIds ?? [],
    },
  };
}

export function TicketProductoForm({ producto, onSaved, onCancel }: Props) {
  const [s, setS] = useState<FormState>(() => toState(producto));
  const [saving, setSaving] = useState(false);

  const input: ReservaTicketProductoInput = useMemo(() => ({
    nombre: s.nombre,
    descripcion: s.descripcion.trim() || null,
    precio: Number(s.precio.replace(",", ".")),
    iva: Number(s.iva.replace(",", ".")),
    modoPrecio: s.modoPrecio,
    comentarios: s.comentarios.trim() || null,
    stockModo: s.stockModo,
    stockTotal: s.stockModo === "limitado" ? Number(s.stockTotal) : null,
    ocultarAlAgotar: s.ocultarAlAgotar,
    activo: s.activo,
    cobroModo: s.cobroModo,
    ventaPublica: s.ventaPublica,
    validezDias: s.validezDias.trim() ? Number(s.validezDias) : null,
    canjeHasta: s.canjeHasta || null,
    diasSemana: s.condiciones.diasSemana,
    diasExcluidos: s.condiciones.diasExcluidos,
    turnos: s.condiciones.turnos,
    horaDesde: s.condiciones.horaDesde || null,
    horaHasta: s.condiciones.horaHasta || null,
    horasExcluidas: s.condiciones.horasExcluidas,
    grupoZonaIds: s.condiciones.grupoZonaIds,
  }), [s]);

  const validation = validarTicketInput(input);
  const valido = validation.ok;
  const errorMsg = validation.ok ? null : validation.error;

  async function handleSubmit() {
    if (!valido) {
      toast.error(errorMsg ?? "Revisa los campos");
      return;
    }
    setSaving(true);
    try {
      const r = producto
        ? await updateTicketProducto(producto.id, input)
        : await createTicketProducto(input);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo guardar");
        return;
      }
      toast.success(producto ? "Producto actualizado" : "Producto creado");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Nombre del producto *</Label>
        <Input
          value={s.nombre}
          onChange={(e) => setS({ ...s, nombre: e.target.value })}
          placeholder="Cena Nochevieja, Brunch domingo, …"
          className="h-9"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descripción</Label>
        <Input
          value={s.descripcion}
          onChange={(e) => setS({ ...s, descripcion: e.target.value })}
          placeholder="Resumen corto que verá el cliente al elegir"
          className="h-9"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Precio *</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={s.precio}
            onChange={(e) => setS({ ...s, precio: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">IVA (%) *</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.5"
            value={s.iva}
            onChange={(e) => setS({ ...s, iva: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Modo de precio *</Label>
          <Select
            value={s.modoPrecio}
            onValueChange={(v) => setS({ ...s, modoPrecio: v as TicketModoPrecio })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TICKET_MODO_PRECIO_LABELS) as TicketModoPrecio[]).map((m) => (
                <SelectItem key={m} value={m}>{TICKET_MODO_PRECIO_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Cómo se cobra ──────────────────────────────────── */}
      <div className="rounded-md border p-3 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Cobro *</Label>
          <Select
            value={s.cobroModo}
            onValueChange={(v) => setS({ ...s, cobroModo: v as TicketCobroModo })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TICKET_COBRO_MODO_LABELS) as TicketCobroModo[]).map((m) => (
                <SelectItem key={m} value={m}>{TICKET_COBRO_MODO_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground">
            {s.cobroModo === "revolut"
              ? "El cliente paga con tarjeta antes de recibir su código. Requiere tener el cobro configurado en la pestaña Cobro."
              : "No se cobra nada: el cliente recibe el código directamente."}
          </p>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-md border p-3">
          <div className="space-y-0.5">
            <Label className="text-xs font-medium" htmlFor="venta-publica">
              A la venta
            </Label>
            <p className="text-[10px] text-muted-foreground">
              Aparece en la tienda para que el cliente lo compre por su cuenta.
              Si lo desactivas, solo se puede usar desde el motor de reservas.
            </p>
          </div>
          <Switch
            id="venta-publica"
            checked={s.ventaPublica}
            onCheckedChange={(v) => setS({ ...s, ventaPublica: Boolean(v) })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Días para canjear</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={s.validezDias}
              onChange={(e) => setS({ ...s, validezDias: e.target.value })}
              placeholder="Sin límite"
              className="h-9"
            />
            <p className="text-[10px] text-muted-foreground">
              Desde la compra. Vacío: el código no caduca.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">O fecha límite</Label>
            <Input
              type="date"
              value={s.canjeHasta}
              onChange={(e) => setS({ ...s, canjeHasta: e.target.value })}
              className="h-9"
            />
            <p className="text-[10px] text-muted-foreground">
              Manda sobre los días de arriba.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Comentarios (uso interno)</Label>
        <Textarea
          value={s.comentarios}
          onChange={(e) => setS({ ...s, comentarios: e.target.value })}
          placeholder="Notas para el equipo: instrucciones, condiciones, etc."
          rows={3}
          className="text-sm"
        />
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Stock</Label>
            <Select
              value={s.stockModo}
              onValueChange={(v) => setS({ ...s, stockModo: v as TicketStockModo })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TICKET_STOCK_MODO_LABELS) as TicketStockModo[]).map((m) => (
                  <SelectItem key={m} value={m}>{TICKET_STOCK_MODO_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {s.stockModo === "limitado" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Stock total *</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={s.stockTotal}
                onChange={(e) => setS({ ...s, stockTotal: e.target.value })}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                {s.modoPrecio === "por_persona"
                  ? "Se resta una unidad por cada comensal en la reserva."
                  : "Se resta una unidad por cada reserva, sin importar comensales."}
              </p>
            </div>
          )}
        </div>

        {s.stockModo === "limitado" && (
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium" htmlFor="ocultar-agotar">
                Ocultar al agotar
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Cuando se vende todo el stock, el producto desaparece del listado público.
                Si está desactivado, sigue visible con badge «Agotado» sin permitir compra.
              </p>
            </div>
            <Switch
              id="ocultar-agotar"
              checked={s.ocultarAlAgotar}
              onCheckedChange={(v) => setS({ ...s, ocultarAlAgotar: Boolean(v) })}
            />
          </div>
        )}
      </div>

      {/* ── Condiciones de canje ───────────────────────────── */}
      <div className="rounded-md border p-3 space-y-3">
        <div>
          <Label className="text-xs font-medium">Condiciones de canje</Label>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Cuando el cliente use su código, el motor de reservas solo le dejará
            elegir lo que cumpla estas condiciones. Lo que dejes vacío no restringe.
          </p>
        </div>
        <TicketCondicionesPanel
          value={s.condiciones}
          onChange={(c) => setS({ ...s, condiciones: c })}
        />
      </div>

      <div className="flex items-start justify-between gap-3 rounded-md border p-3">
        <div className="space-y-0.5">
          <Label className="text-xs font-medium" htmlFor="activo">
            Activo
          </Label>
          <p className="text-[10px] text-muted-foreground">
            Si está desactivado no se ofrece en el flujo de reserva.
          </p>
        </div>
        <Switch
          id="activo"
          checked={s.activo}
          onCheckedChange={(v) => setS({ ...s, activo: Boolean(v) })}
        />
      </div>

      {!valido && errorMsg && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!valido || saving}>
          {saving ? "Guardando…" : producto ? "Guardar" : "Crear producto"}
        </Button>
      </div>
    </div>
  );
}
