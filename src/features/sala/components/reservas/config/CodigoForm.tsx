"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  type ReservaCodigo,
  type ReservaCodigoTipoPromocion,
  type ReservaCodigoTurnos,
  type DiaSemanaKey,
  RESERVA_CODIGO_TIPO_LABELS,
  RESERVA_CODIGO_TURNOS_LABELS,
} from "@/features/sala/data/reservas";
import {
  createReservaCodigo,
  updateReservaCodigo,
  type ReservaCodigoInput,
} from "@/features/sala/actions/reserva-codigos-actions";

interface Props {
  codigo: ReservaCodigo | null;
  onSaved: () => void;
  onCancel: () => void;
}

const DIAS: { key: DiaSemanaKey; label: string }[] = [
  { key: "lun", label: "Lunes" },
  { key: "mar", label: "Martes" },
  { key: "mie", label: "Miércoles" },
  { key: "jue", label: "Jueves" },
  { key: "vie", label: "Viernes" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

const TIPOS: ReservaCodigoTipoPromocion[] = ["restaurante_contador", "grupo", "descuento"];
const TURNOS: ReservaCodigoTurnos[] = ["comida", "cena", "comida_cena"];

function hoyISO(): string {
  return new Date().toISOString().split("T")[0];
}
function plusMesesISO(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split("T")[0];
}

export function CodigoForm({ codigo, onSaved, onCancel }: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<ReservaCodigoTipoPromocion>("restaurante_contador");
  const [minPersonas, setMinPersonas] = useState(1);
  const [maxPersonas, setMaxPersonas] = useState(-1);
  const [fechaInicio, setFechaInicio] = useState(hoyISO());
  const [fechaFin, setFechaFin] = useState(plusMesesISO(3));
  const [stockTotal, setStockTotal] = useState(0);
  const [turnos, setTurnos] = useState<ReservaCodigoTurnos>("comida_cena");
  const [restriccion, setRestriccion] = useState(false);
  const [esDescuento, setEsDescuento] = useState(false);
  const [porcentaje, setPorcentaje] = useState<number | "">("");
  const [dias, setDias] = useState<DiaSemanaKey[]>([]);
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!codigo) return;
    setNombre(codigo.nombre);
    setDescripcion(codigo.descripcion ?? "");
    setTipo(codigo.tipoPromocion);
    setMinPersonas(codigo.minPersonas);
    setMaxPersonas(codigo.maxPersonas);
    setFechaInicio(codigo.fechaInicio);
    setFechaFin(codigo.fechaFin);
    setStockTotal(codigo.stockTotal);
    setTurnos(codigo.turnos);
    setRestriccion(codigo.restriccionEspecial);
    setEsDescuento(codigo.esDescuento);
    setPorcentaje(codigo.porcentajeDescuento ?? "");
    setDias(codigo.diasSemana);
    setActivo(codigo.activo);
  }, [codigo]);

  function toggleDia(d: DiaSemanaKey) {
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function handleGuardar() {
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (fechaFin < fechaInicio) {
      toast.error("La fecha fin debe ser posterior a la de inicio");
      return;
    }
    setGuardando(true);
    const payload: ReservaCodigoInput = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      tipoPromocion: tipo,
      minPersonas: Math.max(1, minPersonas),
      maxPersonas,
      fechaInicio,
      fechaFin,
      stockTotal: Math.max(0, stockTotal),
      turnos,
      restriccionEspecial: restriccion,
      esDescuento,
      porcentajeDescuento: esDescuento && typeof porcentaje === "number" ? porcentaje : null,
      diasSemana: dias,
      activo,
    };
    const res = codigo
      ? await updateReservaCodigo(codigo.id, payload)
      : await createReservaCodigo(payload);
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success(codigo ? "Código actualizado" : "Código creado");
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Nombre *</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value.toUpperCase().replace(/\s+/g, ""))}
          placeholder="RUBIACRIOLLA"
          className="h-9 font-mono"
          autoFocus
        />
        <p className="text-[10px] text-muted-foreground">Sin espacios; se guarda en MAYÚSCULAS.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Descripción</Label>
        <Textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5 sm:col-span-3">
          <Label className="text-xs">Tipo de Promoción</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as ReservaCodigoTipoPromocion)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t} value={t}>{RESERVA_CODIGO_TIPO_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Mínimo personas</Label>
          <Input
            type="number" min={1}
            value={minPersonas}
            onChange={(e) => setMinPersonas(Number(e.target.value) || 1)}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Máximo personas (-1 sin límite)</Label>
          <Input
            type="number" min={-1}
            value={maxPersonas}
            onChange={(e) => setMaxPersonas(Number(e.target.value))}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Stock disponible (0 = ilimitado)</Label>
          <Input
            type="number" min={0}
            value={stockTotal}
            onChange={(e) => setStockTotal(Number(e.target.value) || 0)}
            className="h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Fecha inicio</Label>
          <Input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Fecha fin</Label>
          <Input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Turnos disponibles</Label>
          <Select value={turnos} onValueChange={(v) => setTurnos(v as ReservaCodigoTurnos)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TURNOS.map((t) => (
                <SelectItem key={t} value={t}>{RESERVA_CODIGO_TURNOS_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox
            checked={restriccion}
            onCheckedChange={(v) => setRestriccion(Boolean(v))}
          />
          Restricción Especial
        </label>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox
            checked={esDescuento}
            onCheckedChange={(v) => setEsDescuento(Boolean(v))}
          />
          Código de Descuento
        </label>
        {esDescuento && (
          <div className="flex items-center gap-2">
            <Label className="text-xs">% descuento</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value === "" ? "" : Number(e.target.value))}
              className="h-8 w-20"
            />
          </div>
        )}
      </div>

      <div className="space-y-2 pt-1">
        <Label className="text-xs">Días de la semana activos (si no marcas ninguno, será válido todos los días)</Label>
        <div className="flex flex-wrap gap-2">
          {DIAS.map((d) => (
            <label
              key={d.key}
              className={`flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                dias.includes(d.key)
                  ? "bg-primary/10 border-primary/40"
                  : "hover:bg-muted/40"
              }`}
            >
              <Checkbox
                checked={dias.includes(d.key)}
                onCheckedChange={() => toggleDia(d.key)}
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
        <Checkbox checked={activo} onCheckedChange={(v) => setActivo(Boolean(v))} />
        Activo
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={guardando}>Cancelar</Button>
        <Button onClick={handleGuardar} disabled={guardando}>
          {guardando ? "Guardando..." : codigo ? "Guardar cambios" : "Crear código promocional"}
        </Button>
      </div>
    </div>
  );
}
