"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import {
  type ColorPaleta,
  type ImagenMarcaEstudio,
} from "@/features/direccion/data/aperturas";
import {
  uploadFotoCategoria,
  deleteFotoStorage,
} from "@/features/direccion/actions/estudios-apertura-actions";
import { prepararFotoParaSubida } from "@/features/direccion/lib/foto-upload";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { BadgeSugerenciaIA } from "@/features/direccion/components/aperturas/shared/BadgeSugerenciaIA";
import type { DraftMarca } from "@/features/direccion/types/aperturas-ia";

type CampoMarcaIA =
  | "claim"
  | "descripcion"
  | "publicoObjetivo"
  | "valores"
  | "tipografiaTitulares"
  | "tipografiaCuerpo"
  | "paleta";

interface Props {
  estudioId: string;
  marca: ImagenMarcaEstudio;
  onChange: (next: ImagenMarcaEstudio, opts?: { flush?: boolean }) => void;
  readOnly?: boolean;
  iaDraft?: DraftMarca;
  onClearIaField?: (campo: CampoMarcaIA) => void;
}

const uid = () => `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function MarcaTab({
  estudioId,
  marca,
  onChange,
  readOnly = false,
  iaDraft,
  onClearIaField,
}: Props) {
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const ia = (campo: CampoMarcaIA): boolean => {
    if (!iaDraft) return false;
    return (iaDraft as Record<string, unknown>)[campo] !== undefined;
  };
  const set = (patch: Partial<ImagenMarcaEstudio>) => {
    if (readOnly) return;
    onChange({ ...marca, ...patch });
    if (onClearIaField) {
      for (const k of Object.keys(patch) as Array<keyof ImagenMarcaEstudio>) {
        onClearIaField(k as CampoMarcaIA);
      }
    }
  };
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const addValor = () => set({ valores: [...(marca.valores ?? []), ""] });
  const updateValor = (i: number, val: string) => {
    const valores = [...(marca.valores ?? [])];
    valores[i] = val;
    set({ valores });
  };
  const removeValor = async (i: number) => {
    const valor = (marca.valores ?? [])[i];
    const ok = await confirmDelete({
      title: "¿Quitar este valor de marca?",
      description: valor
        ? `Se eliminará "${valor}". Esta acción no se puede deshacer.`
        : "Se eliminará el valor. Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    set({ valores: (marca.valores ?? []).filter((_, j) => j !== i) });
  };

  const addColor = () => set({ paleta: [...(marca.paleta ?? []), { id: uid(), nombre: "Color", hex: "#000000" }] });
  const updateColor = (id: string, patch: Partial<ColorPaleta>) => {
    set({ paleta: (marca.paleta ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };
  const removeColor = async (id: string) => {
    const color = (marca.paleta ?? []).find((c) => c.id === id);
    const ok = await confirmDelete({
      title: "¿Quitar este color de la paleta?",
      description: color
        ? `Se eliminará "${color.nombre || color.hex}". Esta acción no se puede deshacer.`
        : "Esta acción no se puede deshacer.",
    });
    if (!ok) return;
    set({ paleta: (marca.paleta ?? []).filter((c) => c.id !== id) });
  };

  const handleLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const prep = await prepararFotoParaSubida(file);
      if (!prep.ok) {
        window.alert(prep.error);
        return;
      }
      if (marca.logoPath) {
        await deleteFotoStorage({ estudioId, path: marca.logoPath });
      }
      const res = await uploadFotoCategoria({
        estudioId,
        categoria: "marca",
        fileBase64: prep.dataUrl,
        fileType: prep.tipo,
        fileSize: prep.tamano,
      });
      if (!res.ok) {
        console.error("[MarcaTab] uploadLogo:", res.error);
        window.alert(`No se pudo subir el logo: ${res.error}`);
        return;
      }
      onChange({ ...marca, logoPath: res.foto.path, logoUrl: res.foto.url }, { flush: true });
    } catch (err) {
      console.error("[MarcaTab] uploadLogo threw:", err);
      window.alert("No se pudo subir el logo. Prueba con un archivo más pequeño.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    const ok = await confirmDelete({
      title: "¿Quitar el logo?",
      description: "Se eliminará el logo del estudio. Podrás subir otro después.",
    });
    if (!ok) return;
    const path = marca.logoPath;
    onChange({ ...marca, logoPath: undefined, logoUrl: undefined }, { flush: true });
    if (path) {
      const res = await deleteFotoStorage({ estudioId, path });
      if (!res.ok) console.error("[MarcaTab] removeLogo:", res.error);
    }
  };

  return (
    <div className="space-y-4">
      {confirmDeleteDialog}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Concepto de marca
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Define cómo quieres que se perciba el restaurante: claim, descripción y público.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="Claim / tagline" badge={ia("claim") ? <BadgeSugerenciaIA /> : null}>
              <Input
                disabled={readOnly}
                value={marca.claim}
                onChange={(e) => set({ claim: e.target.value })}
                placeholder="Ej. La cocina mediterránea de mercado"
                className={ia("claim") ? "bg-amber-50/60 border-amber-200" : undefined}
              />
            </Field>
            <Field label="Público objetivo" badge={ia("publicoObjetivo") ? <BadgeSugerenciaIA /> : null}>
              <Input
                disabled={readOnly}
                value={marca.publicoObjetivo}
                onChange={(e) => set({ publicoObjetivo: e.target.value })}
                placeholder="Ej. Profesionales 30-45, parejas, foodies"
                className={ia("publicoObjetivo") ? "bg-amber-50/60 border-amber-200" : undefined}
              />
            </Field>
          </div>
          <Field label="Descripción del concepto" badge={ia("descripcion") ? <BadgeSugerenciaIA /> : null}>
            <Textarea
              disabled={readOnly}
              value={marca.descripcion}
              onChange={(e) => set({ descripcion: e.target.value })}
              rows={4}
              placeholder="Describe la experiencia, el tono, qué hace único al restaurante…"
              className={ia("descripcion") ? "bg-amber-50/60 border-amber-200" : undefined}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
        </CardHeader>
        <CardContent>
          {marca.logoUrl ? (
            <div className="relative inline-block group">
              <img
                src={marca.logoUrl}
                alt="Logo"
                className="h-32 w-auto max-w-xs rounded-md border bg-white object-contain p-3"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/80"
                  title="Quitar logo"
                  aria-label="Quitar logo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : uploadingLogo ? (
            <div className="inline-flex flex-col items-center justify-center gap-1 h-32 w-64 rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground text-xs">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Subiendo logo…</span>
            </div>
          ) : readOnly ? (
            <p className="text-xs text-muted-foreground">Sin logo cargado.</p>
          ) : (
            <label className="inline-flex flex-col items-center justify-center gap-1 h-32 w-64 rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer text-xs">
              <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
              <span>Subir logo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(ev) => {
                  const file = ev.target.files?.[0];
                  if (file) handleLogo(file);
                  ev.target.value = "";
                }}
              />
            </label>
          )}
        </CardContent>
      </Card>

      <Card className={ia("paleta") ? "ring-1 ring-amber-200" : undefined}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Paleta de colores
            {ia("paleta") && <BadgeSugerenciaIA />}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Define los colores principales de la marca. Mínimo 1, recomendado 3-5.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(marca.paleta ?? []).map((c) => (
              <div key={c.id} className="rounded-md border p-3 space-y-2">
                <div
                  className="h-16 w-full rounded-md border"
                  style={{ backgroundColor: c.hex }}
                />
                <div className="flex items-center gap-2">
                  <input
                    disabled={readOnly}
                    type="color"
                    value={c.hex}
                    onChange={(e) => updateColor(c.id, { hex: e.target.value })}
                    className="h-8 w-10 rounded border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <Input
                    disabled={readOnly}
                    value={c.hex}
                    onChange={(e) => updateColor(c.id, { hex: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    disabled={readOnly}
                    value={c.nombre}
                    onChange={(e) => updateColor(c.id, { nombre: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Nombre"
                  />
                  {!readOnly && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      onClick={() => removeColor(c.id)}
                      title="Quitar color"
                      aria-label="Quitar color"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!readOnly && (
              <button
                type="button"
                onClick={addColor}
                className="rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors flex flex-col items-center justify-center gap-1 min-h-[140px] text-xs"
              >
                <Plus className="h-5 w-5" />
                <span>Añadir color</span>
              </button>
            )}
            {readOnly && (marca.paleta ?? []).length === 0 && (
              <p className="col-span-full text-xs text-muted-foreground">Sin paleta definida.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipografías y valores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field label="Tipografía titulares" badge={ia("tipografiaTitulares") ? <BadgeSugerenciaIA /> : null}>
              <Input
                disabled={readOnly}
                value={marca.tipografiaTitulares}
                onChange={(e) => set({ tipografiaTitulares: e.target.value })}
                placeholder="Ej. Playfair Display"
                className={ia("tipografiaTitulares") ? "bg-amber-50/60 border-amber-200" : undefined}
              />
            </Field>
            <Field label="Tipografía cuerpo" badge={ia("tipografiaCuerpo") ? <BadgeSugerenciaIA /> : null}>
              <Input
                disabled={readOnly}
                value={marca.tipografiaCuerpo}
                onChange={(e) => set({ tipografiaCuerpo: e.target.value })}
                placeholder="Ej. Inter"
                className={ia("tipografiaCuerpo") ? "bg-amber-50/60 border-amber-200" : undefined}
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-muted-foreground text-xs">Valores de marca</Label>
                {ia("valores") && <BadgeSugerenciaIA />}
              </div>
              {!readOnly && (
                <Button size="sm" variant="ghost" onClick={addValor} className="h-7 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Añadir valor
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(marca.valores ?? []).map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    disabled={readOnly}
                    value={v}
                    onChange={(e) => updateValor(i, e.target.value)}
                    placeholder="Ej. Cercanía, sostenibilidad…"
                    className="h-8 text-sm"
                  />
                  {!readOnly && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      onClick={() => removeValor(i)}
                      title="Quitar valor"
                      aria-label="Quitar valor"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {(marca.valores ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Aún no hay valores definidos.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
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
