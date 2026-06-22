"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Building2, User, Briefcase, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactoContable, TipoContacto } from "@/features/contabilidad/data/contabilidad";
import { listContactos } from "@/features/contabilidad/actions/contabilidad-actions";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
  type ToolbarColumna,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { IOActions } from "@/shared/io";
import { contactosContablesIO } from "@/features/contabilidad/io/contactos.io";
import { ImportadorIAContactosDialog } from "@/features/contabilidad/components/ImportadorIAContactosDialog";
import { NuevoContactoDialog } from "@/features/contabilidad/components/NuevoContactoDialog";
import { EditContactoDialog } from "@/features/contabilidad/components/EditContactoDialog";
import { Sparkles } from "lucide-react";
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
    documento: (row.cif as string) ?? "",
    email: (row.email as string) ?? "",
    etiquetas: Array.isArray(row.etiquetas) ? row.etiquetas as string[] : [],
    categoria: (row.categoria as string) ?? "",
    observaciones: (row.observaciones as string) ?? "",
    telefono: (row.telefono as string) ?? "",
    direccion: (row.direccion as string) ?? "",
    notas: (row.notas as string) ?? "",
  };
}

export function ContactosView() {
  useEmpresa();
  const [tab, setTab] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [contactos, setContactos] = useState<ContactoContable[]>([]);
  const [, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [showConfig, setShowConfig] = useState(false);
  const [importadorAbierto, setImportadorAbierto] = useState(false);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [editando, setEditando] = useState<ContactoContable | null>(null);

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

  const columnasDef: ToolbarColumna[] = [
    { campo: "nombre", label: "Nombre", bloqueada: true },
    { campo: "documento", label: "Nº documento" },
    { campo: "email", label: "Email" },
    { campo: "categoria", label: "Conceptos de etiqueta" },
    { campo: "etiquetas", label: "Etiquetas" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (c: ContactoContable) => ReactNode }> = {
    nombre: {
      th: (
        <TableColumnHeader
          key="nombre"
          label="Nombre"
          campo="nombre"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => (
        <td key="nombre" className="px-3 py-3">
          <p className="font-semibold">{c.nombre}</p>
          <p className="text-[10px] text-muted-foreground">{c.tipo === "EMPRESA" ? "Empresa" : c.tipo === "AUTONOMO" ? "Autónomo" : "Particular"}</p>
        </td>
      ),
    },
    documento: {
      th: (
        <TableColumnHeader
          key="documento"
          label="Nº documento"
          campo="documento"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => (
        <td key="documento" className="px-3 py-3 text-muted-foreground">{c.documento || "—"}</td>
      ),
    },
    email: {
      th: (
        <TableColumnHeader
          key="email"
          label="Email"
          campo="email"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => (
        <td key="email" className="px-3 py-3 text-muted-foreground">{c.email || "—"}</td>
      ),
    },
    categoria: {
      th: (
        <TableColumnHeader
          key="categoria"
          label="Conceptos de etiqueta"
          campo="categoria"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
          filtroTipo="lista"
          opciones={categoriasUsadas}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (c) => (
        <td key="categoria" className="px-3 py-3 text-muted-foreground">{c.categoria || "—"}</td>
      ),
    },
    etiquetas: {
      th: (
        <TableColumnHeader
          key="etiquetas"
          label="Etiquetas"
          campo="etiquetas"
          filtroTipo="lista"
          opciones={etiquetasUsadas}
          filtros={filtros}
          onFiltrosChange={setFiltros}
        />
      ),
      td: (c) => (
        <td key="etiquetas" className="px-3 py-3">
          <div className="flex gap-1 flex-wrap">
            {c.etiquetas.map(e => <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>)}
          </div>
        </td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

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
          placeholderBusqueda="Buscar"
          onNuevo={() => setNuevoAbierto(true)}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          orden={orden}
          onOrdenChange={setOrden}
          columnas={columnasDef}
          columnasVisibles={columnasVisibles}
          onColumnasVisiblesChange={setColumnasVisibles}
          columnasOrden={columnasOrden}
          onColumnasOrdenChange={setColumnasOrden}
          extraDerecha={
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-1.5"
                onClick={() => setImportadorAbierto(true)}
                title="Importar con IA"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Importar IA
              </Button>
              <IOActions config={contactosContablesIO} onSuccess={() => window.location.reload()} />
              <Button
                size="icon"
                variant={showConfig ? "default" : "outline"}
                className="h-9 w-9"
                onClick={() => setShowConfig((v) => !v)}
                title="Configuración"
                aria-label="Configuración"
              >
                <Settings className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            </>
          }
        />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pb-4">
        <div className="text-[10px] text-muted-foreground mb-2">{filtrados.length} resultados</div>
        <ResizableColumnsProvider storageKey="contabilidad-contactos">
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-3 py-3 w-8"></th>
                  {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => {
                  const Icon = tipoIcon[c.tipo];
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setEditando(c)}
                      className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-3"><Icon className="h-4 w-4 text-muted-foreground" /></td>
                      {columnasRender.map((col) => columnDefs[col.campo]?.td(c))}
                      <td className="px-3 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); setEditando(c); }}
                          title="Ver ficha"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={columnasRender.length + 2} className="text-center py-12 text-muted-foreground">No se encontraron contactos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ResizableColumnsProvider>
      </div>

      <ImportadorIAContactosDialog
        open={importadorAbierto}
        onOpenChange={setImportadorAbierto}
        onImportSuccess={loadContactos}
      />

      <NuevoContactoDialog
        open={nuevoAbierto}
        onOpenChange={setNuevoAbierto}
        onCreated={loadContactos}
      />

      <EditContactoDialog
        contacto={editando}
        onOpenChange={(o) => { if (!o) setEditando(null); }}
        onSaved={loadContactos}
      />
    </div>
  );
}
