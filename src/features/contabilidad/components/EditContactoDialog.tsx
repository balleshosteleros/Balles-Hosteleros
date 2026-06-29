"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { EtiquetasInput } from "@/features/contabilidad/components/EtiquetasInput";
import {
  updateContacto,
  deleteContacto,
} from "@/features/contabilidad/actions/contabilidad-actions";
import type { ContactoContable } from "@/features/contabilidad/data/contabilidad";

const TIPOS_CONTACTO = ["Cliente", "Acreedor", "Empresa", "Particular"] as const;

const SUFIJO_BORRADOR = /\s*\(borrador\)\s*$/i;
const tipoBase = (t: string) => t.replace(SUFIJO_BORRADOR, "").trim() || "Cliente";

interface EditContactoDialogProps {
  contacto: ContactoContable | null;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

/**
 * Ficha de un contacto de contabilidad: muestra los datos guardados y permite
 * editarlos o eliminar el registro. Se abre al pulsar una fila en la lista.
 *
 * Mantiene la regla "datos completos": "Guardar" se bloquea mientras falten
 * campos exigidos; el contacto incompleto puede quedar como borrador.
 */
export function EditContactoDialog({
  contacto,
  onOpenChange,
  onSaved,
}: EditContactoDialogProps) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<string>("Cliente");
  const [nif, setNif] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [categoria, setCategoria] = useState("");
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [faltantes, setFaltantes] = useState<string[]>([]);

  const { validar, admiteBorrador } = useReglasSubmodulo(
    "contabilidad",
    "contactos",
  );
  const { confirm, dialog: confirmDialog } = useConfirmDelete();

  // Carga los datos del contacto cada vez que se abre la ficha.
  useEffect(() => {
    if (!contacto) return;
    setNombre(contacto.nombre ?? "");
    setTipo(tipoBase(contacto.tipo ?? "Cliente"));
    setNif(contacto.documento ?? "");
    setEmail(contacto.email ?? "");
    setTelefono(contacto.telefono ?? "");
    setDireccion(contacto.direccion ?? "");
    setNotas(contacto.notas ?? "");
    setCategoria(contacto.categoria ?? "");
    setEtiquetas(contacto.etiquetas ?? []);
  }, [contacto]);

  const formValues = { nombre, tipo, nif, email, telefono, direccion };
  const { labelsFaltantes } = validar(formValues);

  const guardar = async (esBorrador: boolean) => {
    if (!contacto) return;
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
      const res = await updateContacto(contacto.id, {
        nombre: nombre.trim(),
        tipo: esBorrador ? `${tipo} (borrador)` : tipo,
        nif: nif.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        notas: notas.trim(),
        categoria: categoria.trim(),
        etiquetas,
      });
      if (!res.ok) {
        toast.error(res.error || "Error al guardar el contacto");
        return;
      }
      toast.success(esBorrador ? "Contacto guardado como borrador" : "Contacto actualizado");
      onOpenChange(false);
      onSaved?.();
    } finally {
      setLoading(false);
    }
  };

  const eliminar = async () => {
    if (!contacto) return;
    const ok = await confirm({
      title: "¿Eliminar contacto?",
      description: `Se eliminará "${contacto.nombre}" de forma permanente.`,
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    setLoading(true);
    try {
      const res = await deleteContacto(contacto.id);
      if (!res.ok) {
        toast.error(res.error || "Error al eliminar el contacto");
        return;
      }
      toast.success("Contacto eliminado");
      onOpenChange(false);
      onSaved?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={contacto !== null} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ficha de contacto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <LabelConRegla
                  moduloKey="contabilidad"
                  submoduloKey="contactos"
                  campoKey="nombre"
                  htmlFor="edit-contacto-nombre"
                >
                  Nombre o razón social
                </LabelConRegla>
                <Input
                  id="edit-contacto-nombre"
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
                  htmlFor="edit-contacto-tipo"
                >
                  Tipo
                </LabelConRegla>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger id="edit-contacto-tipo">
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
                  htmlFor="edit-contacto-nif"
                >
                  NIF / CIF
                </LabelConRegla>
                <Input
                  id="edit-contacto-nif"
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
                  htmlFor="edit-contacto-email"
                >
                  Email
                </LabelConRegla>
                <Input
                  id="edit-contacto-email"
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
                  htmlFor="edit-contacto-tel"
                >
                  Teléfono
                </LabelConRegla>
                <Input
                  id="edit-contacto-tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <LabelConRegla
                  moduloKey="contabilidad"
                  submoduloKey="contactos"
                  campoKey="direccion"
                  htmlFor="edit-contacto-dir"
                >
                  Dirección fiscal
                </LabelConRegla>
                <Input
                  id="edit-contacto-dir"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Calle, número, ciudad, CP"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-contacto-categoria">Categoría</Label>
                <Input
                  id="edit-contacto-categoria"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  placeholder="Proveedor, Servicios, Asesoría…"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Etiquetas</Label>
                <EtiquetasInput value={etiquetas} onChange={setEtiquetas} />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-contacto-notas">Notas internas</Label>
                <Textarea
                  id="edit-contacto-notas"
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => void eliminar()}
              disabled={loading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Eliminar
            </Button>
            <BotonesGuardarBorrador
              onGuardar={() => void guardar(false)}
              onGuardarBorrador={() => void guardar(true)}
              faltantes={labelsFaltantes}
              loading={loading}
              labelGuardar="Guardar"
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

      {confirmDialog}
    </>
  );
}
