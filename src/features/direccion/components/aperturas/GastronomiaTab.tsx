"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Plus, Trash2, ChefHat, ExternalLink } from "lucide-react";
import {
  type PlatoDestacado,
  type PropuestaGastronomica,
} from "@/features/direccion/data/aperturas";
import {
  uploadFotoCategoria,
  deleteFotoStorage,
} from "@/features/direccion/actions/estudios-apertura-actions";
import { prepararFotoParaSubida } from "@/features/direccion/lib/foto-upload";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { BadgeSugerenciaIA } from "@/features/direccion/components/aperturas/shared/BadgeSugerenciaIA";
import type { DraftGastronomia } from "@/features/direccion/types/aperturas-ia";

/* Campos escalares de la propuesta gastronómica que la IA puede sugerir
   y que pueden mostrar badge. Los arrays (platos, categoriasVenta) se
   marcan a nivel de sección, no por campo. */
type CampoGastronomiaIA =
  | "concepto"
  | "descripcion"
  | "estiloServicio"
  | "rangoPrecioMedio"
  | "numeroPlatosCarta"
  | "cartaUrl"
  | "platos"
  | "categoriasVenta";

interface Props {
  estudioId: string;
  propuesta: PropuestaGastronomica;
  onChange: (next: PropuestaGastronomica, opts?: { flush?: boolean }) => void;
  readOnly?: boolean;
  /** Campos sugeridos por IA pendientes de aceptar — pinta badge ámbar. */
  iaDraft?: DraftGastronomia;
  /** Al editar un campo IA, AperturasView limpia esa marca (badge desaparece). */
  onClearIaField?: (campo: CampoGastronomiaIA) => void;
}

const uid = () => `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function GastronomiaTab({
  estudioId,
  propuesta,
  onChange,
  readOnly = false,
  iaDraft,
  onClearIaField,
}: Props) {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const ia = (campo: CampoGastronomiaIA): boolean => {
    if (!iaDraft) return false;
    return (iaDraft as Record<string, unknown>)[campo] !== undefined;
  };
  const set = (patch: Partial<PropuestaGastronomica>) => {
    if (readOnly) return;
    onChange({ ...propuesta, ...patch });
    if (onClearIaField) {
      for (const k of Object.keys(patch) as Array<keyof PropuestaGastronomica>) {
        onClearIaField(k as CampoGastronomiaIA);
      }
    }
  };

  const updatePlatoFlush = (id: string, patch: Partial<PlatoDestacado>) =>
    onChange(
      { ...propuesta, platos: (propuesta.platos ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)) },
      { flush: true },
    );

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
    const ok = await confirmDelete({
      title: "¿Borrar este plato destacado?",
      description: plato?.nombre
        ? `Se eliminará "${plato.nombre}" y su foto. Esta acción no se puede deshacer.`
        : "Se eliminará el plato y su foto. Esta acción no se puede deshacer.",
    });
    if (!ok) return;
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
    const ok = await confirmDelete({
      title: "¿Quitar la foto de este plato?",
      description: plato?.nombre
        ? `Se eliminará la foto de "${plato.nombre}". Podrás subir otra después.`
        : "Se eliminará la foto del plato. Podrás subir otra después.",
    });
    if (!ok) return;
    const path = plato?.foto?.path;
    updatePlatoFlush(platoId, { foto: undefined });
    if (path) {
      const res = await deleteFotoStorage({ estudioId, path });
      if (!res.ok) console.error("[GastronomiaTab] removeFoto:", res.error);
    }
  };

  return (
    <div className="space-y-4">
      {confirmDeleteDialog}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ChefHat className="h-4 w-4" />
            Propuesta gastronómica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="Concepto culinario" badge={ia("concepto") ? <BadgeSugerenciaIA /> : null}>
              <Input
                disabled={readOnly}
                value={propuesta.concepto}
                onChange={(e) => set({ concepto: e.target.value })}
                placeholder="Ej. Cocina mediterránea de mercado"
                className={ia("concepto") ? "bg-amber-50/60 border-amber-200" : undefined}
              />
            </Field>
            <Field label="Estilo de servicio" badge={ia("estiloServicio") ? <BadgeSugerenciaIA /> : null}>
              <Input
                disabled={readOnly}
                value={propuesta.estiloServicio}
                onChange={(e) => set({ estiloServicio: e.target.value })}
                placeholder="Ej. A la carta + menú degustación"
                className={ia("estiloServicio") ? "bg-amber-50/60 border-amber-200" : undefined}
              />
            </Field>
            <Field label="Rango precio medio" badge={ia("rangoPrecioMedio") ? <BadgeSugerenciaIA /> : null}>
              <Input
                disabled={readOnly}
                value={propuesta.rangoPrecioMedio}
                onChange={(e) => set({ rangoPrecioMedio: e.target.value })}
                placeholder="Ej. 30-45€"
                className={ia("rangoPrecioMedio") ? "bg-amber-50/60 border-amber-200" : undefined}
              />
            </Field>
            <Field label="Nº platos en carta" badge={ia("numeroPlatosCarta") ? <BadgeSugerenciaIA /> : null}>
              <Input
                disabled={readOnly}
                type="number"
                value={propuesta.numeroPlatosCarta || ""}
                onChange={(e) => set({ numeroPlatosCarta: Number(e.target.value) })}
                className={ia("numeroPlatosCarta") ? "bg-amber-50/60 border-amber-200" : undefined}
              />
            </Field>
          </div>

          <Field label="Descripción de la propuesta" badge={ia("descripcion") ? <BadgeSugerenciaIA /> : null}>
            <Textarea
              disabled={readOnly}
              value={propuesta.descripcion}
              onChange={(e) => set({ descripcion: e.target.value })}
              rows={4}
              placeholder="Producto, técnicas, proveedores, identidad gastronómica…"
              className={ia("descripcion") ? "bg-amber-50/60 border-amber-200" : undefined}
            />
          </Field>

          <Field label="Enlace a carta (PDF / web)" badge={ia("cartaUrl") ? <BadgeSugerenciaIA /> : null}>
            <div className="flex items-center gap-2">
              <Input
                disabled={readOnly}
                value={propuesta.cartaUrl}
                onChange={(e) => set({ cartaUrl: e.target.value })}
                placeholder="https://…"
                className={ia("cartaUrl") ? "bg-amber-50/60 border-amber-200" : undefined}
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

      <Card className={ia("platos") ? "ring-1 ring-amber-200" : undefined}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Platos destacados
                {ia("platos") && <BadgeSugerenciaIA />}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Selecciona los platos que mejor representan la propuesta. Cada uno con foto, descripción y precio.
              </p>
            </div>
            {!readOnly && (
              <Button size="sm" onClick={addPlato}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Añadir plato
              </Button>
            )}
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
                  readOnly={readOnly}
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
  readOnly = false,
}: {
  plato: PlatoDestacado;
  onUpdate: (patch: Partial<PlatoDestacado>) => void;
  onRemove: () => void;
  onUploadFoto: (file: File) => void;
  onRemoveFoto: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-lg border overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {plato.foto?.url ? (
          <>
            <img src={plato.foto.url} alt={plato.nombre} className="absolute inset-0 w-full h-full object-cover" />
            {!readOnly && (
              <button
                type="button"
                onClick={onRemoveFoto}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                title="Quitar foto"
                aria-label="Quitar foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        ) : readOnly ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            Sin foto
          </div>
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
            disabled={readOnly}
            value={plato.nombre}
            onChange={(e) => onUpdate({ nombre: e.target.value })}
            placeholder="Nombre del plato"
            className="h-8 text-sm font-medium"
          />
          {!readOnly && (
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
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            disabled={readOnly}
            value={plato.categoria}
            onChange={(e) => onUpdate({ categoria: e.target.value })}
            placeholder="Categoría"
            className="h-8 text-xs"
          />
          <div className="relative">
            <Input
              disabled={readOnly}
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
          disabled={readOnly}
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

function Field({
  label,
  children,
  badge,
}: {
  label: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Label className="text-muted-foreground text-xs">{label}</Label>
        {badge}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
