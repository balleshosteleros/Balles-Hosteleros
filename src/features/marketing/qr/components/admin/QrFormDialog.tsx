"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { crearCodigoQr, editarCodigoQr } from "../../actions/qr-actions";
import type { CodigoQr } from "../../types";

export function QrFormDialog({
  open,
  onOpenChange,
  qr,
  onGuardado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** null = crear uno nuevo. */
  qr: CodigoQr | null;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [destino, setDestino] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const editando = qr !== null;

  useEffect(() => {
    if (!open) return;
    setNombre(qr?.nombre ?? "");
    setDescripcion(qr?.descripcion ?? "");
    setDestino(qr?.destino ?? "");
    setErrores({});
  }, [open, qr]);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!nombre.trim()) e.nombre = "Ponle un nombre para reconocerlo.";

    const d = destino.trim();
    if (!d) {
      e.destino = "Escribe a dónde quieres que lleve el código.";
    } else {
      try {
        const u = new URL(d);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          e.destino = "La dirección debe empezar por https://";
        }
      } catch {
        e.destino = "Esa dirección no es válida. Debe empezar por https://";
      }
    }

    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        destino: destino.trim(),
      };

      const res = editando
        ? await editarCodigoQr({ id: qr.id, ...payload })
        : await crearCodigoQr(payload);

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(editando ? "Cambios guardados" : "Código QR creado");
      onOpenChange(false);
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar código QR" : "Nuevo código QR"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "El código impreso no cambia. Solo cambia a dónde lleva."
              : "Se genera un código propio que podrás redirigir cuando quieras."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qr-nombre">Nombre</Label>
            <Input
              id="qr-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Carta del restaurante"
              aria-invalid={!!errores.nombre}
            />
            {errores.nombre ? (
              <p className="text-xs text-red-600">{errores.nombre}</p>
            ) : (
              <p className="text-xs text-gray-500">
                Solo lo ves tú, para saber qué código es cuál.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qr-destino">A dónde lleva</Label>
            <Input
              id="qr-destino"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="https://api.whatsapp.com/send/?phone=34600000000"
              aria-invalid={!!errores.destino}
            />
            {errores.destino ? (
              <p className="text-xs text-red-600">{errores.destino}</p>
            ) : (
              <p className="text-xs text-gray-500">
                Puedes cambiarlo siempre que quieras sin reimprimir el QR.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qr-desc">Notas (opcional)</Label>
            <Textarea
              id="qr-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Dónde está pegado, cuántos se imprimieron…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
