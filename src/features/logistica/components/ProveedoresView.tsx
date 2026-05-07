"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  ESTADOS_PROVEEDOR, CATEGORIAS_PROVEEDOR, DIAS_REPARTO, VIAS_PAGO, PLAZOS_PAGO,
  type Proveedor, type EstadoProveedor,
} from "@/features/logistica/data/proveedores";
import { listProveedores, createProveedor, updateProveedor, deleteProveedor } from "@/features/logistica/actions/proveedores-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, AlertTriangle, Settings } from "lucide-react";
import {
  SubmoduleToolbar,
  aplicarFiltrosToolbar,
  aplicarOrdenToolbar,
  coincideBusquedaUniversal,
  colVisible,
  type ToolbarFiltroActivo,
  type ToolbarOrdenActivo,
  type ToolbarColumnaVisible,
} from "@/shared/components/SubmoduleToolbar";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { IOActions } from "@/shared/io";
import { proveedoresIO } from "@/features/logistica/io/proveedores.io";
import { ProveedorDetail } from "@/features/logistica/components/ProveedorDetail";
import { useReglasSubmodulo } from "@/features/ajustes/hooks/use-reglas-submodulo";
import { ValidacionFaltantesDialog } from "@/features/ajustes/components/ValidacionFaltantesDialog";
import { toast } from "sonner";

function EstadoBadge({ value }: { value: EstadoProveedor }) {
  const cls: Record<string, string> = {
    Activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    Inactivo: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    Archivado: "bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400",
  };
  return <Badge className={`${cls[value] || ""} border-0 text-[11px]`}>{value}</Badge>;
}

function mapDbToProveedor(row: Record<string, unknown>): Proveedor {
  return {
    id: row.id as string,
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<ToolbarFiltroActivo[]>([]);
  const [orden, setOrden] = useState<ToolbarOrdenActivo | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({});
  const [detalleProveedor, setDetalleProveedor] = useState<Proveedor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Proveedor | null>(null);
  const [showConfig, setShowConfig] = useState(false);

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

  const stats = { total: proveedores.length, activos: proveedores.filter((p) => p.estado === "Activo").length, inactivos: proveedores.filter((p) => p.estado === "Inactivo").length };

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
  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header removed — title shown in top bar */}

      {/* Toolbar */}
      <SubmoduleToolbar
        busqueda={search}
        onBusquedaChange={setSearch}
        placeholderBusqueda="Buscar"
        onNuevo={() => { setEditItem(null); setModalOpen(true); }}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        columnas={[
          { campo: "proveedor", label: "Proveedor", bloqueada: true },
          { campo: "categoria", label: "Categoría" },
          { campo: "contacto", label: "Contacto" },
          { campo: "telefono", label: "Teléfono" },
          { campo: "emailPedidos", label: "Email pedidos" },
          { campo: "estado", label: "Estado" },
          { campo: "ultimaActualizacion", label: "Últ. Actualización" },
        ]}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        extraDerecha={
          <>
            <IOActions config={proveedoresIO} onSuccess={() => window.location.reload()} />
            <Button size="icon" variant={showConfig ? "default" : "outline"} className="h-9 w-9" onClick={() => setShowConfig((v) => !v)} title="Configuración" aria-label="Configuración">
              <Settings className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      />

      {showConfig && (
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">Configuración de proveedores — próximamente.</p>
        </div>
      )}

      {/* Table */}
      <ResizableColumnsProvider storageKey="logistica-proveedores">
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <TableColumnHeader
                label="Proveedor"
                campo="nombreComercial"
                ordenable
                orden={orden}
                onOrdenChange={setOrden}
              />
              {colVisible(columnasVisibles, "categoria") && (
                <TableColumnHeader
                  label="Categoría"
                  campo="categoria"
                  filtroTipo="lista"
                  opciones={categoriasUsadas.length > 0 ? categoriasUsadas : (CATEGORIAS_PROVEEDOR as unknown as string[])}
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
              {colVisible(columnasVisibles, "contacto") && <TableColumnHeader label="Contacto" />}
              {colVisible(columnasVisibles, "telefono") && <TableColumnHeader label="Teléfono" />}
              {colVisible(columnasVisibles, "emailPedidos") && <TableColumnHeader label="Email pedidos" />}
              {colVisible(columnasVisibles, "estado") && (
                <TableColumnHeader
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
              )}
              {colVisible(columnasVisibles, "ultimaActualizacion") && (
                <TableColumnHeader
                  label="Últ. Actualización"
                  campo="ultimaActualizacion"
                  filtroTipo="fecha"
                  filtros={filtros}
                  onFiltrosChange={setFiltros}
                  ordenable
                  orden={orden}
                  onOrdenChange={setOrden}
                />
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetalleProveedor(p)}>
                <td className="px-3 py-2.5 font-semibold text-primary whitespace-nowrap">{p.nombreComercial}</td>
                {colVisible(columnasVisibles, "categoria") && (
                  <td className="px-3 py-2.5 text-xs">{p.categoria}</td>
                )}
                {colVisible(columnasVisibles, "contacto") && (
                  <td className="px-3 py-2.5 text-xs font-medium">{p.personaContacto || "—"}</td>
                )}
                {colVisible(columnasVisibles, "telefono") && (
                  <td className="px-3 py-2.5 text-xs">{p.telefonoPrincipal || "—"}</td>
                )}
                {colVisible(columnasVisibles, "emailPedidos") && (
                  <td className="px-3 py-2.5 text-xs">
                    {p.emailPedidos ? (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {p.emailPedidos}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> Sin configurar</span>
                    )}
                  </td>
                )}
                {colVisible(columnasVisibles, "estado") && (
                  <td className="px-3 py-2.5"><EstadoBadge value={p.estado} /></td>
                )}
                {colVisible(columnasVisibles, "ultimaActualizacion") && (
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.ultimaActualizacion}</td>
                )}
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

      {/* Modal */}
      <ProveedorModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} item={editItem} empresaId={empresaActual.id} />
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────

function ProveedorModal({ open, onClose, onSave, item, empresaId }: { open: boolean; onClose: () => void; onSave: (p: Proveedor) => void; item: Proveedor | null; empresaId: string }) {
  const isEdit = !!item;
  const blank: Proveedor = {
    id: `prov-${Date.now()}`, empresaId, nombreComercial: "", razonSocial: "", cifNif: "",
    categoria: CATEGORIAS_PROVEEDOR[0], estado: "Activo", observaciones: "",
    personaContacto: "", telefonoPrincipal: "", telefonoSecundario: "", telefonoComercial: "",
    emailPrincipal: "", emailComercial: "", emailPedidos: "", emailContabilidad: "", web: "",
    direccion: "", ciudad: "", provincia: "", pais: "España", codigoPostal: "",
    diasReparto: [], horarioReparto: {}, diasRepartoNegociados: [], horarioRepartoNegociado: {}, diaRepartoNegociado: "",
    viaPago: "", viaPagoNegociada: "", plazoPago: "", plazoPagoNegociado: "",
    condicionesPago: "", plazo: "", observacionesLogisticas: "", comentariosInternos: "",
    creador: "Usuario", createdAt: new Date().toISOString().slice(0, 10), ultimaActualizacion: new Date().toISOString().slice(0, 10),
  };
  const [form, setForm] = useState<Proveedor>(item || blank);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const { validar } = useReglasSubmodulo("logistica", "proveedores");

  useMemo(() => { setForm(item || blank); }, [item, open]);

  const upd = (key: keyof Proveedor, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    // Solo validamos al CREAR (al editar dejamos pasar; el registro ya existe).
    if (!isEdit) {
      const { labelsFaltantes } = validar({
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
      });
      if (labelsFaltantes.length > 0) {
        setFaltantes(labelsFaltantes);
        return;
      }
    }
    onSave({ ...form, ultimaActualizacion: new Date().toISOString().slice(0, 10) });
    toast.success(isEdit ? "Proveedor actualizado" : "Proveedor creado");
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
              <div className="col-span-2"><Label>Nombre comercial *</Label><Input value={form.nombreComercial} onChange={(e) => upd("nombreComercial", e.target.value)} /></div>
              <div><Label>Razón social</Label><Input value={form.razonSocial} onChange={(e) => upd("razonSocial", e.target.value)} /></div>
              <div><Label>CIF/NIF</Label><Input value={form.cifNif} onChange={(e) => upd("cifNif", e.target.value)} /></div>
              <div>
                <Label>Categoría</Label>
                <Select value={form.categoria || CATEGORIAS_PROVEEDOR[0]} onValueChange={(v) => upd("categoria", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS_PROVEEDOR.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
              <div><Label>Teléfono</Label><Input value={form.telefonoPrincipal} onChange={(e) => upd("telefonoPrincipal", e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={form.emailPrincipal} onChange={(e) => upd("emailPrincipal", e.target.value)} /></div>
              <div><Label>Web</Label><Input value={form.web} onChange={(e) => upd("web", e.target.value)} /></div>
            </div>
          </div>
          <Separator />
          {/* Comercial asignado */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Comercial asignado</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Nombre</Label><Input value={form.personaContacto} onChange={(e) => upd("personaContacto", e.target.value)} /></div>
              <div><Label>Teléfono</Label><Input value={form.telefonoComercial} onChange={(e) => upd("telefonoComercial", e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={form.emailComercial} onChange={(e) => upd("emailComercial", e.target.value)} /></div>
            </div>
          </div>
          <Separator />
          {/* Otros correos */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Otros correos</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email para pedidos</Label><Input type="email" value={form.emailPedidos} onChange={(e) => upd("emailPedidos", e.target.value)} placeholder="Obligatorio para enviar pedidos" /></div>
              <div><Label>Email contabilidad</Label><Input type="email" value={form.emailContabilidad} onChange={(e) => upd("emailContabilidad", e.target.value)} /></div>
            </div>
          </div>
          <Separator />
          {/* Dirección */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Dirección</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Dirección</Label><Input value={form.direccion} onChange={(e) => upd("direccion", e.target.value)} /></div>
              <div><Label>Ciudad</Label><Input value={form.ciudad} onChange={(e) => upd("ciudad", e.target.value)} /></div>
              <div><Label>Provincia</Label><Input value={form.provincia} onChange={(e) => upd("provincia", e.target.value)} /></div>
              <div><Label>País</Label><Input value={form.pais} onChange={(e) => upd("pais", e.target.value)} /></div>
              <div><Label>Código postal</Label><Input value={form.codigoPostal} onChange={(e) => upd("codigoPostal", e.target.value)} /></div>
            </div>
          </div>
          <Separator />
          {/* Pago */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Formas de pago</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vía de pago</Label>
                  <Select value={form.viaPago || ""} onValueChange={(v) => upd("viaPago", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar vía…" /></SelectTrigger>
                    <SelectContent>{VIAS_PAGO.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Plazo de pago</Label>
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>{isEdit ? "Guardar cambios" : "Crear proveedor"}</Button>
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
