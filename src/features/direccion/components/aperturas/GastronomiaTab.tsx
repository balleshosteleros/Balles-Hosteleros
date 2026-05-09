"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Plus, Trash2, ChefHat, ExternalLink, PieChart as PieIcon } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  type CategoriaVentaEstimada,
  type PlatoDestacado,
  type PropuestaGastronomica,
} from "@/features/direccion/data/aperturas";
import {
  uploadFotoCategoria,
  deleteFotoStorage,
} from "@/features/direccion/actions/estudios-apertura-actions";
import { prepararFotoParaSubida } from "@/features/direccion/lib/foto-upload";

interface Props {
  estudioId: string;
  propuesta: PropuestaGastronomica;
  ventasMensuales: number;
  onChange: (next: PropuestaGastronomica, opts?: { flush?: boolean }) => void;
}

const CAT_COLORS = [
  "hsl(210 70% 55%)",
  "hsl(40 90% 55%)",
  "hsl(340 65% 55%)",
  "hsl(150 60% 45%)",
  "hsl(265 60% 60%)",
  "hsl(20 80% 55%)",
  "hsl(190 60% 50%)",
  "hsl(95 50% 45%)",
];

function fmtEur(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

const uid = () => `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function GastronomiaTab({ estudioId, propuesta, ventasMensuales, onChange }: Props) {
  const set = (patch: Partial<PropuestaGastronomica>) => onChange({ ...propuesta, ...patch });

  const updatePlatoFlush = (id: string, patch: Partial<PlatoDestacado>) =>
    onChange(
      { ...propuesta, platos: (propuesta.platos ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)) },
      { flush: true },
    );

  const categorias = propuesta.categoriasVenta ?? [];
  const totalPctCategorias = categorias.reduce((s, c) => s + (c.porcentaje || 0), 0);
  const restante = Math.max(0, 100 - totalPctCategorias);

  const setCategorias = (next: CategoriaVentaEstimada[]) => set({ categoriasVenta: next });

  const addCategoria = () => {
    setCategorias([
      ...categorias,
      { id: uid(), nombre: "", porcentaje: 0 },
    ]);
  };

  const updateCategoria = (id: string, patch: Partial<CategoriaVentaEstimada>) => {
    setCategorias(categorias.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const updatePorcentaje = (id: string, raw: number) => {
    const cat = categorias.find((c) => c.id === id);
    if (!cat) return;
    const otros = categorias.reduce((s, c) => s + (c.id === id ? 0 : (c.porcentaje || 0)), 0);
    const max = Math.max(0, 100 - otros);
    const valor = Math.max(0, Math.min(max, Number.isFinite(raw) ? raw : 0));
    updateCategoria(id, { porcentaje: valor });
  };

  const removeCategoria = (id: string) => {
    setCategorias(categorias.filter((c) => c.id !== id));
  };

  const addPlato = () =>
    set({
      platos: [
        ...(propuesta.platos ?? []),
        { id: uid(), nombre: "", descripcion: "", precio: 0, categoria: "" },
      ],
    });

  const updatePlato = (id: string, patch: Partial<PlatoDestacado>) =>
    set({ platos: (propuesta.platos ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const removePlato = async (id: string) => {
    const plato = (propuesta.platos ?? []).find((p) => p.id === id);
    onChange(
      { ...propuesta, platos: (propuesta.platos ?? []).filter((p) => p.id !== id) },
      { flush: true },
    );
    if (plato?.foto?.path) {
      const res = await deleteFotoStorage({ estudioId, path: plato.foto.path });
      if (!res.ok) console.error("[GastronomiaTab] removePlato:", res.error);
    }
  };

  const handleFotoPlato = async (platoId: string, file: File) => {
    try {
      const prep = await prepararFotoParaSubida(file);
      if (!prep.ok) {
        window.alert(prep.error);
        return;
      }
      const platoActual = (propuesta.platos ?? []).find((p) => p.id === platoId);
      if (platoActual?.foto?.path) {
        await deleteFotoStorage({ estudioId, path: platoActual.foto.path });
      }
      const res = await uploadFotoCategoria({
        estudioId,
        categoria: "gastronomia",
        fileBase64: prep.dataUrl,
        fileType: prep.tipo,
        fileSize: prep.tamano,
      });
      if (!res.ok) {
        console.error("[GastronomiaTab] uploadFoto:", res.error);
        window.alert(`No se pudo subir la foto del plato: ${res.error}`);
        return;
      }
      updatePlatoFlush(platoId, { foto: res.foto });
    } catch (err) {
      console.error("[GastronomiaTab] uploadFoto threw:", err);
      window.alert("No se pudo subir la foto del plato. Prueba con un archivo más pequeño.");
    }
  };

  const removeFotoPlato = async (platoId: string) => {
    const plato = (propuesta.platos ?? []).find((p) => p.id === platoId);
    const path = plato?.foto?.path;
    updatePlatoFlush(platoId, { foto: undefined });
    if (path) {
      const res = await deleteFotoStorage({ estudioId, path });
      if (!res.ok) console.error("[GastronomiaTab] removeFoto:", res.error);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ChefHat className="h-4 w-4" />
            Propuesta gastronómica
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Define el concepto culinario y el estilo de servicio. Es la propuesta de valor para inversores.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="Concepto culinario">
              <Input
                value={propuesta.concepto}
                onChange={(e) => set({ concepto: e.target.value })}
                placeholder="Ej. Cocina mediterránea de mercado"
              />
            </Field>
            <Field label="Estilo de servicio">
              <Input
                value={propuesta.estiloServicio}
                onChange={(e) => set({ estiloServicio: e.target.value })}
                placeholder="Ej. A la carta + menú degustación"
              />
            </Field>
            <Field label="Rango precio medio">
              <Input
                value={propuesta.rangoPrecioMedio}
                onChange={(e) => set({ rangoPrecioMedio: e.target.value })}
                placeholder="Ej. 30-45€"
              />
            </Field>
            <Field label="Nº platos en carta">
              <Input
                type="number"
                value={propuesta.numeroPlatosCarta || ""}
                onChange={(e) => set({ numeroPlatosCarta: Number(e.target.value) })}
              />
            </Field>
          </div>

          <Field label="Descripción de la propuesta">
            <Textarea
              value={propuesta.descripcion}
              onChange={(e) => set({ descripcion: e.target.value })}
              rows={4}
              placeholder="Producto, técnicas, proveedores, identidad gastronómica…"
            />
          </Field>

          <Field label="Enlace a carta (PDF / web)">
            <div className="flex items-center gap-2">
              <Input
                value={propuesta.cartaUrl}
                onChange={(e) => set({ cartaUrl: e.target.value })}
                placeholder="https://…"
              />
              {propuesta.cartaUrl && (
                <a
                  href={propuesta.cartaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
                >
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PieIcon className="h-4 w-4" />
            Mix de ventas por categoría
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Estima qué peso tendrá cada categoría sobre la facturación total. La suma no puede superar el 100%.
            La facturación por categoría se calcula automáticamente a partir de la facturación mensual estimada
            ({fmtEur(ventasMensuales)}€).
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tabla editable */}
            <div className="space-y-2">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40">
                  <th className="text-left p-2 font-medium">Categoría</th>
                  <th className="text-left p-2 font-medium w-28">% sobre ventas</th>
                  <th className="text-right p-2 font-medium">Facturación / mes</th>
                  <th className="w-10"></th>
                </tr></thead>
                <tbody>
                  {categorias.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-xs text-muted-foreground">
                        Aún no hay categorías. Añade la primera.
                      </td>
                    </tr>
                  ) : (
                    categorias.map((c) => {
                      const factCat = ventasMensuales * (c.porcentaje || 0) / 100;
                      return (
                        <tr key={c.id} className="border-b hover:bg-muted/20">
                          <td className="p-2">
                            <Input
                              value={c.nombre}
                              onChange={(e) => updateCategoria(c.id, { nombre: e.target.value })}
                              placeholder="Ej. Bebidas, Entrantes, Postres…"
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="p-2">
                            <div className="relative">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={c.porcentaje || ""}
                                onChange={(e) => updatePorcentaje(c.id, Number(e.target.value))}
                                className="h-8 text-sm pr-7 w-24"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                            </div>
                          </td>
                          <td className="p-2 text-right font-medium">{fmtEur(factCat)}€</td>
                          <td className="p-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-red-600"
                              onClick={() => removeCategoria(c.id)}
                              title="Eliminar categoría"
                              aria-label="Eliminar categoría"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  <tr>
                    <td colSpan={4} className="p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        onClick={addCategoria}
                        disabled={restante <= 0}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Añadir categoría
                      </Button>
                    </td>
                  </tr>
                  <tr className="bg-muted/30 font-semibold">
                    <td className="p-2">TOTAL</td>
                    <td className="p-2">
                      <span className={totalPctCategorias > 100 ? "text-red-600" : ""}>
                        {totalPctCategorias.toFixed(1)}%
                      </span>
                      <span className="text-xs text-muted-foreground font-normal ml-1">
                        ({restante.toFixed(1)}% libre)
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {fmtEur(ventasMensuales * totalPctCategorias / 100)}€
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Gráfica */}
            <div>
              {categorias.some((c) => (c.porcentaje || 0) > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categorias
                        .filter((c) => (c.porcentaje || 0) > 0)
                        .map((c) => ({ name: c.nombre || "Sin nombre", value: c.porcentaje }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      label={({ name, value }) => `${name} ${value}%`}
                    >
                      {categorias
                        .filter((c) => (c.porcentaje || 0) > 0)
                        .map((_, i) => (
                          <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, _name, props) => {
                        const fact = ventasMensuales * (v / 100);
                        return [`${v}% — ${fmtEur(fact)}€`, props?.payload?.name];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground border rounded-md">
                  Añade categorías y porcentajes para ver la gráfica
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Platos destacados</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Selecciona los platos que mejor representan la propuesta. Cada uno con foto, descripción y precio.
              </p>
            </div>
            <Button size="sm" onClick={addPlato}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Añadir plato
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(propuesta.platos ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aún no hay platos destacados. Añade el primero.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(propuesta.platos ?? []).map((plato) => (
                <PlatoCard
                  key={plato.id}
                  plato={plato}
                  onUpdate={(patch) => updatePlato(plato.id, patch)}
                  onRemove={() => removePlato(plato.id)}
                  onUploadFoto={(file) => handleFotoPlato(plato.id, file)}
                  onRemoveFoto={() => removeFotoPlato(plato.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlatoCard({
  plato,
  onUpdate,
  onRemove,
  onUploadFoto,
  onRemoveFoto,
}: {
  plato: PlatoDestacado;
  onUpdate: (patch: Partial<PlatoDestacado>) => void;
  onRemove: () => void;
  onUploadFoto: (file: File) => void;
  onRemoveFoto: () => void;
}) {
  return (
    <div className="rounded-lg border overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] bg-muted">
        {plato.foto?.url ? (
          <>
            <img src={plato.foto.url} alt={plato.nombre} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={onRemoveFoto}
              className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              title="Quitar foto"
              aria-label="Quitar foto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <label className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer text-xs">
            <ImagePlus className="h-6 w-6" strokeWidth={1.5} />
            <span>Añadir foto del plato</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(ev) => {
                const file = ev.target.files?.[0];
                if (file) onUploadFoto(file);
                ev.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <Input
            value={plato.nombre}
            onChange={(e) => onUpdate({ nombre: e.target.value })}
            placeholder="Nombre del plato"
            className="h-8 text-sm font-medium"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-red-600 shrink-0"
            onClick={onRemove}
            title="Eliminar plato"
            aria-label="Eliminar plato"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={plato.categoria}
            onChange={(e) => onUpdate({ categoria: e.target.value })}
            placeholder="Categoría"
            className="h-8 text-xs"
          />
          <div className="relative">
            <Input
              type="number"
              step={0.5}
              value={plato.precio || ""}
              onChange={(e) => onUpdate({ precio: Number(e.target.value) })}
              placeholder="Precio"
              className="h-8 text-xs pr-7"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
          </div>
        </div>
        <Textarea
          value={plato.descripcion}
          onChange={(e) => onUpdate({ descripcion: e.target.value })}
          rows={2}
          placeholder="Descripción breve, ingredientes, técnica…"
          className="text-xs resize-none"
        />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
