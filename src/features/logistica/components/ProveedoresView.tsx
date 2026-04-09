"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getProveedoresPorEmpresa, ESTADOS_PROVEEDOR, CATEGORIAS_PROVEEDOR, DIAS_REPARTO,
  type Proveedor, type EstadoProveedor,
} from "@/features/logistica/data/proveedores";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Plus, Pencil, ArrowLeft, Truck, Phone, Mail, Globe, MapPin, CalendarDays, FileText, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const ALL = "__ALL__";

function EstadoBadge({ value }: { value: EstadoProveedor }) {
  const cls: Record<string, string> = {
    Activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    Inactivo: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    Archivado: "bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400",
  };
  return <Badge className={`${cls[value] || ""} border-0 text-[11px]`}>{value}</Badge>;
}

export function ProveedoresView() {
  const pathname = usePathname();
  useEffect(() => { sessionStorage.setItem("logistica_last", pathname); }, [pathname]);

  const { empresaActual } = useEmpresa();
  const [proveedores, setProveedores] = useState<Proveedor[]>(() => getProveedoresPorEmpresa(empresaActual.id));
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState(ALL);
  const [filterCategoria, setFilterCategoria] = useState(ALL);
  const [detalleProveedor, setDetalleProveedor] = useState<Proveedor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Proveedor | null>(null);

  useMemo(() => { setProveedores(getProveedoresPorEmpresa(empresaActual.id)); }, [empresaActual.id]);

  const filtered = useMemo(() => {
    return proveedores.filter((p) => {
      if (filterEstado !== ALL && p.estado !== filterEstado) return false;
      if (filterCategoria !== ALL && p.categoria !== filterCategoria) return false;
      if (search) {
        const s = search.toLowerCase();
        return p.nombreComercial.toLowerCase().includes(s) || p.personaContacto.toLowerCase().includes(s) || p.emailPrincipal.toLowerCase().includes(s);
      }
      return true;
    });
  }, [proveedores, search, filterEstado, filterCategoria]);

  const stats = { total: proveedores.length, activos: proveedores.filter((p) => p.estado === "Activo").length, inactivos: proveedores.filter((p) => p.estado === "Inactivo").length };

  const handleSave = (item: Proveedor) => {
    setProveedores((prev) => {
      const exists = prev.find((p) => p.id === item.id);
      if (exists) return prev.map((p) => (p.id === item.id ? item : p));
      return [item, ...prev];
    });
  };

  // ── Detail view ──
  if (detalleProveedor) {
    const p = detalleProveedor;
    return (
      <div className="p-4 md:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setDetalleProveedor(null)} className="gap-1"><ArrowLeft className="h-4 w-4" /> Volver</Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="gap-1" onClick={() => { setEditItem(p); setModalOpen(true); }}><Pencil className="h-4 w-4" /> Editar</Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-xl font-black tracking-tight">{p.nombreComercial}</CardTitle>
              <EstadoBadge value={p.estado} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground text-xs block">Razón social</span><span className="font-medium">{p.razonSocial || "—"}</span></div>
              <div><span className="text-muted-foreground text-xs block">CIF/NIF</span><span className="font-medium">{p.cifNif || "—"}</span></div>
              <div><span className="text-muted-foreground text-xs block">Categoría</span><span className="font-medium">{p.categoria}</span></div>
              <div><span className="text-muted-foreground text-xs block">Creador</span><span className="font-medium">{p.creador}</span></div>
            </div>
            {p.observaciones && <p className="text-sm text-muted-foreground mt-3">{p.observaciones}</p>}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contacto */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4" /> CONTACTO</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground text-xs block">Persona de contacto</span><span className="font-medium">{p.personaContacto || "—"}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground text-xs block">Teléfono principal</span><span className="font-medium">{p.telefonoPrincipal || "—"}</span></div>
                <div><span className="text-muted-foreground text-xs block">Teléfono secundario</span><span className="font-medium">{p.telefonoSecundario || "—"}</span></div>
              </div>
              <Separator />
              <div><span className="text-muted-foreground text-xs block">Email principal</span><span className="font-medium">{p.emailPrincipal || "—"}</span></div>
              <div className="flex items-center gap-2">
                <div className="flex-1"><span className="text-muted-foreground text-xs block">Email para pedidos</span><span className={`font-medium ${!p.emailPedidos ? "text-destructive" : ""}`}>{p.emailPedidos || "Sin configurar"}</span></div>
                {!p.emailPedidos && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
              </div>
              <div><span className="text-muted-foreground text-xs block">Email incidencias</span><span className="font-medium">{p.emailIncidencias || "—"}</span></div>
              {p.web && <div><span className="text-muted-foreground text-xs block">Web</span><span className="font-medium">{p.web}</span></div>}
            </CardContent>
          </Card>

          {/* Dirección */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> DIRECCIÓN</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground text-xs block">Dirección</span><span className="font-medium">{p.direccion || "—"}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground text-xs block">Ciudad</span><span className="font-medium">{p.ciudad || "—"}</span></div>
                <div><span className="text-muted-foreground text-xs block">Provincia</span><span className="font-medium">{p.provincia || "—"}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground text-xs block">País</span><span className="font-medium">{p.pais || "—"}</span></div>
                <div><span className="text-muted-foreground text-xs block">Código postal</span><span className="font-medium">{p.codigoPostal || "—"}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Condiciones */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4" /> CONDICIONES LOGÍSTICAS</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs block">Días de reparto</span>
                <div className="flex flex-wrap gap-1 mt-1">{p.diasReparto.length > 0 ? p.diasReparto.map((d) => <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>) : <span className="text-muted-foreground">—</span>}</div>
              </div>
              <div><span className="text-muted-foreground text-xs block">Condiciones de pago</span><span className="font-medium">{p.condicionesPago || "—"}</span></div>
              <div><span className="text-muted-foreground text-xs block">Plazo de entrega</span><span className="font-medium">{p.plazo || "—"}</span></div>
              <div><span className="text-muted-foreground text-xs block">Última actualización</span><span className="font-medium">{p.ultimaActualizacion}</span></div>
            </div>
            {p.observacionesLogisticas && <p className="text-sm text-muted-foreground mt-3"><span className="text-xs font-medium text-foreground block">Observaciones logísticas</span>{p.observacionesLogisticas}</p>}
            {p.comentariosInternos && <p className="text-sm text-muted-foreground mt-2"><span className="text-xs font-medium text-foreground block">Comentarios internos</span>{p.comentariosInternos}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main list view ──
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Truck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">PROVEEDORES</h1>
            <p className="text-sm text-muted-foreground">Gestión de proveedores — {empresaActual.nombre}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-black text-foreground">{stats.total}</div>
          <p className="text-xs text-muted-foreground font-medium">Total</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.activos}</div>
          <p className="text-xs text-muted-foreground font-medium">Activos</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.inactivos}</div>
          <p className="text-xs text-muted-foreground font-medium">Inactivos</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-card rounded-lg border p-3">
        <Button size="sm" className="gap-1" onClick={() => { setEditItem(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Nuevo proveedor</Button>
        <div className="flex-1" />
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar proveedores…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Todos</SelectItem>{ESTADOS_PROVEEDOR.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Todas</SelectItem>{CATEGORIAS_PROVEEDOR.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            {["Proveedor", "Categoría", "Contacto", "Teléfono", "Email pedidos", "Estado", "Últ. Actualización"].map((h) => (
              <th key={h} className="px-3 py-3 text-left text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setDetalleProveedor(p)}>
                <td className="px-3 py-2.5 font-semibold text-primary whitespace-nowrap">{p.nombreComercial}</td>
                <td className="px-3 py-2.5 text-xs">{p.categoria}</td>
                <td className="px-3 py-2.5 text-xs font-medium">{p.personaContacto || "—"}</td>
                <td className="px-3 py-2.5 text-xs">{p.telefonoPrincipal || "—"}</td>
                <td className="px-3 py-2.5 text-xs">
                  {p.emailPedidos ? (
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {p.emailPedidos}</span>
                  ) : (
                    <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" /> Sin configurar</span>
                  )}
                </td>
                <td className="px-3 py-2.5"><EstadoBadge value={p.estado} /></td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.ultimaActualizacion}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No se encontraron proveedores.</td></tr>
            )}
          </tbody>
        </table>
      </div>
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
    personaContacto: "", telefonoPrincipal: "", telefonoSecundario: "",
    emailPrincipal: "", emailPedidos: "", emailIncidencias: "", web: "",
    direccion: "", ciudad: "", provincia: "", pais: "España", codigoPostal: "",
    diasReparto: [], condicionesPago: "", plazo: "", observacionesLogisticas: "", comentariosInternos: "",
    creador: "Usuario", createdAt: new Date().toISOString().slice(0, 10), ultimaActualizacion: new Date().toISOString().slice(0, 10),
  };
  const [form, setForm] = useState<Proveedor>(item || blank);

  useMemo(() => { setForm(item || blank); }, [item, open]);

  const upd = (key: keyof Proveedor, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    if (!form.nombreComercial.trim()) { toast.error("El nombre comercial es obligatorio"); return; }
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
                <Select value={form.categoria} onValueChange={(v) => upd("categoria", v)}>
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
          {/* Contacto */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Contacto</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Persona de contacto</Label><Input value={form.personaContacto} onChange={(e) => upd("personaContacto", e.target.value)} /></div>
              <div><Label>Teléfono principal</Label><Input value={form.telefonoPrincipal} onChange={(e) => upd("telefonoPrincipal", e.target.value)} /></div>
              <div><Label>Teléfono secundario</Label><Input value={form.telefonoSecundario} onChange={(e) => upd("telefonoSecundario", e.target.value)} /></div>
              <div><Label>Email principal</Label><Input type="email" value={form.emailPrincipal} onChange={(e) => upd("emailPrincipal", e.target.value)} /></div>
              <div><Label>Email para pedidos</Label><Input type="email" value={form.emailPedidos} onChange={(e) => upd("emailPedidos", e.target.value)} placeholder="Obligatorio para enviar pedidos" /></div>
              <div><Label>Email incidencias</Label><Input type="email" value={form.emailIncidencias} onChange={(e) => upd("emailIncidencias", e.target.value)} /></div>
              <div><Label>Web</Label><Input value={form.web} onChange={(e) => upd("web", e.target.value)} /></div>
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
          {/* Condiciones */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3">Condiciones logísticas</h3>
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Condiciones de pago</Label><Input value={form.condicionesPago} onChange={(e) => upd("condicionesPago", e.target.value)} placeholder="Ej: 30 días, contado…" /></div>
                <div><Label>Plazo de entrega</Label><Input value={form.plazo} onChange={(e) => upd("plazo", e.target.value)} placeholder="Ej: 24h, 48h…" /></div>
              </div>
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
    </Dialog>
  );
}
