"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { EmpresaReservasExcepcion } from "@/features/sala/data/reservas";
import {
  createExcepcion,
  updateExcepcion,
  deleteExcepcion,
} from "@/features/sala/actions/reservas-excepciones-actions";

interface Props {
  excepciones: EmpresaReservasExcepcion[];
  onChange: () => void;
}

interface BorradorExcepcion {
  fecha: string;
  motivo: string;
  cupoComida: string;
  cupoCena: string;
  maxpaxComida: string;
  maxpaxCena: string;
}

const VACIO: BorradorExcepcion = {
  fecha: "",
  motivo: "",
  cupoComida: "",
  cupoCena: "",
  maxpaxComida: "",
  maxpaxCena: "",
};

function parseNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function ExcepcionesTabla({ excepciones, onChange }: Props) {
  const [borrador, setBorrador] = useState<BorradorExcepcion>(VACIO);
  const [creando, setCreando] = useState(false);

  async function handleCreate() {
    if (!borrador.fecha) {
      toast.error("La fecha es obligatoria");
      return;
    }
    const algunValor =
      parseNum(borrador.cupoComida) != null ||
      parseNum(borrador.cupoCena) != null ||
      parseNum(borrador.maxpaxComida) != null ||
      parseNum(borrador.maxpaxCena) != null;
    if (!algunValor) {
      toast.error("Indica al menos un cupo o máximo de personas");
      return;
    }
    setCreando(true);
    const res = await createExcepcion({
      fecha: borrador.fecha,
      motivo: borrador.motivo.trim() || null,
      cupoComida: parseNum(borrador.cupoComida),
      cupoCena: parseNum(borrador.cupoCena),
      maxpaxComida: parseNum(borrador.maxpaxComida),
      maxpaxCena: parseNum(borrador.maxpaxCena),
    });
    setCreando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo crear");
      return;
    }
    toast.success("Excepción añadida");
    setBorrador(VACIO);
    onChange();
  }

  async function handleUpdate(
    id: string,
    campo: keyof EmpresaReservasExcepcion,
    valor: number | string | null,
  ) {
    const updates: Record<string, unknown> = {};
    if (campo === "fecha") updates.fecha = valor;
    if (campo === "motivo") updates.motivo = valor;
    if (campo === "cupoComida") updates.cupoComida = valor;
    if (campo === "cupoCena") updates.cupoCena = valor;
    if (campo === "maxpaxComida") updates.maxpaxComida = valor;
    if (campo === "maxpaxCena") updates.maxpaxCena = valor;
    const res = await updateExcepcion(id, updates);
    if (!res.ok) toast.error(res.error ?? "No se pudo actualizar");
    else onChange();
  }

  async function handleDelete(id: string) {
    const res = await deleteExcepcion(id);
    if (!res.ok) toast.error(res.error ?? "No se pudo borrar");
    else {
      toast.success("Excepción borrada");
      onChange();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold mb-2">Excepciones por fecha</h4>
        <p className="text-xs text-muted-foreground mb-3">
          Para días señalados (San Valentín, 24/12, cierre por vacaciones…).
          Sobreescribe la regla del día de la semana.
        </p>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium w-32">Fecha</th>
              <th className="text-left p-2 font-medium">Motivo</th>
              <th className="p-2 font-medium w-20">☀️ Cupo</th>
              <th className="p-2 font-medium w-20">🌙 Cupo</th>
              <th className="p-2 font-medium w-20">☀️ Máx pax</th>
              <th className="p-2 font-medium w-20">🌙 Máx pax</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {excepciones.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-1">
                  <Input
                    type="date"
                    defaultValue={e.fecha}
                    onBlur={(ev) => {
                      if (ev.target.value && ev.target.value !== e.fecha) {
                        handleUpdate(e.id, "fecha", ev.target.value);
                      }
                    }}
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <Input
                    defaultValue={e.motivo ?? ""}
                    placeholder="(opcional)"
                    onBlur={(ev) =>
                      ev.target.value !== (e.motivo ?? "") &&
                      handleUpdate(e.id, "motivo", ev.target.value || null)
                    }
                    className="h-8 text-xs"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    defaultValue={e.cupoComida ?? ""}
                    onBlur={(ev) =>
                      handleUpdate(
                        e.id,
                        "cupoComida",
                        ev.target.value === "" ? null : Number(ev.target.value),
                      )
                    }
                    className="h-8 text-xs text-center"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    defaultValue={e.cupoCena ?? ""}
                    onBlur={(ev) =>
                      handleUpdate(
                        e.id,
                        "cupoCena",
                        ev.target.value === "" ? null : Number(ev.target.value),
                      )
                    }
                    className="h-8 text-xs text-center"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    defaultValue={e.maxpaxComida ?? ""}
                    onBlur={(ev) =>
                      handleUpdate(
                        e.id,
                        "maxpaxComida",
                        ev.target.value === "" ? null : Number(ev.target.value),
                      )
                    }
                    className="h-8 text-xs text-center"
                  />
                </td>
                <td className="p-1">
                  <Input
                    type="number"
                    min={0}
                    defaultValue={e.maxpaxCena ?? ""}
                    onBlur={(ev) =>
                      handleUpdate(
                        e.id,
                        "maxpaxCena",
                        ev.target.value === "" ? null : Number(ev.target.value),
                      )
                    }
                    className="h-8 text-xs text-center"
                  />
                </td>
                <td className="p-1 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(e.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {excepciones.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground text-xs">
                  Sin excepciones. Añade una abajo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border rounded-md p-3 bg-muted/30 space-y-2">
        <div className="text-xs font-medium">Añadir excepción</div>
        <div className="grid grid-cols-7 gap-2">
          <Input
            type="date"
            value={borrador.fecha}
            onChange={(e) => setBorrador({ ...borrador, fecha: e.target.value })}
            className="h-8 text-xs col-span-2"
          />
          <Input
            placeholder="Motivo"
            value={borrador.motivo}
            onChange={(e) => setBorrador({ ...borrador, motivo: e.target.value })}
            className="h-8 text-xs col-span-2"
          />
          <Input
            type="number"
            min={0}
            placeholder="☀️"
            value={borrador.cupoComida}
            onChange={(e) => setBorrador({ ...borrador, cupoComida: e.target.value })}
            className="h-8 text-xs text-center"
          />
          <Input
            type="number"
            min={0}
            placeholder="🌙"
            value={borrador.cupoCena}
            onChange={(e) => setBorrador({ ...borrador, cupoCena: e.target.value })}
            className="h-8 text-xs text-center"
          />
          <Input
            type="number"
            min={0}
            placeholder="☀️Pax"
            value={borrador.maxpaxComida}
            onChange={(e) => setBorrador({ ...borrador, maxpaxComida: e.target.value })}
            className="h-8 text-xs text-center"
          />
        </div>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            min={0}
            placeholder="🌙 Máx pax"
            value={borrador.maxpaxCena}
            onChange={(e) => setBorrador({ ...borrador, maxpaxCena: e.target.value })}
            className="h-8 text-xs text-center w-32"
          />
          <Button size="sm" onClick={handleCreate} disabled={creando} className="ml-auto">
            <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
          </Button>
        </div>
      </div>
    </div>
  );
}
