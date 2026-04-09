import { useState } from "react";
import type { ProcesoJuridico, EstadoProceso, GravedadProceso, TipoProceso } from "@/data/procesos-juridicos";
import { ESTADOS_PROCESO, GRAVEDADES_PROCESO, TIPOS_PROCESO, JURIDICOS } from "@/data/procesos-juridicos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (item: ProcesoJuridico) => void;
  item?: ProcesoJuridico | null;
  empresa: string;
  empresaId: string;
}

export function ProcesoModal({ open, onClose, onSave, item, empresa, empresaId }: Props) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    titulo: item?.titulo ?? "",
    tipo: item?.tipo ?? TIPOS_PROCESO[0],
    juridico: item?.juridico ?? JURIDICOS[0],
    fecha: item?.fecha ?? new Date().toISOString().slice(0, 10),
    estado: item?.estado ?? ("PENDIENTE" as EstadoProceso),
    gravedad: item?.gravedad ?? ("LEVE" as GravedadProceso),
    descripcion: item?.descripcion ?? "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    onSave({
      id: item?.id ?? crypto.randomUUID(),
      ...form,
      empresa,
      empresaId,
      documentos: item?.documentos ?? [],
      actualizaciones: item?.actualizaciones ?? [],
    } as ProcesoJuridico);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{isEdit ? "EDITAR EXPEDIENTE" : "NUEVO EXPEDIENTE"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="col-span-2">
            <Label>TÍTULO DEL EXPEDIENTE</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Asunto principal del proceso…" />
          </div>
          <div>
            <Label>TIPO DE PROCESO</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS_PROCESO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>JURÍDICO RESPONSABLE</Label>
            <Select value={form.juridico} onValueChange={(v) => set("juridico", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{JURIDICOS.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>ESTADO</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ESTADOS_PROCESO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>GRAVEDAD</Label>
            <Select value={form.gravedad} onValueChange={(v) => set("gravedad", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GRAVEDADES_PROCESO.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>FECHA DE APERTURA</Label>
            <Input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>DESCRIPCIÓN DEL CASO</Label>
            <Textarea value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} rows={3} placeholder="Descripción detallada…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>CANCELAR</Button>
          <Button onClick={handleSave}>{isEdit ? "GUARDAR CAMBIOS" : "CREAR EXPEDIENTE"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
