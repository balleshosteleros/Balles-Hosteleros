"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LabelConRegla } from "@/components/forms/LabelConRegla";
import { BotonesGuardarBorrador } from "@/components/forms/BotonesGuardarBorrador";
import { useReglasSubmodulo } from "@/features/ajustes/hooks/use-reglas-submodulo";
import { ValidacionFaltantesDialog } from "@/features/ajustes/components/ValidacionFaltantesDialog";
import { createContacto } from "@/features/contabilidad/actions/contabilidad-actions";

const TIPOS_CONTACTO = ["Cliente", "Acreedor", "Empresa", "Particular"] as const;

interface NuevoContactoDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}

/**
 * Diálogo manual "Nuevo contacto" para contabilidad.
 *
 * Sigue la regla "datos completos": el botón "Crear contacto" se bloquea
 * mientras falten campos exigidos por el modo activo del catálogo. Si el
 * usuario aún no tiene toda la info, puede pulsar "Guardar borrador" y
 * volver a completarlo más tarde.
 */
export function NuevoContactoDialog({
  open,
  onOpenChange,
  onCreated,
}: NuevoContactoDialogProps) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<string>("Cliente");
  const [nif, setNif] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [faltantes, setFaltantes] = useState<string[]>([]);

  const { validar, admiteBorrador } = useReglasSubmodulo(
    "contabilidad",
    "contactos",
  );

  const formValues = { nombre, tipo, nif, email, telefono, direccion };
  const { labelsFaltantes } = validar(formValues);

  const reset = () => {
    setNombre("");
    setTipo("Cliente");
    setNif("");
    setEmail("");
    setTelefono("");
    setDireccion("");
    setNotas("");
  };

  const guardar = async (esBorrador: boolean) => {
    if (!esBorrador && labelsFaltantes.length > 0) {
      setFaltantes(labelsFaltantes);
      return;
    }
    if (esBorrador && !nombre.trim()) {
      toast.error("Necesitas al menos el nombre para guardar el borrador");
      return;
    }
    setLoading(true);
    try {
      const res = await createContacto({
        nombre: nombre.trim(),
        tipo: esBorrador ? `${tipo} (borrador)` : tipo,
        nif: nif.trim() || undefined,
        email: email.trim() || undefined,
        telefono: telefono.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error || "Error al crear contacto");
        return;
      }
      toast.success(
        esBorrador ? "Contacto guardado como borrador" : "Contacto creado",
      );
      reset();
      onOpenChange(false);
      onCreated?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo contacto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <LabelConRegla
                  moduloKey="contabilidad"
                  submoduloKey="contactos"
                  campoKey="nombre"
                  htmlFor="contacto-nombre"
                >
                  Nombre o razón social
                </LabelConRegla>
                <Input
                  id="contacto-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <LabelConRegla
                  moduloKey="contabilidad"
                  submoduloKey="contactos"
                  campoKey="tipo"
                  htmlFor="contacto-tipo"
                >
                  Tipo
                </LabelConRegla>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger id="contacto-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CONTACTO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <LabelConRegla
                  moduloKey="contabilidad"
                  submoduloKey="contactos"
                  campoKey="nif"
                  htmlFor="contacto-nif"
                >
                  NIF / CIF
                </LabelConRegla>
                <Input
                  id="contacto-nif"
                  value={nif}
                  onChange={(e) => setNif(e.target.value.toUpperCase())}
                  placeholder="B12345678"
                />
              </div>

              <div className="space-y-1.5">
                <LabelConRegla
                  moduloKey="contabilidad"
                  submoduloKey="contactos"
                  campoKey="email"
                  htmlFor="contacto-email"
                >
                  Email
                </LabelConRegla>
                <Input
                  id="contacto-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <LabelConRegla
                  moduloKey="contabilidad"
                  submoduloKey="contactos"
                  campoKey="telefono"
                  htmlFor="contacto-tel"
                >
                  Teléfono
                </LabelConRegla>
                <Input
                  id="contacto-tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <LabelConRegla
                  moduloKey="contabilidad"
                  submoduloKey="contactos"
                  campoKey="direccion"
                  htmlFor="contacto-dir"
                >
                  Dirección fiscal
                </LabelConRegla>
                <Input
                  id="contacto-dir"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Calle, número, ciudad, CP"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="contacto-notas">Notas internas</Label>
                <Textarea
                  id="contacto-notas"
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <BotonesGuardarBorrador
              onGuardar={() => void guardar(false)}
              onGuardarBorrador={() => void guardar(true)}
              faltantes={labelsFaltantes}
              loading={loading}
              labelGuardar="Crear contacto"
              admiteBorrador={admiteBorrador}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ValidacionFaltantesDialog
        open={faltantes.length > 0}
        onClose={() => setFaltantes([])}
        campos={faltantes}
        submoduloLabel="Contactos"
      />
    </>
  );
}
