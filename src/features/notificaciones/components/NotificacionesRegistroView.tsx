"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SubmoduleToolbar,
  coincideBusquedaUniversal,
  colVisible,
  ordenarColumnas,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import {
  listRegistroNotificaciones,
  type NotificacionRegistro,
} from "@/features/notificaciones/actions/notificaciones-actions";
import { getTipoMeta } from "@/features/notificaciones/lib/catalogo";
import { NuevoAvisoDialog } from "@/features/notificaciones/components/NuevoAvisoDialog";

const columnasDef: ToolbarColumna[] = [
  { campo: "tipo", label: "Tipo" },
  { campo: "titulo", label: "Título" },
  { campo: "destinatario", label: "Destinatario" },
  { campo: "estado", label: "Estado" },
  { campo: "fecha", label: "Fecha" },
];

function fechaHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function NotificacionesRegistroView() {
  const { empresaActual } = useEmpresa();
  const [items, setItems] = useState<NotificacionRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [nuevoAviso, setNuevoAviso] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    listRegistroNotificaciones().then((d) => {
      setItems(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload, empresaActual.id]);

  const filtradas = useMemo(
    () =>
      items.filter((n) =>
        coincideBusquedaUniversal(
          { titulo: n.titulo, destinatario: n.destinatario, tipo: getTipoMeta(n.tipo).label, estado: n.estado },
          busqueda,
        ),
      ),
    [items, busqueda],
  );

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  const celda = (n: NotificacionRegistro, campo: string) => {
    switch (campo) {
      case "tipo": {
        const meta = getTipoMeta(n.tipo);
        return (
          <TableCell key="tipo">
            <Badge variant="secondary" className={`text-[10px] ${meta.badge}`}>{meta.label}</Badge>
          </TableCell>
        );
      }
      case "titulo":
        return (
          <TableCell key="titulo" className="font-medium">
            {n.titulo}
            {n.mensaje && <span className="block text-xs text-muted-foreground">{n.mensaje}</span>}
          </TableCell>
        );
      case "destinatario":
        return <TableCell key="destinatario">{n.destinatario}</TableCell>;
      case "estado":
        return (
          <TableCell key="estado">
            {n.estado === "Accionada" ? (
              <Badge className="bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">Accionada</Badge>
            ) : n.estado === "Vista" ? (
              <Badge className="bg-green-600 text-[10px] text-white hover:bg-green-600">Vista</Badge>
            ) : (
              <Badge className="bg-red-500 text-[10px] text-white hover:bg-red-500">No vista</Badge>
            )}
          </TableCell>
        );
      case "fecha":
        return (
          <TableCell key="fecha" className="text-xs text-muted-foreground">
            {fechaHora(n.createdAt)}
          </TableCell>
        );
      default:
        return <TableCell key={campo} />;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar notificación"
        onNuevo={() => setNuevoAviso(true)}
        textoNuevo="Nuevo aviso"
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  {columnasRender.map((c) => (
                    <TableHead key={c.campo}>{c.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={columnasRender.length} className="py-8 text-center text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnasRender.length} className="py-8 text-center text-muted-foreground">
                      No hay notificaciones registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((n) => (
                    <TableRow key={n.id}>{columnasRender.map((c) => celda(n, c.campo))}</TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <NuevoAvisoDialog open={nuevoAviso} onOpenChange={setNuevoAviso} onEmitted={reload} />
    </div>
  );
}
