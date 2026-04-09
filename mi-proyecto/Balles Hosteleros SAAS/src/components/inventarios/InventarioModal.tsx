import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ALMACENES_INVENTARIO,
  type TipoInventario,
  type PlantillaInventario,
} from "@/data/inventarios";

const NONE = "__NONE__";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipos: TipoInventario[];
  plantillas: PlantillaInventario[];
  usuarioNombre: string;
  onCreate: (data: {
    fecha: string;
    almacen: string;
    motivo: string;
    tipoId?: string;
    plantillaId?: string;
  }) => void;
}

export default function InventarioModal({ open, onOpenChange, tipos, plantillas, usuarioNombre, onCreate }: Props) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [almacen, setAlmacen] = useState(ALMACENES_INVENTARIO[0]);
  const [tipoId, setTipoId] = useState<string>(tipos[0]?.id || "");
  const [plantillaId, setPlantillaId] = useState<string>(NONE);
  const [motivoManual, setMotivoManual] = useState("");

  const plantillaSeleccionada = plantillaId !== NONE ? plantillas.find((p) => p.id === plantillaId) : undefined;
  const tipoSeleccionado = tipos.find((t) => t.id === tipoId);

  // If plantilla is selected, the motivo is the plantilla name; otherwise manual or tipo name
  const motivoFinal = plantillaSeleccionada
    ? plantillaSeleccionada.nombre
    : (motivoManual.trim() || tipoSeleccionado?.nombre || "Sin motivo");

  const handleCreate = () => {
    onCreate({
      fecha,
      almacen,
      motivo: motivoFinal,
      tipoId: tipoId || undefined,
      plantillaId: plantillaSeleccionada ? plantillaSeleccionada.id : undefined,
    });
    onOpenChange(false);
    // Reset
    setFecha(new Date().toISOString().slice(0, 10));
    setPlantillaId(NONE);
    setMotivoManual("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo inventario</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Fecha retroactiva */}
          <div>
            <Label className="text-xs font-bold">Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-0.5">Puedes seleccionar una fecha anterior si es necesario.</p>
          </div>

          {/* Almacén simplificado */}
          <div>
            <Label className="text-xs font-bold">Almacén</Label>
            <Select value={almacen} onValueChange={setAlmacen}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALMACENES_INVENTARIO.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de inventario */}
          {tipos.length > 0 && (
            <div>
              <Label className="text-xs font-bold">Tipo de inventario</Label>
              <Select value={tipoId} onValueChange={setTipoId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Plantilla prefijada */}
          <div>
            <Label className="text-xs font-bold">Plantilla prefijada</Label>
            <Select value={plantillaId} onValueChange={setPlantillaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin plantilla (inventario libre)</SelectItem>
                {plantillas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} ({p.productosIds.length} productos)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {plantillaSeleccionada && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                ⚠ Se deberán contar obligatoriamente los {plantillaSeleccionada.productosIds.length} productos de esta plantilla para poder confirmar.
              </p>
            )}
          </div>

          {/* Motivo manual (solo si no hay plantilla) */}
          {!plantillaSeleccionada && (
            <div>
              <Label className="text-xs font-bold">Nombre / Motivo</Label>
              <Input
                value={motivoManual}
                onChange={(e) => setMotivoManual(e.target.value)}
                placeholder={tipoSeleccionado?.nombre || "Describe el motivo..."}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Opcional. Si lo dejas vacío se usará el tipo de inventario.</p>
            </div>
          )}

          {/* Usuario automático */}
          <div>
            <Label className="text-xs font-bold">Creado por</Label>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">{usuarioNombre}</Badge>
              <span className="text-[10px] text-muted-foreground">(automático según sesión)</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate}>Crear inventario</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
