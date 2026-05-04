"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, GripVertical, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubmoduleToolbar } from "@/shared/components/SubmoduleToolbar";

interface Etiqueta {
  id: string;
  nombre: string;
}

interface CategoriaEtiquetas {
  id: string;
  nombre: string;
  emoji: string;
  etiquetas: Etiqueta[];
}

const SAMPLE_CATEGORIAS: CategoriaEtiquetas[] = [
  { id: "cat1", nombre: "Agora", emoji: "💰", etiquetas: [
    { id: "e1", nombre: "Cobros" },
    { id: "e2", nombre: "Pagos" },
  ]},
  { id: "cat2", nombre: "Generales", emoji: "📦", etiquetas: [
    { id: "e3", nombre: "Servicios" },
    { id: "e4", nombre: "Suscripciones" },
    { id: "e5", nombre: "Seguro" },
    { id: "e6", nombre: "Suministros" },
  ]},
  { id: "cat3", nombre: "Personal", emoji: "👤", etiquetas: [
    { id: "e7", nombre: "Nóminas" },
    { id: "e8", nombre: "Extras" },
    { id: "e9", nombre: "Formación" },
  ]},
  { id: "cat4", nombre: "Marketing", emoji: "📣", etiquetas: [
    { id: "e10", nombre: "Facebook Ads" },
    { id: "e11", nombre: "Google Ads" },
    { id: "e12", nombre: "Diseño" },
  ]},
  { id: "cat5", nombre: "Proveedores", emoji: "🚚", etiquetas: [
    { id: "e13", nombre: "Amazon" },
    { id: "e14", nombre: "Alcampo" },
    { id: "e15", nombre: "Makro" },
  ]},
  { id: "cat6", nombre: "Fiscal", emoji: "📋", etiquetas: [
    { id: "e16", nombre: "IVA" },
    { id: "e17", nombre: "IRPF" },
    { id: "e18", nombre: "Modelo 303" },
  ]},
];

const TABS = ["Categorías", "Alerta", "Ingreso", "Departamentos", "Empleados", "Informes", "Estadísticas", "Patrimonio"];

export function EtiquetasView() {
  const { empresaActual } = useEmpresa();
  const [busqueda, setBusqueda] = useState("");
  const [tabActiva, setTabActiva] = useState("Categorías");
  const [categorias] = useState(SAMPLE_CATEGORIAS);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtradas = useMemo(() => {
    if (!busqueda) return categorias;
    const q = busqueda.toLowerCase();
    return categorias
      .map(cat => ({
        ...cat,
        etiquetas: cat.etiquetas.filter(e => e.nombre.toLowerCase().includes(q)),
      }))
      .filter(cat => cat.nombre.toLowerCase().includes(q) || cat.etiquetas.length > 0);
  }, [categorias, busqueda]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Tabs */}
      <div className="border-b px-6 pt-4 flex items-center gap-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTabActiva(t)}
            className={cn("pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              tabActiva === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>{t}</button>
        ))}
        <button className="pb-3 text-sm text-muted-foreground hover:text-foreground">+</button>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-[1100px] mx-auto w-full">
        <div className="mb-6">
          <SubmoduleToolbar
            busqueda={busqueda}
            onBusquedaChange={setBusqueda}
            placeholderBusqueda="Filtrar por nombre de la etiqueta..."
            onNuevo={() => setDialogOpen(true)}
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear etiqueta</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Nombre</Label><Input placeholder="Nombre de la etiqueta" /></div>
              <div><Label>Categoría</Label>
                <Select><SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full">Crear etiqueta</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Categories + Tags */}
        <div className="space-y-2">
          {filtradas.map(cat => (
            <div key={cat.id}>
              <div className="flex items-center gap-3 px-4 py-4 bg-muted/30 rounded-xl border hover:bg-muted/40 transition-colors">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <span className="text-2xl shrink-0">{cat.emoji}</span>
                <span className="font-bold text-primary flex-1">{cat.nombre}</span>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"><Plus className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Search className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
              </div>

              {cat.etiquetas.map(et => (
                <div key={et.id} className="flex items-center gap-3 px-4 py-3 ml-4 border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                  <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                  <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-semibold">{et.nombre}</span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Search className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
