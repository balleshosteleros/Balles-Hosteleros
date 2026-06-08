"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ESTADOS_PROVEEDOR,
  CATEGORIAS_PROVEEDOR,
  DIAS_REPARTO,
  VIAS_PAGO,
  PLAZOS_PAGO,
  FRANJAS_REPARTO,
  type Proveedor,
  type EstadoProveedor,
} from "@/features/logistica/data/proveedores";
import type { Producto } from "@/features/logistica/data/productos";
import { listProductos } from "@/features/logistica/actions/producto-actions";
import { listCategoriasProveedor } from "@/features/logistica/actions/categorias-proveedor-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Save,
  Phone,
  Receipt,
  CreditCard,
  Tag,
  Package,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

type Props = {
  proveedor: Proveedor;
  onBack: () => void;
  onSave: (p: Proveedor) => Promise<boolean>;
};

export function ProveedorDetail({ proveedor, onBack, onSave }: Props) {
  const [form, setForm] = useState<Proveedor>(proveedor);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  useGlobalLoadingSync(saving || loadingProductos);
  const [categoriasBD, setCategoriasBD] = useState<string[]>([]);
  const originalRef = useRef<Proveedor>(proveedor);

  useEffect(() => {
    setForm(proveedor);
    originalRef.current = proveedor;
  }, [proveedor.id]);

  useEffect(() => {
    listCategoriasProveedor().then((res) => {
      if (res.ok) setCategoriasBD(res.data.filter((c) => c.activa).map((c) => c.nombre));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingProductos(true);
    listProductos("compra")
      .then((data) => {
        if (!cancelled) setProductos(data);
      })
      .catch(() => {
        if (!cancelled) setProductos([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProductos(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const productosAsociados = useMemo(() => {
    const nombre = form.nombreComercial.trim().toLowerCase();
    if (!nombre) return [];
    return productos.filter(
      (p) => (p.proveedor ?? "").trim().toLowerCase() === nombre,
    );
  }, [productos, form.nombreComercial]);

  const categoriasDerivadas = useMemo(
    () =>
      [...new Set(productosAsociados.map((p) => p.categoria).filter(Boolean))].sort(),
    [productosAsociados],
  );

  const dirty = JSON.stringify(form) !== JSON.stringify(originalRef.current);

  const upd = <K extends keyof Proveedor>(key: K, val: Proveedor[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  type RepartoScope = "generico" | "negociado";
  const camposReparto = (scope: RepartoScope) =>
    scope === "generico"
      ? { dias: "diasReparto" as const, horario: "horarioReparto" as const }
      : { dias: "diasRepartoNegociados" as const, horario: "horarioRepartoNegociado" as const };

  const toggleDiaScope = (scope: RepartoScope, dia: string) =>
    setForm((prev) => {
      const { dias, horario } = camposReparto(scope);
      const listaActual = prev[dias] ?? [];
      const horarioActual = prev[horario] ?? {};
      const yaIncluido = listaActual.includes(dia);
      const nuevosDias = yaIncluido
        ? listaActual.filter((d) => d !== dia)
        : [...listaActual, dia].sort(
            (a, b) => DIAS_REPARTO.indexOf(a) - DIAS_REPARTO.indexOf(b),
          );
      const nuevoHorario = { ...horarioActual };
      if (yaIncluido) delete nuevoHorario[dia];
      return { ...prev, [dias]: nuevosDias, [horario]: nuevoHorario };
    });

  const setHorarioDiaScope = (scope: RepartoScope, dia: string, valor: string) =>
    setForm((prev) => {
      const { horario } = camposReparto(scope);
      return { ...prev, [horario]: { ...(prev[horario] || {}), [dia]: valor } };
    });

  const persist = async (afterSave?: () => void) => {
    if (!form.nombreComercial.trim()) {
      toast.error("El nombre comercial es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const updated: Proveedor = {
        ...form,
        ultimaActualizacion: new Date().toISOString().slice(0, 10),
      };
      const ok = await onSave(updated);
      if (ok) {
        originalRef.current = updated;
        setForm(updated);
        toast.success("Proveedor actualizado");
        afterSave?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (dirty) setShowConfirm(true);
    else onBack();
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          className="gap-1"
          onClick={() => persist()}
          disabled={!dirty || saving}
        >
          <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>

      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex-1 min-w-[260px]">
              <Label className="text-xs">Nombre comercial *</Label>
              <Input
                className="text-xl font-black tracking-tight h-11 uppercase"
                value={form.nombreComercial}
                onChange={(e) => upd("nombreComercial", e.target.value.toUpperCase())}
              />
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="min-w-[160px]">
                <Label className="text-xs">Estado</Label>
                <Select
                  value={form.estado}
                  onValueChange={(v) => upd("estado", v as EstadoProveedor)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_PROVEEDOR.filter((e) => e !== "Archivado").map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[180px]">
                <Label className="text-xs">Categoría</Label>
                <Select
                  value={form.categoria || categoriasBD[0] || CATEGORIAS_PROVEEDOR[0]}
                  onValueChange={(v) => upd("categoria", v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(categoriasBD.length > 0 ? categoriasBD : (CATEGORIAS_PROVEEDOR as unknown as string[])).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Datos Fiscales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" /> DATOS FISCALES
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Razón social</Label>
              <Input
                value={form.razonSocial}
                onChange={(e) => upd("razonSocial", e.target.value)}
              />
            </div>
            <div>
              <Label>CIF/NIF</Label>
              <Input
                value={form.cifNif}
                onChange={(e) => upd("cifNif", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Dirección fiscal</Label>
            <Input
              value={form.direccion}
              onChange={(e) => upd("direccion", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Ciudad</Label>
              <Input
                value={form.ciudad}
                onChange={(e) => upd("ciudad", e.target.value)}
              />
            </div>
            <div>
              <Label>Provincia</Label>
              <Input
                value={form.provincia}
                onChange={(e) => upd("provincia", e.target.value)}
              />
            </div>
            <div>
              <Label>Código postal</Label>
              <Input
                value={form.codigoPostal}
                onChange={(e) => upd("codigoPostal", e.target.value)}
              />
            </div>
            <div>
              <Label>País</Label>
              <Input value={form.pais} onChange={(e) => upd("pais", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formas de Pago */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> FORMAS DE PAGO
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Vía de pago</Label>
              <Select
                value={form.viaPago || ""}
                onValueChange={(v) => upd("viaPago", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar vía…" />
                </SelectTrigger>
                <SelectContent>
                  {VIAS_PAGO.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plazo de pago</Label>
              <Select
                value={form.plazoPago || ""}
                onValueChange={(v) => upd("plazoPago", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plazo…" />
                </SelectTrigger>
                <SelectContent>
                  {PLAZOS_PAGO.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(form.viaPago === "Otro" || form.plazoPago === "Otro") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {form.viaPago === "Otro" && (
                <div>
                  <Label>Detalle vía</Label>
                  <Input
                    value={form.viaPagoNegociada}
                    onChange={(e) => upd("viaPagoNegociada", e.target.value)}
                    placeholder="Ej: pagaré bancario, compensación…"
                  />
                </div>
              )}
              {form.plazoPago === "Otro" && (
                <div>
                  <Label>Detalle plazo</Label>
                  <Input
                    value={form.plazoPagoNegociado}
                    onChange={(e) => upd("plazoPagoNegociado", e.target.value)}
                    placeholder="Ej: fin de mes vista factura, 90 días…"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reparto */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4" /> REPARTO
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {(["generico", "negociado"] as const).map((scope) => {
            const esGenerico = scope === "generico";
            const dias = esGenerico ? form.diasReparto : form.diasRepartoNegociados;
            const horario = esGenerico ? form.horarioReparto : form.horarioRepartoNegociado;
            const titulo = esGenerico
              ? "Genérico del proveedor"
              : "Negociado con nosotros";
            const descripcion = esGenerico
              ? "Días y horarios que oferta este proveedor."
              : "Días y horarios pactados — la ficha de pedido los usará para fijar el día y la hora de entrega.";
            return (
              <div
                key={scope}
                className={
                  esGenerico
                    ? "space-y-3"
                    : "rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3"
                }
              >
                <div>
                  <h4 className="text-sm font-semibold tracking-tight">{titulo}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{descripcion}</p>
                </div>

                <div>
                  <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                    Días de reparto
                  </Label>
                  <div className="flex flex-wrap gap-3">
                    {DIAS_REPARTO.map((d) => (
                      <label
                        key={d}
                        className="flex items-center gap-1.5 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={dias.includes(d)}
                          onCheckedChange={() => toggleDiaScope(scope, d)}
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                </div>

                {dias.length > 0 && (
                  <div>
                    <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                      Horario por día
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[...dias]
                        .sort((a, b) => DIAS_REPARTO.indexOf(a) - DIAS_REPARTO.indexOf(b))
                        .map((d) => {
                          const valor = horario?.[d] ?? "";
                          const esPersonalizado =
                            valor !== "" &&
                            !FRANJAS_REPARTO.includes(valor as typeof FRANJAS_REPARTO[number]);
                          const valorSelect = esPersonalizado ? "Personalizado" : valor;
                          return (
                            <div key={d} className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">{d}</Label>
                              <Select
                                value={valorSelect}
                                onValueChange={(v) => {
                                  if (v === "Personalizado") {
                                    setHorarioDiaScope(scope, d, esPersonalizado ? valor : "");
                                  } else {
                                    setHorarioDiaScope(scope, d, v);
                                  }
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar franja…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FRANJAS_REPARTO.map((f) => (
                                    <SelectItem key={f} value={f}>
                                      {f}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {valorSelect === "Personalizado" && (
                                <Input
                                  value={esPersonalizado ? valor : ""}
                                  onChange={(e) => setHorarioDiaScope(scope, d, e.target.value)}
                                  placeholder="Ej: 09:00-13:00"
                                />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Contacto empresa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" /> CONTACTO DE LA EMPRESA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Teléfono</Label>
              <Input
                value={form.telefonoPrincipal}
                onChange={(e) => upd("telefonoPrincipal", e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.emailPrincipal}
                onChange={(e) => upd("emailPrincipal", e.target.value)}
              />
            </div>
            <div>
              <Label>Web</Label>
              <Input value={form.web} onChange={(e) => upd("web", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comercial asignado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" /> COMERCIAL ASIGNADO
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Nombre</Label>
              <Input
                value={form.personaContacto}
                onChange={(e) => upd("personaContacto", e.target.value)}
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={form.telefonoComercial}
                onChange={(e) => upd("telefonoComercial", e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.emailComercial}
                onChange={(e) => upd("emailComercial", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Otros correos operativos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" /> OTROS CORREOS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Email para pedidos</Label>
              <Input
                type="email"
                value={form.emailPedidos}
                onChange={(e) => upd("emailPedidos", e.target.value)}
                placeholder="Obligatorio para enviar pedidos"
              />
            </div>
            <div>
              <Label>Email contabilidad</Label>
              <Input
                type="email"
                value={form.emailContabilidad}
                onChange={(e) => upd("emailContabilidad", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categorías (auto) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" /> CATEGORÍAS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Categorías que reparte este proveedor (calculadas a partir de los productos
            asociados).
          </p>
          {categoriasDerivadas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {categoriasDerivadas.map((c) => (
                <Badge key={c} variant="secondary" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {loadingProductos
                ? "Cargando…"
                : "Sin productos asociados — añade productos a este proveedor para ver sus categorías."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Productos asociados */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" /> PRODUCTOS
            <span className="text-xs font-normal text-muted-foreground ml-1">
              ({productosAsociados.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProductos ? (
            <p className="text-sm text-muted-foreground">Cargando productos…</p>
          ) : productosAsociados.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Sin productos asociados a este proveedor.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {["Producto", "Categoría", "Conservación", "Unidad", "Formato", "Precio compra", "IVA", "Estado"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-xs font-bold text-muted-foreground whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {productosAsociados.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">
                        {p.nombre}
                      </td>
                      <td className="px-3 py-2 text-xs">{p.categoria || "—"}</td>
                      <td className="px-3 py-2 text-xs">{p.conservacion || "—"}</td>
                      <td className="px-3 py-2 text-xs">{p.unidad || "—"}</td>
                      <td className="px-3 py-2 text-xs">{p.formato || "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {p.precioCompra ? `${p.precioCompra} €` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{p.iva || "—"}</td>
                      <td className="px-3 py-2 text-xs">{p.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notas internas */}
      {(form.observaciones ||
        form.comentariosInternos ||
        dirty) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notas internas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Observaciones</Label>
              <Textarea
                value={form.observaciones}
                onChange={(e) => upd("observaciones", e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label>Comentarios internos</Label>
              <Textarea
                value={form.comentariosInternos}
                onChange={(e) => upd("comentariosInternos", e.target.value)}
                rows={2}
              />
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              Última actualización: {form.ultimaActualizacion || "—"}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tienes cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Quieres guardar los cambios antes de volver?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirm(false);
                onBack();
              }}
            >
              Descartar
            </Button>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                setShowConfirm(false);
                await persist(onBack);
              }}
            >
              Guardar y volver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
