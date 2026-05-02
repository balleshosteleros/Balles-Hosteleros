"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Building2, User, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactoContable, TipoContacto } from "@/features/contabilidad/data/contabilidad";
import { listContactos } from "@/features/contabilidad/actions/contabilidad-actions";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { IOActions } from "@/shared/io";
import { contactosContablesIO } from "@/features/contabilidad/io/contactos.io";
import { toast } from "sonner";

const TABS: { id: string; label: string }[] = [
  { id: "TODOS", label: "Todos" },
  { id: "EMPRESA", label: "Empresas" },
  { id: "AUTONOMO", label: "Autónomos" },
  { id: "PARTICULAR", label: "Particulares" },
];

const tipoIcon: Record<TipoContacto, typeof Building2> = { EMPRESA: Building2, AUTONOMO: Briefcase, PARTICULAR: User };

function mapDbToContacto(row: Record<string, unknown>): ContactoContable {
  return {
    id: row.id as string,
    nombre: (row.nombre as string) ?? "",
    tipo: ((row.tipo as string) ?? "EMPRESA") as TipoContacto,
    documento: (row.nif as string) ?? "",
    email: (row.email as string) ?? "",
    etiquetas: Array.isArray(row.etiquetas) ? row.etiquetas as string[] : [],
    categoria: (row.categoria as string) ?? "",
    observaciones: (row.observaciones as string) ?? "",
  };
}

export function ContactosView() {
  const { empresaActual } = useEmpresa();
  const [tab, setTab] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [contactos, setContactos] = useState<ContactoContable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});

  const loadContactos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listContactos();
      if (res.ok) {
        setContactos(res.data.map(mapDbToContacto));
      } else {
        toast.error("Error al cargar contactos");
      }
    } catch {
      toast.error("Error de conexion al cargar contactos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContactos();
  }, [loadContactos]);

  const categoriasUsadas = useMemo(
    () => [...new Set(contactos.map(c => c.categoria).filter(Boolean))].sort(),
    [contactos],
  );
  const etiquetasUsadas = useMemo(
    () => [...new Set(contactos.flatMap(c => c.etiquetas))].sort(),
    [contactos],
  );

  const acceso = (c: ContactoContable, campo: string): unknown => {
    if (campo === "tipo") return c.tipo;
    if (campo === "categoria") return c.categoria;
    if (campo === "etiquetas") return c.etiquetas;
    if (campo === "nombre") return c.nombre;
    if (campo === "email") return c.email;
    return (c as unknown as Record<string, unknown>)[campo];
  };

  const filtrados = useMemo(() => {
    let lista = contactos.filter(c => {
      if (tab !== "TODOS" && c.tipo !== tab) return false;
      const q = busqueda.toLowerCase();
      return !q || c.nombre.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.documento.toLowerCase().includes(q);
    });
    const filtrosEtiqueta = filtros.filter(f => f.campo === "etiquetas");
    const otrosFiltros = filtros.filter(f => f.campo !== "etiquetas");
    lista = aplicarFiltrosToolbar(lista, otrosFiltros, acceso);
    if (filtrosEtiqueta.length > 0) {
      lista = lista.filter(c =>
        filtrosEtiqueta.every(f => f.valores?.some(v => c.etiquetas.includes(v))),
      );
    }
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [contactos, tab, busqueda, filtros, orden]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Tabs */}
      <div className="border-b px-6 pt-4 flex items-center gap-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("pb-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3">
        <SubmoduleToolbar
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          placeholderBusqueda="Buscar contactos…"
          onNuevo={() => { /* nuevo */ }}
          campos={[
            { campo: "tipo", label: "Tipo", tipo: "lista", opciones: ["EMPRESA", "AUTONOMO", "PARTICULAR"] },
            { campo: "categoria", label: "Categoría", tipo: "lista", opciones: categoriasUsadas },
            { campo: "etiquetas", label: "Etiquetas", tipo: "lista", opciones: etiquetasUsadas },
          ]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenOpciones={[
            { campo: "nombre", label: "Nombre" },
            { campo: "email", label: "Email" },
            { campo: "categoria", label: "Categoría" },
          ]}
          orden={orden}
          onOrdenChange={setOrden}
          columnas={[
            { campo: "nombre", label: "Nombre" },
            { campo: "documento", label: "Nº documento" },
            { campo: "email", label: "Email" },
            { campo: "categoria", label: "Conceptos de etiqueta" },
            { campo: "etiquetas", label: "Etiquetas" },
          ]}
          columnasVisibles={columnasVisibles}
          onColumnasVisiblesChange={setColumnasVisibles}
          extraDerecha={
            <IOActions config={contactosContablesIO} onSuccess={() => window.location.reload()} />
          }
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-4">
        <div className="text-[10px] text-muted-foreground mb-2">{filtrados.length} resultados</div>
        <div className="bg-card rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 font-medium">Nombre</th>
                <th className="px-3 py-3 font-medium">Nº documento</th>
                <th className="px-3 py-3 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Conceptos de etiqueta</th>
                <th className="px-3 py-3 font-medium">Etiquetas</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => {
                const Icon = tipoIcon[c.tipo];
                return (
                  <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-3"><Icon className="h-4 w-4 text-muted-foreground" /></td>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{c.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">{c.tipo === "EMPRESA" ? "Empresa" : c.tipo === "AUTONOMO" ? "Autónomo" : "Particular"}</p>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{c.documento || "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{c.email || "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{c.categoria || "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {c.etiquetas.map(e => <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>)}
                      </div>
                    </td>
                    <td className="px-3 py-3"><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No se encontraron contactos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
