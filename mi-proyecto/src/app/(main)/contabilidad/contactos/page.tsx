"use client";

import { useState, useMemo } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Search, ChevronDown, MoreVertical, Building2, User, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { SAMPLE_CONTACTOS, ContactoContable, TipoContacto, FILTROS_CONTABLES } from "@/features/contabilidad/data/contabilidad";

const TABS: { id: string; label: string }[] = [
  { id: "TODOS", label: "Todos" },
  { id: "EMPRESA", label: "Empresas" },
  { id: "AUTONOMO", label: "Autónomos" },
  { id: "PARTICULAR", label: "Particulares" },
];

const tipoIcon: Record<TipoContacto, typeof Building2> = { EMPRESA: Building2, AUTONOMO: Briefcase, PARTICULAR: User };

export default function ContactosPage() {
  const { empresaActual } = useEmpresa();
  const [tab, setTab] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [contactos] = useState(SAMPLE_CONTACTOS);

  const filtrados = useMemo(() => {
    return contactos.filter(c => {
      const matchTab = tab === "TODOS" || c.tipo === tab;
      const q = busqueda.toLowerCase();
      const matchQ = !q || c.nombre.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.documento.toLowerCase().includes(q);
      return matchTab && matchQ;
    });
  }, [contactos, tab, busqueda]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* LEFT FILTERS */}
      <aside className="w-[220px] shrink-0 border-r bg-muted/20 p-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-bold mb-1">Filtrar contactos</p>
        <p className="text-[10px] text-muted-foreground mb-3">{filtrados.length} resultados</p>
        {FILTROS_CONTABLES.map(f => (
          <Collapsible key={f}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-2 px-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              {f}<ChevronDown className="h-3.5 w-3.5" />
            </CollapsibleTrigger>
          </Collapsible>
        ))}
        <div className="border-t pt-3 mt-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="rounded" />Sin ninguna etiqueta</label>
        </div>
        <div className="border-t pt-3 mt-3">
          <p className="text-[10px] text-muted-foreground mb-1">País</p>
          <Collapsible><CollapsibleTrigger className="w-full flex items-center justify-between py-1 text-sm text-muted-foreground">País<ChevronDown className="h-3.5 w-3.5" /></CollapsibleTrigger></Collapsible>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="border-b px-6 pt-4 flex items-center gap-6">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("pb-3 text-sm font-medium border-b-2 transition-colors",
                tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>{t.label}</button>
          ))}
        </div>

        {/* Search + actions */}
        <div className="px-6 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <Button className="gap-1.5"><Plus className="h-4 w-4" />Crear contacto</Button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="py-2 font-medium w-8"></th>
                <th className="py-2 font-medium">Nombre</th>
                <th className="py-2 font-medium">Nº documento</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Conceptos de etiqueta</th>
                <th className="py-2 font-medium">Etiquetas</th>
                <th className="py-2 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => {
                const Icon = tipoIcon[c.tipo];
                return (
                  <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3"><Icon className="h-4 w-4 text-muted-foreground" /></td>
                    <td className="py-3">
                      <p className="font-semibold">{c.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">{c.tipo === "EMPRESA" ? "Empresa" : c.tipo === "AUTONOMO" ? "Autónomo" : "Particular"}</p>
                    </td>
                    <td className="py-3 text-muted-foreground">{c.documento || "—"}</td>
                    <td className="py-3 text-muted-foreground">{c.email || "—"}</td>
                    <td className="py-3 text-muted-foreground">{c.categoria || "—"}</td>
                    <td className="py-3">
                      <div className="flex gap-1 flex-wrap">
                        {c.etiquetas.map(e => <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>)}
                      </div>
                    </td>
                    <td className="py-3"><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
