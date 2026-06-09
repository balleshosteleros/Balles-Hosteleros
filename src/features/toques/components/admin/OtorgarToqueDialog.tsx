"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { otorgarToqueManual } from "@/features/toques/actions/toques-actions";

type Row = Record<string, unknown>;

interface Empleado {
  userId: string;
  nombre: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresaId: string;
  onOtorgado: () => void;
}

export function OtorgarToqueDialog({ open, onOpenChange, empresaId, onOtorgado }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [toques, setToques] = useState<number>(1);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !empresaId) return;
    void supabase
      .from("usuarios")
      .select("user_id, full_name, nombre")
      .eq("empresa_id", empresaId)
      .order("full_name", { ascending: true })
      .then(({ data }) => {
        setEmpleados(
          ((data ?? []) as Row[]).map((r) => ({
            userId: String(r.user_id),
            nombre: String(r.full_name ?? r.nombre ?? "—"),
          }))
        );
      });
  }, [open, empresaId, supabase]);

  const handleEnviar = async () => {
    setError(null);
    if (!userId) {
      setError("Selecciona un empleado");
      return;
    }
    if (!motivo.trim()) {
      setError("El motivo es obligatorio");
      return;
    }
    if (toques === 0) {
      setError("Los points no pueden ser 0");
      return;
    }
    setBusy(true);
    const res = await otorgarToqueManual({ userId, toques, motivo });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setUserId("");
    setToques(1);
    setMotivo("");
    onOtorgado();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Otorgar points manualmente</DialogTitle>
          <DialogDescription>
            Bonus o ajuste discrecional. Queda registrado con tu nombre como otorgante.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Empleado</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecciona empleado…" />
              </SelectTrigger>
              <SelectContent>
                {empleados.map((e) => (
                  <SelectItem key={e.userId} value={e.userId}>
                    {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="toques-input" className="text-xs">
              Points (negativo permitido para ajustes)
            </Label>
            <Input
              id="toques-input"
              type="number"
              className="mt-1"
              value={toques}
              onChange={(e) => setToques(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="motivo-otorgar" className="text-xs">
              Motivo
            </Label>
            <Textarea
              id="motivo-otorgar"
              className="mt-1"
              rows={3}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: cobertura voluntaria un domingo"
            />
          </div>
          {error && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-2.5">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
            Otorgar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
