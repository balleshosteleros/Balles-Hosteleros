"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Cliente, ClasificacionCliente } from "@/features/sala/data/clientes";
import { listClientes, createCliente } from "@/features/sala/actions/clientes-actions";
import { toast } from "sonner";
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
import { IOActions } from "@/shared/io";
import { clientesIO } from "@/features/sala/io/clientes.io";

const clasificacionBadge: Record<ClasificacionCliente, string> = {
  "VIP": "bg-amber-100 text-amber-800 border-amber-300",
  "FRECUENTE": "bg-green-100 text-green-800 border-green-300",
  "REGULAR": "bg-blue-100 text-blue-800 border-blue-300",
  "NUEVO": "bg-purple-100 text-purple-800 border-purple-300",
  "INACTIVO": "bg-muted text-muted-foreground",
};

function mapDbToCliente(row: Record<string, unknown>): Cliente {
  return {
    id: row.id as string,
    nombre: (row.nombre as string) ?? "",
    telefono: (row.telefono as string) ?? "",
    email: (row.email as string) ?? "",
    clasificacion: (row.clasificacion as ClasificacionCliente) ?? "NUEVO",
    visitas: (row.visitas as number) ?? 0,
    ultimaVisita: (row.ultima_visita as string) ?? "",
    observaciones: (row.observaciones as string) ?? "",
    preferencias: (row.preferencias as string) ?? "",
    notasInternas: (row.notas_internas as string) ?? "",
  };
}

export function ClientesView() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const loadClientes = useCallback(async () => {
    try {
      const res = await listClientes();
      if (res.ok) {
        setClientes(res.data.map(mapDbToCliente));
      } else {
        toast.error("Error al cargar clientes");
      }
    } catch {
      toast.error("Error de conexion al cargar clientes");
    }
  }, []);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  const acceso = (c: Cliente, campo: string): unknown => {
    if (campo === "clasificacion") return c.clasificacion;
    if (campo === "visitas") return c.visitas;
    if (campo === "ultimaVisita") return c.ultimaVisita;
    if (campo === "nombre") return c.nombre;
    return (c as unknown as Record<string, unknown>)[campo];
  };

  const filtrados = useMemo(() => {
    let lista = clientes.filter((c) => {
      if (!busqueda) return true;
      const q = busqueda.toLowerCase();
      return (
        c.nombre.toLowerCase().includes(q) ||
        c.telefono.includes(busqueda) ||
        c.email.toLowerCase().includes(q)
      );
    });
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [clientes, busqueda, filtros, orden]);

  const handleNuevo = async () => {
    const res = await createCliente({ nombre: "Nuevo cliente" });
    if (res.ok) {
      toast.success("Cliente creado");
      loadClientes();
    } else {
      toast.error(res.error ?? "Error al crear cliente");
    }
  };

  const columnasDef: ToolbarColumna[] = [
    { campo: "nombre", label: "Nombre", bloqueada: true },
    { campo: "telefono", label: "Teléfono" },
    { campo: "email", label: "Email" },
    { campo: "clasificacion", label: "Clasificación" },
    { campo: "visitas", label: "Visitas" },
    { campo: "ultimaVisita", label: "Última visita" },
    { campo: "observaciones", label: "Observaciones" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (item: Cliente) => ReactNode }> = {
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
      td: (c) => <td key="nombre" className="p-3 font-medium">{c.nombre}</td>,
    },
    telefono: {
      th: <TableColumnHeader key="telefono" label="Teléfono" />,
      td: (c) => <td key="telefono" className="p-3">{c.telefono}</td>,
    },
    email: {
      th: <TableColumnHeader key="email" label="Email" />,
      td: (c) => <td key="email" className="p-3">{c.email || "—"}</td>,
    },
    clasificacion: {
      th: (
        <TableColumnHeader
          key="clasificacion"
          label="Clasificación"
          campo="clasificacion"
          filtroTipo="lista"
          opciones={["VIP", "FRECUENTE", "REGULAR", "NUEVO", "INACTIVO"]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => (
        <td key="clasificacion" className="p-3">
          <Badge className={clasificacionBadge[c.clasificacion]} variant="outline">{c.clasificacion}</Badge>
        </td>
      ),
    },
    visitas: {
      th: (
        <TableColumnHeader
          key="visitas"
          label="Visitas"
          campo="visitas"
          filtroTipo="numero"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => <td key="visitas" className="p-3">{c.visitas}</td>,
    },
    ultimaVisita: {
      th: (
        <TableColumnHeader
          key="ultimaVisita"
          label="Última visita"
          campo="ultimaVisita"
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (c) => <td key="ultimaVisita" className="p-3">{c.ultimaVisita}</td>,
    },
    observaciones: {
      th: <TableColumnHeader key="observaciones" label="Observaciones" />,
      td: (c) => (
        <td key="observaciones" className="p-3 text-muted-foreground truncate max-w-[200px]">{c.observaciones || "—"}</td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-6 space-y-6">
      {/* Toolbar estándar (BARRA HORIZONTAL 1) */}
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar"
        onNuevo={handleNuevo}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        extraDerecha={
          <>
            <IOActions config={clientesIO} onSuccess={() => window.location.reload()} />
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

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40">
              {columnasRender.map((c) => columnDefs[c.campo]?.th)}
            </tr></thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id} className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedCliente(c)}>
                  {columnasRender.map((col) => columnDefs[col.campo]?.td(c))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCliente} onOpenChange={() => setSelectedCliente(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ficha de cliente</DialogTitle></DialogHeader>
          {selectedCliente && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground">Nombre</Label><p className="font-medium">{selectedCliente.nombre}</p></div>
                <div><Label className="text-muted-foreground">Clasificación</Label><Badge className={`ml-1 ${clasificacionBadge[selectedCliente.clasificacion]}`} variant="outline">{selectedCliente.clasificacion}</Badge></div>
                <div><Label className="text-muted-foreground">Teléfono</Label><p>{selectedCliente.telefono}</p></div>
                <div><Label className="text-muted-foreground">Email</Label><p>{selectedCliente.email || "—"}</p></div>
                <div><Label className="text-muted-foreground">Visitas</Label><p>{selectedCliente.visitas}</p></div>
                <div><Label className="text-muted-foreground">Última visita</Label><p>{selectedCliente.ultimaVisita}</p></div>
              </div>
              {selectedCliente.observaciones && <div><Label className="text-muted-foreground">Observaciones</Label><p>{selectedCliente.observaciones}</p></div>}
              {selectedCliente.preferencias && <div><Label className="text-muted-foreground">Preferencias</Label><p>{selectedCliente.preferencias}</p></div>}
              {selectedCliente.notasInternas && <div><Label className="text-muted-foreground">Notas internas</Label><p>{selectedCliente.notasInternas}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
