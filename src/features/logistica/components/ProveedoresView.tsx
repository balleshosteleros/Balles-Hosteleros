"use client";

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  ESTADOS_PROVEEDOR, CATEGORIAS_PROVEEDOR, DIAS_REPARTO, VIAS_PAGO, PLAZOS_PAGO,
  type Proveedor, type EstadoProveedor,
} from "@/features/logistica/data/proveedores";
import { listProveedores, createProveedor, updateProveedor } from "@/features/logistica/actions/proveedores-actions";
import {
  listCategoriasProveedor,
  createCategoriaProveedor,
  updateCategoriaProveedor,
  deleteCategoriaProveedor,
  getProveedoresConfig,
  saveProveedoresConfig,
  type CategoriaProveedorRow,
  type ProveedoresConfig,
} from "@/features/logistica/actions/categorias-proveedor-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { LabelConRegla } from "@/components/forms/LabelConRegla";
import { BotonesGuardarBorrador } from "@/components/forms/BotonesGuardarBorrador";
import { Mail, AlertTriangle, Settings, Pencil, Trash2, Plus, Sparkles, X, ArrowLeft } from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  coincideBusquedaUniversal,
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
import { proveedoresIO } from "@/features/logistica/io/proveedores.io";
import { ProveedorDetail } from "@/features/logistica/components/ProveedorDetail";
import { ImportadorIACatalogoDialog } from "@/features/logistica/components/ImportadorIACatalogoDialog";
import {
  analizarProveedoresIA,
  guardarProveedoresIA,
  analizarCategoriasProveedorIA,
  guardarCategoriasProveedorIA,
} from "@/features/logistica/actions/importador-catalogos-ia-actions";
import type { ImportadorEntityConfig } from "@/features/logistica/types/importador-catalogo-ia";
import { useReglasSubmodulo } from "@/features/ajustes/hooks/use-reglas-submodulo";
import { ValidacionFaltantesDialog } from "@/features/ajustes/components/ValidacionFaltantesDialog";
import { toast } from "sonner";

function EstadoBadge({ value }: { value: EstadoProveedor }) {
  const cls: Record<string, string> = {
    Activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    Inactivo: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  };
  return <Badge className={`${cls[value] || ""} border-0 text-[11px]`}>{value}</Badge>;
}

function mapDbToProveedor(row: Record<string, unknown>): Proveedor {
  return {
    id: row.id as string,
    numeroSecuencial: typeof row.numero_secuencial === "number" ? row.numero_secuencial : undefined,
    empresaId: (row.empresa_id as string) ?? "",
    nombreComercial: (row.nombre_comercial as string) ?? (row.nombre as string) ?? "",
    razonSocial: (row.razon_social as string) ?? "",
    cifNif: (row.cif_nif as string) ?? (row.cif as string) ?? "",
    categoria: (row.categoria as string) || CATEGORIAS_PROVEEDOR[0],
    estado: (row.estado as EstadoProveedor) ?? "Activo",
    observaciones: (row.observaciones as string) ?? (row.notas as string) ?? "",
    personaContacto: (row.persona_contacto as string) ?? "",
    telefonoPrincipal: (row.telefono_principal as string) ?? "",
    telefonoSecundario: (row.telefono_secundario as string) ?? "",
    telefonoComercial: (row.telefono_comercial as string) ?? "",
    emailPrincipal: (row.email_principal as string) ?? "",
    emailComercial: (row.email_comercial as string) ?? "",
    emailPedidos: (row.email_pedidos as string) ?? "",
    emailContabilidad: (row.email_contabilidad as string) ?? "",
    web: (row.web as string) ?? "",
    direccion: (row.direccion as string) ?? "",
    ciudad: (row.ciudad as string) ?? "",
    provincia: (row.provincia as string) ?? "",
    pais: (row.pais as string) ?? "Espana",
    codigoPostal: (row.codigo_postal as string) ?? "",
    diasReparto: Array.isArray(row.dias_reparto) ? row.dias_reparto as string[] : [],
    horarioReparto: (row.horario_reparto && typeof row.horario_reparto === "object" && !Array.isArray(row.horario_reparto))
      ? (row.horario_reparto as Record<string, string>)
      : {},
    diasRepartoNegociados: Array.isArray(row.dias_reparto_negociados) ? row.dias_reparto_negociados as string[] : [],
    horarioRepartoNegociado: (row.horario_reparto_negociado && typeof row.horario_reparto_negociado === "object" && !Array.isArray(row.horario_reparto_negociado))
      ? (row.horario_reparto_negociado as Record<string, string>)
      : {},
    diaRepartoNegociado: (row.dia_reparto_negociado as string) ?? "",
    viaPago: (row.via_pago as string) ?? "",
    viaPagoNegociada: (row.via_pago_negociada as string) ?? "",
    plazoPago: (row.plazo_pago as string) ?? "",
    plazoPagoNegociado: (row.plazo_pago_negociado as string) ?? "",
    condicionesPago: (row.condiciones_pago as string) ?? (row.condiciones as string) ?? (row.forma_pago as string) ?? "",
    plazo: (row.plazo_entrega as string) ?? (row.plazo as string) ?? "",
    observacionesLogisticas: (row.observaciones_logisticas as string) ?? "",
    comentariosInternos: (row.comentarios_internos as string) ?? "",
    creador: (row.creador as string) ?? "",
    createdAt: (row.created_at as string) ?? "",
    ultimaActualizacion: (row.updated_at as string) ?? "",
  };
}

export function ProveedoresView() {
  const pathname = usePathname();
  useEffect(() => { sessionStorage.setItem("logistica_last", pathname); }, [pathname]);

  const { empresaActual } = useEmpresa();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);
  const [detalleProveedor, setDetalleProveedor] = useState<Proveedor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Proveedor | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [categoriasFull, setCategoriasFull] = useState<CategoriaProveedorRow[]>([]);
  const [operativa, setOperativa] = useState<ProveedoresConfig>({
    mostrar_solo_productos_proveedor: true,
    avisar_doc_existente: true,
    ocultar_precios_compra_impresion: false,
  });
  const [savingOperativa, setSavingOperativa] = useState(false);
  const [iaProvOpen, setIaProvOpen] = useState(false);

  const iaProveedoresConfig: ImportadorEntityConfig = {
    titulo: "Importar proveedores con IA",
    subtitulo:
      "Sube un Excel, PDF o foto de un listado de proveedores. La IA extraerá nombre, categoría y contacto. Tú revisas antes de guardar.",
    campos: [
      { key: "nombreComercial", label: "Nombre comercial", obligatorio: true, tipo: "texto" },
      {
        key: "categoria",
        label: "Categoría",
        obligatorio: true,
        tipo: "select",
        opciones: categoriasFull.map((c) => ({ value: c.nombre, label: c.nombre })),
        placeholderVacio: "Sin categorías — créalas en Configuración",
        deshabilitadoSiVacio: true,
      },
      { key: "personaContacto", label: "Contacto", obligatorio: false, tipo: "texto" },
      { key: "telefonoPrincipal", label: "Teléfono", obligatorio: false, tipo: "texto" },
      { key: "emailPrincipal", label: "Email", obligatorio: false, tipo: "texto" },
      { key: "emailPedidos", label: "Email pedidos", obligatorio: false, tipo: "texto" },
      { key: "direccion", label: "Dirección", obligatorio: false, tipo: "texto" },
      { key: "ciudad", label: "Ciudad", obligatorio: false, tipo: "texto" },
      { key: "codigoPostal", label: "CP", obligatorio: false, tipo: "texto" },
      { key: "web", label: "Web", obligatorio: false, tipo: "texto" },
      { key: "observaciones", label: "Observaciones", obligatorio: false, tipo: "texto" },
    ],
    analyze: analizarProveedoresIA,
    save: guardarProveedoresIA,
  };

  const reloadCategorias = useCallback(async () => {
    const res = await listCategoriasProveedor();
    if (res.ok) setCategoriasFull(res.data);
  }, []);

  const reloadOperativa = useCallback(async () => {
    const res = await getProveedoresConfig();
    if (res.ok) setOperativa(res.data);
  }, []);

  useEffect(() => {
    reloadCategorias();
    reloadOperativa();
  }, [reloadCategorias, reloadOperativa]);

  const handleGuardarOperativa = async () => {
    setSavingOperativa(true);
    try {
      const res = await saveProveedoresConfig(operativa);
      if (!res.ok) {
        toast.error(res.error ?? "Error al guardar configuración");
        return;
      }
      toast.success("Configuración guardada");
    } finally {
      setSavingOperativa(false);
    }
  };

  const categoriasBD = useMemo(
    () => categoriasFull.filter((c) => c.activa).map((c) => c.nombre),
    [categoriasFull],
  );

  const loadProveedores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProveedores();
      if (res.ok) {
        setProveedores((res.data as unknown as Array<Record<string, unknown>>).map(mapDbToProveedor));
      } else {
        toast.error("Error al cargar proveedores");
      }
    } catch {
      toast.error("Error de conexion al cargar proveedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProveedores();
  }, [loadProveedores]);

  const categoriasUsadas = useMemo(
    () => [...new Set(proveedores.map((p) => p.categoria).filter(Boolean))].sort(),
    [proveedores],
  );

  const acceso = (p: Proveedor, campo: string): unknown => {
    return (p as unknown as Record<string, unknown>)[campo];
  };

  const filtered = useMemo(() => {
    let lista = proveedores.filter((p) => coincideBusquedaUniversal(p, search));
    lista = aplicarFiltrosToolbar(lista, filtros, acceso);
    lista = aplicarOrdenToolbar(lista, orden, acceso);
    return lista;
  }, [proveedores, search, filtros, orden]);

  const handleSave = async (item: Proveedor): Promise<boolean> => {
    const exists = proveedores.find((p) => p.id === item.id);
    setProveedores((prev) => {
      if (exists) return prev.map((p) => (p.id === item.id ? item : p));
      return [item, ...prev];
    });

    const payload = {
      nombreComercial: item.nombreComercial,
      razonSocial: item.razonSocial,
      cifNif: item.cifNif,
      categoria: item.categoria,
      estado: item.estado,
      personaContacto: item.personaContacto,
      telefonoPrincipal: item.telefonoPrincipal,
      telefonoSecundario: item.telefonoSecundario,
      telefonoComercial: item.telefonoComercial,
      emailPrincipal: item.emailPrincipal,
      emailComercial: item.emailComercial,
      emailPedidos: item.emailPedidos,
      emailContabilidad: item.emailContabilidad,
      web: item.web,
      direccion: item.direccion,
      ciudad: item.ciudad,
      provincia: item.provincia,
      pais: item.pais,
      codigoPostal: item.codigoPostal,
      diasReparto: item.diasReparto,
      horarioReparto: item.horarioReparto,
      diasRepartoNegociados: item.diasRepartoNegociados,
      horarioRepartoNegociado: item.horarioRepartoNegociado,
      diaRepartoNegociado: item.diaRepartoNegociado,
      viaPago: item.viaPago,
      viaPagoNegociada: item.viaPagoNegociada,
      plazoPago: item.plazoPago,
      plazoPagoNegociado: item.plazoPagoNegociado,
      condicionesPago: item.condicionesPago,
      plazoEntrega: item.plazo,
      observaciones: item.observaciones,
      observacionesLogisticas: item.observacionesLogisticas,
      comentariosInternos: item.comentariosInternos,
    };

    if (exists) {
      const res = await updateProveedor(item.id, payload);
      if (!res.ok) { toast.error("Error al actualizar proveedor"); loadProveedores(); return false; }
      return true;
    }
    const res = await createProveedor(payload);
    if (res.ok) { loadProveedores(); return true; }
    toast.error(res.error ?? "Error al crear proveedor"); loadProveedores();
    return false;
  };

  // ── Detail view ──
  if (detalleProveedor) {
    return (
      <ProveedorDetail
        proveedor={detalleProveedor}
        onBack={() => setDetalleProveedor(null)}
        onSave={async (item) => {
          const ok = await handleSave(item);
          if (ok) setDetalleProveedor(item);
          return ok;
        }}
      />
    );
  }

  // ── Main list view ──
  const columnasDef: ToolbarColumna[] = [
    { campo: "id", label: "ID", bloqueada: true },
    { campo: "proveedor", label: "Proveedor", bloqueada: true },
    { campo: "categoria", label: "Categoría" },
    { campo: "contacto", label: "Contacto" },
    { campo: "telefono", label: "Teléfono" },
    { campo: "emailPedidos", label: "Email pedidos" },
    { campo: "estado", label: "Estado" },
    { campo: "ultimaActualizacion", label: "Últ. Actualización" },
  ];

  const columnDefs: Record<string, { th: ReactNode; td: (p: Proveedor) => ReactNode }> = {
    id: {
      th: <TableColumnHeader key="id" label="ID" />,
      td: (p) => (
        <td key="id" className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground">
          {p.numeroSecuencial ?? "—"}
        </td>
      ),
    },
    proveedor: {
      th: (
        <TableColumnHeader
          key="proveedor"
          label="Proveedor"
          campo="nombreComercial"
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="proveedor" className="px-3 py-2.5 font-semibold text-primary whitespace-nowrap">
          {p.nombreComercial}
        </td>
      ),
    },
    categoria: {
      th: (
        <TableColumnHeader
          key="categoria"
          label="Categoría"
          campo="categoria"
          filtroTipo="lista"
          opciones={categoriasBD.length > 0 ? categoriasBD : (categoriasUsadas.length > 0 ? categoriasUsadas : (CATEGORIAS_PROVEEDOR as unknown as string[]))}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="categoria" className="px-3 py-2.5 text-xs">
          {p.categoria}
        </td>
      ),
    },
    contacto: {
      th: <TableColumnHeader key="contacto" label="Contacto" />,
      td: (p) => (
        <td key="contacto" className="px-3 py-2.5 text-xs font-medium">
          {p.personaContacto || "—"}
        </td>
      ),
    },
    telefono: {
      th: <TableColumnHeader key="telefono" label="Teléfono" />,
      td: (p) => (
        <td key="telefono" className="px-3 py-2.5 text-xs">
          {p.telefonoPrincipal || "—"}
        </td>
      ),
    },
    emailPedidos: {
      th: <TableColumnHeader key="emailPedidos" label="Email pedidos" />,
      td: (p) => (
        <td key="emailPedidos" className="px-3 py-2.5 text-xs">
          {p.emailPedidos ? (
            <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {p.emailPedidos}</span>
          ) : (
            <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> Sin configurar</span>
          )}
        </td>
      ),
    },
    estado: {
      th: (
        <TableColumnHeader
          key="estado"
          label="Estado"
          campo="estado"
          filtroTipo="lista"
          opciones={ESTADOS_PROVEEDOR as unknown as string[]}
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="estado" className="px-3 py-2.5">
          <EstadoBadge value={p.estado} />
        </td>
      ),
    },
    ultimaActualizacion: {
      th: (
        <TableColumnHeader
          key="ultimaActualizacion"
          label="Últ. Actualización"
          campo="ultimaActualizacion"
          filtroTipo="fecha"
          filtros={filtros}
          onFiltrosChange={setFiltros}
          ordenable
          orden={orden}
          onOrdenChange={setOrden}
        />
      ),
      td: (p) => (
        <td key="ultimaActualizacion" className="px-3 py-2.5 text-xs text-muted-foreground">
          {p.ultimaActualizacion}
        </td>
      ),
    },
  };

  const columnasRender = ordenarColumnas(columnasDef, columnasOrden).filter(
    (c) => c.bloqueada || colVisible(columnasVisibles, c.campo),
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header removed — title shown in top bar */}

      {showConfig ? (
        <div className="bg-card border rounded-lg p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">CONFIGURACIÓN — PROVEEDORES</h3>
            <Button size="sm" variant="ghost" onClick={() => setShowConfig(false)} className="gap-1"><ArrowLeft className="h-4 w-4" /> Volver</Button>
          </div>

          <CategoriasProveedorManager items={categoriasFull} onChanged={reloadCategorias} />

          <Separator />

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Operativa de compra</h4>

            <Label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={operativa.mostrar_solo_productos_proveedor}
                onCheckedChange={(v) =>
                  setOperativa((prev) => ({ ...prev, mostrar_solo_productos_proveedor: !!v }))
                }
                className="mt-0.5"
              />
              <span className="text-sm font-normal">
                Mostrar solo productos de este proveedor en documentos de compra.
              </span>
            </Label>

            <Label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={operativa.avisar_doc_existente}
                onCheckedChange={(v) =>
                  setOperativa((prev) => ({ ...prev, avisar_doc_existente: !!v }))
                }
                className="mt-0.5"
              />
              <span className="text-sm font-normal">
                Avisar al crear un documento de compra con un número de documento existente.
              </span>
            </Label>

            <Label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={operativa.ocultar_precios_compra_impresion}
                onCheckedChange={(v) =>
                  setOperativa((prev) => ({ ...prev, ocultar_precios_compra_impresion: !!v }))
                }
                className="mt-0.5"
              />
              <span className="text-sm font-normal">
                Ocultar precios de compra al imprimir pedidos de compra.
              </span>
            </Label>

            <div className="flex justify-end">
              <Button size="sm" onClick={handleGuardarOperativa} disabled={savingOperativa}>
                {savingOperativa ? "Guardando…" : "Guardar configuración"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <SubmoduleToolbar
            busqueda={search}
            onBusquedaChange={setSearch}
            placeholderBusqueda="Buscar"
            onNuevo={() => { setEditItem(null); setModalOpen(true); }}
            filtros={filtros}
            onFiltrosChange={setFiltros}
            columnas={columnasDef}
            columnasVisibles={columnasVisibles}
            onColumnasVisiblesChange={setColumnasVisibles}
            columnasOrden={columnasOrden}
            onColumnasOrdenChange={setColumnasOrden}
            extraDerecha={
              <>
                <IOActions
                  config={proveedoresIO}
                  onSuccess={() => window.location.reload()}
                  onCustomImport={() => setIaProvOpen(true)}
                />
                <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setShowConfig(true)} title="Configuración" aria-label="Configuración">
                  <Settings className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </>
            }
          />

          {/* Table */}
          <ResizableColumnsProvider storageKey="logistica-proveedores">
          <div className="bg-card rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {columnasRender.map((c) => columnDefs[c.campo]?.th)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetalleProveedor(p)}>
                    {columnasRender.map((c) => columnDefs[c.campo]?.td(p))}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={20} className="text-center py-12 text-muted-foreground">No se encontraron proveedores.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          </ResizableColumnsProvider>
          <div className="text-xs text-muted-foreground text-right">{filtered.length} de {proveedores.length} proveedores</div>
        </>
      )}

      {/* Modal */}
      <ProveedorModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} item={editItem} empresaId={empresaActual.id} categorias={categoriasBD} />

      <ImportadorIACatalogoDialog
        open={iaProvOpen}
        onOpenChange={setIaProvOpen}
        config={iaProveedoresConfig}
        onImportSuccess={() => loadProveedores()}
      />
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────

function ProveedorModal({ open, onClose, onSave, item, empresaId, categorias }: { open: boolean; onClose: () => void; onSave: (p: Proveedor) => void; item: Proveedor | null; empresaId: string; categorias: string[] }) {
  const isEdit = !!item;
  const opcionesCategoria = categorias.length > 0 ? categorias : (CATEGORIAS_PROVEEDOR as unknown as string[]);
  const blankFactory = useCallback((): Proveedor => ({
    id: `prov-${Date.now()}`, empresaId, nombreComercial: "", razonSocial: "", cifNif: "",
    categoria: opcionesCategoria[0], estado: "Activo", observaciones: "",
    personaContacto: "", telefonoPrincipal: "", telefonoSecundario: "", telefonoComercial: "",
    emailPrincipal: "", emailComercial: "", emailPedidos: "", emailContabilidad: "", web: "",
    direccion: "", ciudad: "", provincia: "", pais: "España", codigoPostal: "",
    diasReparto: [], horarioReparto: {}, diasRepartoNegociados: [], horarioRepartoNegociado: {}, diaRepartoNegociado: "",
    viaPago: "", viaPagoNegociada: "", plazoPago: "", plazoPagoNegociado: "",
    condicionesPago: "", plazo: "", observacionesLogisticas: "", comentariosInternos: "",
    creador: "Usuario", createdAt: new Date().toISOString().slice(0, 10), ultimaActualizacion: new Date().toISOString().slice(0, 10),
  }), [empresaId, opcionesCategoria]);
  const [form, setForm] = useState<Proveedor>(() => item || blankFactory());
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const { validar, admiteBorrador } = useReglasSubmodulo("logistica", "proveedores");

  useEffect(() => { setForm(item || blankFactory()); }, [item, open, blankFactory]);

  const upd = (key: keyof Proveedor, val: unknown) => setForm((prev) => ({ ...prev, [key]: val }));

  const formValues = {
    nombreComercial: form.nombreComercial,
    razonSocial: form.razonSocial,
    cifNif: form.cifNif,
    categoria: form.categoria,
    personaContacto: form.personaContacto,
    telefonoPrincipal: form.telefonoPrincipal,
    emailPrincipal: form.emailPrincipal,
    emailPedidos: form.emailPedidos,
    direccion: form.direccion,
    ciudad: form.ciudad,
    codigoPostal: form.codigoPostal,
    viaPago: form.viaPago,
    plazoPago: form.plazoPago,
  };
  const { labelsFaltantes } = validar(formValues);

  const handleSubmit = () => {
    // Al editar dejamos pasar (el registro ya existe).
    if (!isEdit && labelsFaltantes.length > 0) {
      setFaltantes(labelsFaltantes);
      return;
    }
    // Si veníamos de borrador y ahora está completo → pasar a Activo.
    const estadoFinal: EstadoProveedor = form.estado === "Borrador" ? "Activo" : form.estado;
    onSave({ ...form, estado: estadoFinal, ultimaActualizacion: new Date().toISOString().slice(0, 10) });
    toast.success(isEdit ? "Proveedor actualizado" : "Proveedor creado");
    onClose();
  };

  const handleGuardarBorrador = () => {
    // Borrador siempre se puede guardar — solo exigimos nombre comercial mínimo para identificarlo.
    if (!form.nombreComercial.trim()) {
      toast.error("Necesitas al menos el nombre comercial para guardar el borrador");
      return;
    }
    onSave({ ...form, estado: "Borrador", ultimaActualizacion: new Date().toISOString().slice(0, 10) });
    toast.info("Proveedor guardado como borrador");
    onClose();
  };

  const toggleDia = (dia: string) => {
    setForm((prev) => ({
      ...prev,
      diasReparto: prev.diasReparto.includes(dia) ? prev.diasReparto.filter((d) => d !== dia) : [...prev.diasReparto, dia],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle></DialogHeader>
        <div className="space-y-5 py-2">
          {/* General */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Datos generales</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="nombreComercial">Nombre comercial</LabelConRegla><Input className="uppercase" value={form.nombreComercial} onChange={(e) => upd("nombreComercial", e.target.value.toUpperCase())} /></div>
              <div><LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="razonSocial">Razón social</LabelConRegla><Input value={form.razonSocial} onChange={(e) => upd("razonSocial", e.target.value)} /></div>
              <div><LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="cifNif">CIF/NIF</LabelConRegla><Input value={form.cifNif} onChange={(e) => upd("cifNif", e.target.value)} /></div>
              <div>
                <LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="categoria">Categoría</LabelConRegla>
                <Select value={form.categoria || opcionesCategoria[0]} onValueChange={(v) => upd("categoria", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{opcionesCategoria.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={(v) => upd("estado", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADOS_PROVEEDOR.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Observaciones</Label><Textarea value={form.observaciones} onChange={(e) => upd("observaciones", e.target.value)} rows={2} /></div>
            </div>
          </div>
          <Separator />
          {/* Contacto empresa */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Contacto de la empresa</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="telefonoPrincipal">Teléfono</LabelConRegla><Input value={form.telefonoPrincipal} onChange={(e) => upd("telefonoPrincipal", e.target.value)} /></div>
              <div><LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="emailPrincipal">Email</LabelConRegla><Input type="email" value={form.emailPrincipal} onChange={(e) => upd("emailPrincipal", e.target.value)} /></div>
              <div><Label>Web</Label><Input value={form.web} onChange={(e) => upd("web", e.target.value)} /></div>
            </div>
          </div>
          <Separator />
          {/* Comercial asignado */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Comercial asignado</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="personaContacto">Nombre</LabelConRegla><Input value={form.personaContacto} onChange={(e) => upd("personaContacto", e.target.value)} /></div>
              <div><Label>Teléfono</Label><Input value={form.telefonoComercial} onChange={(e) => upd("telefonoComercial", e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={form.emailComercial} onChange={(e) => upd("emailComercial", e.target.value)} /></div>
            </div>
          </div>
          <Separator />
          {/* Otros correos */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Otros correos</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="emailPedidos">Email para pedidos</LabelConRegla><Input type="email" value={form.emailPedidos} onChange={(e) => upd("emailPedidos", e.target.value)} placeholder="Obligatorio para enviar pedidos" /></div>
              <div><Label>Email contabilidad</Label><Input type="email" value={form.emailContabilidad} onChange={(e) => upd("emailContabilidad", e.target.value)} /></div>
            </div>
          </div>
          <Separator />
          {/* Dirección */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Dirección</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="direccion">Dirección</LabelConRegla><Input value={form.direccion} onChange={(e) => upd("direccion", e.target.value)} /></div>
              <div><LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="ciudad">Ciudad</LabelConRegla><Input value={form.ciudad} onChange={(e) => upd("ciudad", e.target.value)} /></div>
              <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => upd("provincia", e.target.value)} /></div>
              <div><Label>País</Label><Input value={form.pais} onChange={(e) => upd("pais", e.target.value)} /></div>
              <div><LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="codigoPostal">Código postal</LabelConRegla><Input value={form.codigoPostal} onChange={(e) => upd("codigoPostal", e.target.value)} /></div>
            </div>
          </div>
          <Separator />
          {/* Pago */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Formas de pago</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="viaPago">Vía de pago</LabelConRegla>
                  <Select value={form.viaPago || ""} onValueChange={(v) => upd("viaPago", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar vía…" /></SelectTrigger>
                    <SelectContent>{VIAS_PAGO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <LabelConRegla moduloKey="logistica" submoduloKey="proveedores" campoKey="plazoPago">Plazo de pago</LabelConRegla>
                  <Select value={form.plazoPago || ""} onValueChange={(v) => upd("plazoPago", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar plazo…" /></SelectTrigger>
                    <SelectContent>{PLAZOS_PAGO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.viaPago === "Otro" && (
                  <div className="col-span-2"><Label>Detalle vía</Label><Input value={form.viaPagoNegociada} onChange={(e) => upd("viaPagoNegociada", e.target.value)} placeholder="Ej: pagaré bancario, compensación…" /></div>
                )}
                {form.plazoPago === "Otro" && (
                  <div className="col-span-2"><Label>Detalle plazo</Label><Input value={form.plazoPagoNegociado} onChange={(e) => upd("plazoPagoNegociado", e.target.value)} placeholder="Ej: fin de mes vista factura, 90 días…" /></div>
                )}
              </div>
            </div>
          </div>
          <Separator />
          {/* Reparto */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Reparto</h3>
            <div className="space-y-3">
              <div>
                <Label className="mb-2 block">Días de reparto</Label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_REPARTO.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox checked={form.diasReparto.includes(d)} onCheckedChange={() => toggleDia(d)} />
                      {d}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">El horario por día se configura desde la ficha del proveedor.</p>
              </div>
              <div><Label>Día / horario negociado</Label><Input value={form.diaRepartoNegociado} onChange={(e) => upd("diaRepartoNegociado", e.target.value)} placeholder="Ej: bajo demanda con 24h, según pedido mínimo…" /></div>
              <div><Label>Observaciones logísticas</Label><Textarea value={form.observacionesLogisticas} onChange={(e) => upd("observacionesLogisticas", e.target.value)} rows={2} /></div>
              <div><Label>Comentarios internos</Label><Textarea value={form.comentariosInternos} onChange={(e) => upd("comentariosInternos", e.target.value)} rows={2} /></div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {isEdit ? (
            <Button onClick={handleSubmit}>Guardar cambios</Button>
          ) : (
            <BotonesGuardarBorrador
              onGuardar={handleSubmit}
              onGuardarBorrador={handleGuardarBorrador}
              faltantes={labelsFaltantes}
              labelGuardar="Crear proveedor"
              admiteBorrador={admiteBorrador}
            />
          )}
        </DialogFooter>
      </DialogContent>

      <ValidacionFaltantesDialog
        open={faltantes.length > 0}
        onClose={() => setFaltantes([])}
        campos={faltantes}
        submoduloLabel="Proveedores"
      />
    </Dialog>
  );
}

// ─── Configuración: editor inline de categorías de proveedor ──────

function CategoriasProveedorManager({
  items,
  onChanged,
}: {
  items: CategoriaProveedorRow[];
  onChanged: () => Promise<void>;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [newVal, setNewVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [iaOpen, setIaOpen] = useState(false);

  const iaConfig: ImportadorEntityConfig = {
    titulo: "Importar categorías de proveedor con IA",
    subtitulo:
      "Sube cualquier archivo. La IA extraerá las categorías de proveedor únicas y las podrás revisar antes de añadir.",
    campos: [
      { key: "nombre", label: "Nombre de la categoría", obligatorio: true, tipo: "texto" },
    ],
    analyze: analizarCategoriasProveedorIA,
    save: guardarCategoriasProveedorIA,
  };

  const startEdit = (id: string, nombre: string) => {
    setEditId(id);
    setEditVal(nombre);
  };

  const confirmEdit = async () => {
    if (!editId) return;
    const trimmed = editVal.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await updateCategoriaProveedor(editId, { nombre: trimmed });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setEditId(null);
    await onChanged();
    toast.success("Categoría actualizada");
  };

  const remove = async (id: string) => {
    setBusy(true);
    const res = await deleteCategoriaProveedor(id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await onChanged();
    toast.success("Categoría eliminada");
  };

  const add = async () => {
    const trimmed = newVal.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await createCategoriaProveedor({ nombre: trimmed });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setNewVal("");
    await onChanged();
    toast.success("Categoría creada");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Categorías</h4>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIaOpen(true)}
          className="gap-1 h-7 text-xs"
          title="Importar varias categorías desde un archivo"
        >
          <Sparkles className="h-3 w-3 text-amber-500" /> Importar con IA
        </Button>
      </div>
      <div className="rounded-md border divide-y">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 px-3 py-1.5">
            {editId === it.id ? (
              <>
                <Input
                  autoFocus
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmEdit();
                    if (e.key === "Escape") setEditId(null);
                  }}
                  className="h-7 text-sm flex-1"
                />
                <Button size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={confirmEdit}>
                  Guardar
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{it.nombre}</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(it.id, it.nombre)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => remove(it.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Input
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="Nueva categoría…"
            className="h-7 text-sm flex-1"
          />
          <Button size="sm" className="h-7 px-3 text-xs gap-1" disabled={busy} onClick={add}>
            <Plus className="h-3 w-3" /> Añadir
          </Button>
        </div>
      </div>

      <ImportadorIACatalogoDialog
        open={iaOpen}
        onOpenChange={setIaOpen}
        config={iaConfig}
        onImportSuccess={() => {
          void onChanged();
        }}
      />
    </div>
  );
}
