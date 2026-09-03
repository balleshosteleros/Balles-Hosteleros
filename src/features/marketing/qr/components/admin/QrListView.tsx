"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2, Pencil, Plus, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  colVisible,
  ordenarColumnas,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
} from "@/shared/components/SubmoduleToolbar";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  cambiarEstadoCodigoQr,
  listarCodigosQr,
} from "../../actions/qr-actions";
import type { CodigoQr } from "../../types";
import { QrDescargaDialog } from "./QrDescargaDialog";
import { QrFormDialog } from "./QrFormDialog";

/** Debe coincidir con `hostQr()` del servidor. */
const BASE_QR =
  process.env.NEXT_PUBLIC_QR_BASE_URL?.replace(/\/+$/, "") ||
  "https://qr.balleshosteleros.com";

export function QrListView() {
  const { empresaActual } = useEmpresa();
  const zona = empresaActual?.zonaHoraria ?? "Europe/Madrid";

  const [items, setItems] = useState<CodigoQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<CodigoQr | null>(null);
  const [verQr, setVerQr] = useState<CodigoQr | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listarCodigosQr();
    if (!res.ok) {
      toast.error(res.error);
      setItems([]);
    } else {
      setItems(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function urlDe(qr: CodigoQr): string {
    return `${BASE_QR}/${qr.codigo}`;
  }

  function acceso(item: CodigoQr, campo: string): unknown {
    switch (campo) {
      case "nombre":
        return item.nombre;
      case "codigo":
        return item.codigo;
      case "destino":
        return item.destino;
      case "estado":
        return item.estado;
      case "escaneos":
        return item.escaneos;
      case "creado":
        return item.created_at;
      default:
        return null;
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = items;
    if (q) {
      out = out.filter(
        (i) =>
          i.nombre.toLowerCase().includes(q) ||
          i.codigo.toLowerCase().includes(q) ||
          i.destino.toLowerCase().includes(q),
      );
    }
    out = aplicarFiltrosToolbar(out, filtros, acceso);
    out = aplicarOrdenToolbar(out, orden, acceso);
    return out;
  }, [items, search, filtros, orden]);

  const columnasDef: ToolbarColumna[] = [
    { campo: "nombre", label: "Nombre", bloqueada: true },
    { campo: "codigo", label: "Código" },
    { campo: "destino", label: "A dónde lleva" },
    { campo: "estado", label: "Estado" },
    { campo: "escaneos", label: "Escaneos" },
    { campo: "creado", label: "Creado" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (p: CodigoQr) => ReactNode }> = {
    nombre: {
      th: <TableHead key="nombre">Nombre</TableHead>,
      td: (p) => (
        <TableCell key="nombre" className="font-medium max-w-[260px] truncate">
          {p.nombre}
        </TableCell>
      ),
    },
    codigo: {
      th: <TableHead key="codigo">Código</TableHead>,
      td: (p) => (
        <TableCell key="codigo" className="font-mono text-xs text-muted-foreground">
          {p.codigo}
        </TableCell>
      ),
    },
    destino: {
      th: <TableHead key="destino">A dónde lleva</TableHead>,
      td: (p) => (
        <TableCell key="destino" className="max-w-[320px] truncate text-xs text-muted-foreground">
          {p.destino}
        </TableCell>
      ),
    },
    estado: {
      th: <TableHead key="estado">Estado</TableHead>,
      td: (p) => (
        <TableCell key="estado">
          <Badge variant={p.estado === "ACTIVO" ? "default" : "secondary"}>
            {p.estado === "ACTIVO" ? "Activo" : "Inactivo"}
          </Badge>
        </TableCell>
      ),
    },
    escaneos: {
      th: <TableHead key="escaneos" className="text-right">Escaneos</TableHead>,
      td: (p) => (
        <TableCell key="escaneos" className="text-right tabular-nums">
          {p.escaneos.toLocaleString("es-ES")}
        </TableCell>
      ),
    },
    creado: {
      th: <TableHead key="creado">Creado</TableHead>,
      td: (p) => (
        <TableCell key="creado" className="whitespace-nowrap text-sm text-muted-foreground">
          {formatearFecha(p.created_at, zona)}
        </TableCell>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  async function alternarEstado(p: CodigoQr) {
    const nuevo = p.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    const res = await cambiarEstadoCodigoQr(p.id, nuevo);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(nuevo === "ACTIVO" ? "Código activado" : "Código desactivado");
    void cargar();
  }

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        onNuevo={() => {
          setEditando(null);
          setFormOpen(true);
        }}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        orden={orden}
        onOrdenChange={setOrden}
        columnas={columnasDef}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
        viewKey="marketing-qr"
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {columnasRender.map((c) => columnDefs[c.campo]?.th)}
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={columnasRender.length + 1} className="py-12 text-center">
                  <LoadingSpinner />
                </TableCell>
              </TableRow>
            )}

            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnasRender.length + 1} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <QrCode className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No hay códigos QR todavía
                    </p>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => {
                        setEditando(null);
                        setFormOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Crear el primero
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  {columnasRender.map((c) => columnDefs[c.campo]?.td(p))}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Ver y descargar el QR"
                        onClick={() => setVerQr(p)}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar"
                        onClick={() => {
                          setEditando(p);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={p.estado === "ACTIVO" ? "Desactivar" : "Activar"}
                        onClick={() => void alternarEstado(p)}
                      >
                        {p.estado === "ACTIVO" ? (
                          <Ban className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      <QrFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        qr={editando}
        onGuardado={() => void cargar()}
      />

      <QrDescargaDialog
        qr={verQr}
        url={verQr ? urlDe(verQr) : ""}
        nombreEmpresa={empresaActual?.nombre ?? ""}
        open={verQr !== null}
        onOpenChange={(v) => {
          if (!v) setVerQr(null);
        }}
      />
    </div>
  );
}

/** Fecha en la zona horaria de la empresa, nunca la del navegador. */
function formatearFecha(iso: string, zona: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: zona,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}
