"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { crearInspectorManual } from "../actions";
import { normalizarNombre } from "../data";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const HORARIO_OPCIONES = [
  "Mañanas entre semana",
  "Tardes entre semana",
  "Fines de semana",
  "Festivos",
] as const;

export function InspectorFormDialog({ open, onOpenChange, onCreated }: Props) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [horarios, setHorarios] = useState<string[]>([]);
  const [vehiculo, setVehiculo] = useState<"si" | "no" | "">("");
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleHorario(opt: string) {
    setHorarios((prev) =>
      prev.includes(opt) ? prev.filter((h) => h !== opt) : [...prev, opt],
    );
  }

  function reset() {
    setNombre("");
    setApellidos("");
    setEmail("");
    setTelefono("");
    setCiudad("");
    setHorarios([]);
    setVehiculo("");
    setNotas("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (horarios.length === 0) {
      setError("Selecciona al menos una disponibilidad horaria.");
      return;
    }
    if (vehiculo === "") {
      setError("Indica si tiene vehículo propio.");
      return;
    }
    setSaving(true);
    const res = await crearInspectorManual({
      nombre,
      apellidos,
      email,
      telefono,
      ciudad,
      horario_disponibilidad: horarios.join(", "),
      vehiculo_propio: vehiculo === "si",
      notas: notas || null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    reset();
    onOpenChange(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo inspector</DialogTitle>
          <DialogDescription>
            Alta manual. Para inscripciones desde la web pública, comparte el
            enlace de la bolsa con la persona.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onBlur={() => setNombre((v) => normalizarNombre(v))}
                required
              />
            </div>
            <div>
              <Label className="text-xs">Apellidos *</Label>
              <Input
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                onBlur={() => setApellidos((v) => normalizarNombre(v))}
                required
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Teléfono *</Label>
            <Input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+34 ..."
              required
            />
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="text-xs">Ciudad *</Label>
            <Input
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="text-xs">Disponibilidad horaria *</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {HORARIO_OPCIONES.map((opt) => {
                const selected = horarios.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleHorario(opt)}
                    className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="text-xs">Vehículo propio *</Label>
            <div className="flex gap-2 mt-1">
              {(["si", "no"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setVehiculo(opt)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    vehiculo === opt
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {opt === "si" ? "Sí" : "No"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
