"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Star, UserCheck, UserX } from "lucide-react";
import { Cliente, ClasificacionCliente } from "@/features/sala/data/clientes";
import { listClientes, createCliente } from "@/features/sala/actions/clientes-actions";
import { toast } from "sonner";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
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
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

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

  const vips = clientes.filter(c => c.clasificacion === "VIP").length;
  const frecuentes = clientes.filter(c => c.clasificacion === "FRECUENTE").length;
  const inactivos = clientes.filter(c => c.clasificacion === "INACTIVO").length;

  const handleNuevo = async () => {
    const res = await createCliente({ nombre: "Nuevo cliente" });
    if (res.ok) {
      toast.success("Cliente creado");
      loadClientes();
    } else {
      toast.error(res.error ?? "Error al crear cliente");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{clientes.length}</p><p className="text-xs text-muted-foreground">Total clientes</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="flex items-center justify-center gap-1"><Star className="h-4 w-4 text-amber-500" /><p className="text-2xl font-bold">{vips}</p></div><p className="text-xs text-muted-foreground">VIP</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="flex items-center justify-center gap-1"><UserCheck className="h-4 w-4 text-green-500" /><p className="text-2xl font-bold">{frecuentes}</p></div><p className="text-xs text-muted-foreground">Frecuentes</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="flex items-center justify-center gap-1"><UserX className="h-4 w-4 text-muted-foreground" /><p className="text-2xl font-bold">{inactivos}</p></div><p className="text-xs text-muted-foreground">Inactivos</p></CardContent></Card>
      </div>

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar por nombre, teléfono o email..."
        onNuevo={handleNuevo}
        textoNuevo="Nuevo cliente"
        campos={[
          {
            campo: "clasificacion",
            label: "Clasificación",
            tipo: "lista",
            opciones: ["VIP", "FRECUENTE", "REGULAR", "NUEVO", "INACTIVO"] as ClasificacionCliente[],
          },
          { campo: "visitas", label: "Visitas", tipo: "numero" },
          { campo: "ultimaVisita", label: "Última visita", tipo: "fecha" },
        ]}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        ordenOpciones={[
          { campo: "nombre", label: "Nombre" },
          { campo: "visitas", label: "Visitas" },
          { campo: "ultimaVisita", label: "Última visita" },
        ]}
        orden={orden}
        onOrdenChange={setOrden}
        columnas={[
          { campo: "nombre", label: "Nombre" },
          { campo: "telefono", label: "Teléfono" },
          { campo: "email", label: "Email" },
          { campo: "clasificacion", label: "Clasificación" },
          { campo: "visitas", label: "Visitas" },
          { campo: "ultimaVisita", label: "Última visita" },
          { campo: "observaciones", label: "Observaciones" },
        ]}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        extraDerecha={
          <IOActions config={clientesIO} onSuccess={() => window.location.reload()} />
        }
      />

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40">
              <th className="text-left p-3 font-medium">Nombre</th>
              <th className="text-left p-3 font-medium">Teléfono</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Clasificación</th>
              <th className="text-left p-3 font-medium">Visitas</th>
              <th className="text-left p-3 font-medium">Última visita</th>
              <th className="text-left p-3 font-medium">Observaciones</th>
            </tr></thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id} className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedCliente(c)}>
                  <td className="p-3 font-medium">{c.nombre}</td>
                  <td className="p-3">{c.telefono}</td>
                  <td className="p-3">{c.email || "—"}</td>
                  <td className="p-3"><Badge className={clasificacionBadge[c.clasificacion]} variant="outline">{c.clasificacion}</Badge></td>
                  <td className="p-3">{c.visitas}</td>
                  <td className="p-3">{c.ultimaVisita}</td>
                  <td className="p-3 text-muted-foreground truncate max-w-[200px]">{c.observaciones || "—"}</td>
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
