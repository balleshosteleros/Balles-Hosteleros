"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus, FileText, Download, Trash2, BarChart3, List, TrendingUp,
  ArrowUpFromLine, ArrowDownToLine,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import {
  SubmoduleToolbar,
  type ToolbarColumna,
  type ToolbarColumnaVisible,
  colVisible,
} from "@/shared/components/SubmoduleToolbar";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  listInformes, createInforme, deleteInforme,
} from "@/features/gerencia/actions/informes-actions";
import { INFORME_TIPOS, type InformeRow, type InformeTipo } from "@/features/gerencia/data/informes";

const TIPO_COLORS: Record<InformeTipo, string> = {
  descuentos: "hsl(210 70% 55%)",
  cancelaciones: "hsl(0 65% 55%)",
  inventarios: "hsl(40 80% 50%)",
  menu_ingeniering: "hsl(160 55% 45%)",
};

const TIPO_LABEL: Record<InformeTipo, string> = {
  descuentos: "Descuentos",
  cancelaciones: "Cancelaciones",
  inventarios: "Inventarios",
  menu_ingeniering: "Menu Ingenering",
};

function fmtEuro(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function monthKey(fechaIso: string): string {
  return fechaIso.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string): string {
  // key = "YYYY-MM"
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const d = new Date(y, m - 1, 1);
  return format(d, "MMM yyyy", { locale: es });
}

const COLUMNAS_DEF: ToolbarColumna[] = [
  { campo: "fecha", label: "Fecha", bloqueada: true },
  { campo: "tipo", label: "Tipo" },
  { campo: "importe", label: "Importe" },
  { campo: "documento", label: "Documento" },
  { campo: "observaciones", label: "Observaciones" },
];

export function InformesView() {
  const [informes, setInformes] = useState<InformeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({
    fecha: true, tipo: true, importe: true, documento: true, observaciones: true,
  });
  const [columnasOrden, setColumnasOrden] = useState<string[] | undefined>(undefined);

  const [modalOpen, setModalOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [selected, setSelected] = useState<InformeRow | null>(null);

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const emptyForm = () => ({
    tipo: "descuentos" as InformeTipo,
    fecha: today,
    importe: "",
    importe_signo: "negativo" as "positivo" | "negativo",
    observaciones: "",
    registrado_por: "",
    file: null as File | null,
  });
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listInformes();
      if (res.ok) setInformes(res.data);
      else toast.error(res.error ?? "Error cargando informes");
    } catch (e) {
      console.error("[InformesView] cargar:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Derivados ──
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return informes;
    return informes.filter((i) =>
      TIPO_LABEL[i.tipo].toLowerCase().includes(q)
      || (i.observaciones ?? "").toLowerCase().includes(q)
      || i.fecha.includes(q)
      || String(i.importe).includes(q)
    );
  }, [informes, busqueda]);

  // Histórico mensual: filas por mes con columnas por tipo + total
  const historico = useMemo(() => {
    const map: Record<string, Record<InformeTipo, number>> = {};
    for (const i of informes) {
      const k = monthKey(i.fecha);
      if (!map[k]) {
        map[k] = { descuentos: 0, cancelaciones: 0, inventarios: 0, menu_ingeniering: 0 };
      }
      map[k][i.tipo] += i.importe;
    }
    return Object.keys(map)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((k) => ({
        mes: k,
        label: monthLabel(k),
        ...map[k],
        total:
          map[k].descuentos + map[k].cancelaciones + map[k].inventarios + map[k].menu_ingeniering,
      }));
  }, [informes]);

  // Datos para gráfica (ascendente)
  const chartData = useMemo(() => [...historico].reverse(), [historico]);

  const resumenTotales = useMemo(() => {
    const t: Record<InformeTipo, number> = {
      descuentos: 0, cancelaciones: 0, inventarios: 0, menu_ingeniering: 0,
    };
    for (const i of informes) t[i.tipo] += i.importe;
    return t;
  }, [informes]);

  // ── Handlers ──
  const abrirNuevo = () => {
    setForm(emptyForm());
    setModalOpen(true);
  };

  const handleGuardar = async () => {
    if (!form.fecha) {
      toast.error("La fecha es obligatoria");
      return;
    }
    const raw = Number((form.importe || "0").replace(",", ".")) || 0;
    const abs = Math.abs(raw);
    const importeFirmado = form.importe_signo === "positivo" ? abs : -abs;

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("tipo", form.tipo);
      fd.append("fecha", form.fecha);
      fd.append("importe", String(importeFirmado));
      fd.append("observaciones", form.observaciones);
      fd.append("registrado_por", form.registrado_por);
      if (form.file) fd.append("file", form.file);

      const res = await createInforme(fd);
      if (res.ok) {
        toast.success("Informe registrado");
        setModalOpen(false);
        setForm(emptyForm());
        cargar();
      } else {
        toast.error(res.error ?? "Error al registrar el informe");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm("¿Eliminar este informe? Se borrará también el documento adjunto.")) return;
    const res = await deleteInforme(id);
    if (res.ok) {
      toast.success("Informe eliminado");
      setDetalleOpen(false);
      setSelected(null);
      cargar();
    } else {
      toast.error(res.error ?? "Error al eliminar");
    }
  };

  return (
    <div className="p-6 space-y-4">
      {/* BARRA HORIZONTAL 1: + Nuevo | Buscar + 3 iconos (columnas / IO / Settings) */}
      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar informes"
        onNuevo={abrirNuevo}
        textoNuevo="Nuevo"
        columnas={COLUMNAS_DEF}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
      />

      {/* KPIs por tipo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {INFORME_TIPOS.map((t) => {
          const total = resumenTotales[t.value];
          const positivo = total >= 0;
          return (
            <Card key={t.value}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: TIPO_COLORS[t.value] }}
                  />
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                </div>
                <p className={`text-xl font-bold ${positivo ? "text-emerald-700" : "text-red-700"}`}>
                  {fmtEuro(total)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="listado">
        <TabsList>
          <TabsTrigger value="listado" className="gap-1.5"><List className="h-4 w-4" /> Listado</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5"><TrendingUp className="h-4 w-4" /> Histórico mensual</TabsTrigger>
          <TabsTrigger value="grafica" className="gap-1.5"><BarChart3 className="h-4 w-4" /> Gráfica</TabsTrigger>
        </TabsList>

        {/* ── LISTADO ── */}
        <TabsContent value="listado" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  {colVisible(columnasVisibles, "fecha") && <TableHead>Fecha</TableHead>}
                  {colVisible(columnasVisibles, "tipo") && <TableHead>Tipo</TableHead>}
                  {colVisible(columnasVisibles, "importe") && <TableHead className="text-right">Importe</TableHead>}
                  {colVisible(columnasVisibles, "documento") && <TableHead>Documento</TableHead>}
                  {colVisible(columnasVisibles, "observaciones") && <TableHead>Observaciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      {loading ? <LoadingSpinner /> : "Aún no hay informes registrados"}
                    </TableCell>
                  </TableRow>
                )}
                {filtrados.map((i) => (
                  <TableRow
                    key={i.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setSelected(i); setDetalleOpen(true); }}
                  >
                    {colVisible(columnasVisibles, "fecha") && (
                      <TableCell className="font-medium">
                        {format(parseISO(i.fecha), "dd MMM yyyy", { locale: es })}
                      </TableCell>
                    )}
                    {colVisible(columnasVisibles, "tipo") && (
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="gap-1.5"
                          style={{ borderColor: TIPO_COLORS[i.tipo], color: TIPO_COLORS[i.tipo] }}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: TIPO_COLORS[i.tipo] }}
                          />
                          {TIPO_LABEL[i.tipo]}
                        </Badge>
                      </TableCell>
                    )}
                    {colVisible(columnasVisibles, "importe") && (
                      <TableCell className={`text-right font-semibold ${i.importe >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {fmtEuro(i.importe)}
                      </TableCell>
                    )}
                    {colVisible(columnasVisibles, "documento") && (
                      <TableCell>
                        {i.url ? (
                          <Badge variant="outline" className="text-xs gap-1">
                            <FileText className="h-3 w-3" /> Sí
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {colVisible(columnasVisibles, "observaciones") && (
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {i.observaciones ?? "—"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── HISTÓRICO MENSUAL ── */}
        <TabsContent value="historico" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  {INFORME_TIPOS.map((t) => (
                    <TableHead key={t.value} className="text-right">{t.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {loading ? <LoadingSpinner /> : "Sin datos para mostrar"}
                    </TableCell>
                  </TableRow>
                )}
                {historico.map((row) => (
                  <TableRow key={row.mes}>
                    <TableCell className="font-medium capitalize">{row.label}</TableCell>
                    {INFORME_TIPOS.map((t) => {
                      const v = row[t.value];
                      return (
                        <TableCell
                          key={t.value}
                          className={`text-right ${v === 0 ? "text-muted-foreground" : v > 0 ? "text-emerald-700" : "text-red-700"}`}
                        >
                          {v === 0 ? "—" : fmtEuro(v)}
                        </TableCell>
                      );
                    })}
                    <TableCell className={`text-right font-semibold ${row.total >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {fmtEuro(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── GRÁFICA ── */}
        <TabsContent value="grafica" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Evolución mensual por tipo (€)</h3>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  {loading ? <LoadingSpinner /> : "Sin datos para graficar"}
                </p>
              ) : (
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          fmtEuro(Number(value)),
                          TIPO_LABEL[name as InformeTipo] ?? name,
                        ]}
                      />
                      <Legend
                        formatter={(value: string) => TIPO_LABEL[value as InformeTipo] ?? value}
                      />
                      {INFORME_TIPOS.map((t) => (
                        <Line
                          key={t.value}
                          type="monotone"
                          dataKey={t.value}
                          stroke={TIPO_COLORS[t.value]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Total mensual acumulado (€)</h3>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">Sin datos</p>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
                      <Tooltip formatter={(v: number) => fmtEuro(Number(v))} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Modal Nuevo informe ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo informe</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <Label>Tipo de informe *</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v as InformeTipo })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INFORME_TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: TIPO_COLORS[t.value] }}
                        />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>

            <div>
              <Label>Importe (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.importe}
                onChange={(e) => setForm({ ...form, importe: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label className="mb-2 block">Signo del importe</Label>
              <RadioGroup
                value={form.importe_signo}
                onValueChange={(v) => setForm({ ...form, importe_signo: v as "positivo" | "negativo" })}
                className="flex gap-4 pt-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="positivo" id="imp-pos" />
                  <Label htmlFor="imp-pos" className="cursor-pointer flex items-center gap-1">
                    <ArrowUpFromLine className="h-3 w-3 text-emerald-600" />
                    Positivo
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="negativo" id="imp-neg" />
                  <Label htmlFor="imp-neg" className="cursor-pointer flex items-center gap-1">
                    <ArrowDownToLine className="h-3 w-3 text-red-600" />
                    Negativo
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="col-span-2">
              <Label>Documento adjunto (PDF, imagen, etc.)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              />
              {form.file && (
                <p className="text-xs text-muted-foreground mt-1">
                  {form.file.name} · {fmtSize(form.file.size)}
                </p>
              )}
            </div>

            <div className="col-span-2">
              <Label>Registrado por</Label>
              <Input
                value={form.registrado_por}
                onChange={(e) => setForm({ ...form, registrado_por: e.target.value })}
                placeholder="Opcional"
              />
            </div>

            <div className="col-span-2">
              <Label>Observaciones</Label>
              <Textarea
                rows={3}
                value={form.observaciones}
                onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                placeholder="Notas opcionales sobre el informe..."
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={saving || !form.fecha}>
              {saving ? "Guardando..." : "Guardar informe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Detalle ── */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 capitalize">
                  Informe del {format(parseISO(selected.fecha), "d 'de' MMMM yyyy", { locale: es })}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1.5"
                    style={{ borderColor: TIPO_COLORS[selected.tipo], color: TIPO_COLORS[selected.tipo] }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: TIPO_COLORS[selected.tipo] }}
                    />
                    {TIPO_LABEL[selected.tipo]}
                  </Badge>
                  <Badge
                    className={`gap-1 ${selected.importe >= 0 ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-red-100 text-red-800 border-red-300"}`}
                  >
                    {selected.importe >= 0 ? (
                      <ArrowUpFromLine className="h-3 w-3" />
                    ) : (
                      <ArrowDownToLine className="h-3 w-3" />
                    )}
                    {fmtEuro(selected.importe)}
                  </Badge>
                </div>

                {selected.registrado_por && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Registrado por</Label>
                    <p className="text-sm">{selected.registrado_por}</p>
                  </div>
                )}

                {selected.observaciones && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Observaciones</Label>
                    <p className="text-sm whitespace-pre-wrap mt-1">{selected.observaciones}</p>
                  </div>
                )}

                {selected.url && (
                  <div className="rounded-lg border p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{selected.file_name ?? "Documento adjunto"}</p>
                        <p className="text-xs text-muted-foreground">{fmtSize(selected.size_bytes)}</p>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a href={selected.url} target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5 mr-1" /> Abrir
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-4">
                <Button
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => handleEliminar(selected.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                </Button>
                <Button variant="outline" onClick={() => setDetalleOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
