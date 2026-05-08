"use client";

import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getBranding, saveBranding, uploadLogo,
} from "../actions/branding-actions";
import type { Branding } from "../types/presentaciones";
import { TIPOGRAFIAS } from "../data/layouts";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

const DEFAULT: Branding = {
  empresa_id: "",
  logo_url: null,
  color_primario: "#0F172A",
  color_secundario: "#3B82F6",
  color_fondo: "#FFFFFF",
  color_texto: "#0F172A",
  tipografia_titulo: "Inter",
  tipografia_cuerpo: "Inter",
  fondo_url: null,
};

interface BrandingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandingDialog({ open, onOpenChange }: BrandingDialogProps) {
  const [branding, setBranding] = useState<Branding>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const res = await getBranding();
      if (res.ok && res.data) setBranding(res.data);
      else if (res.error) toast.error(res.error);
      setLoading(false);
    })();
  }, [open]);

  const onUpload = async (file: File) => {
    setUploading(true);
    const res = await uploadLogo(file);
    setUploading(false);
    if (res.ok && res.url) {
      setBranding((b) => ({ ...b, logo_url: res.url! }));
      toast.success("Logo subido");
    } else {
      toast.error(res.error ?? "Error al subir logo");
    }
  };

  const onSave = async () => {
    setSaving(true);
    const res = await saveBranding({
      logo_url: branding.logo_url,
      color_primario: branding.color_primario,
      color_secundario: branding.color_secundario,
      color_fondo: branding.color_fondo,
      color_texto: branding.color_texto,
      tipografia_titulo: branding.tipografia_titulo,
      tipografia_cuerpo: branding.tipografia_cuerpo,
      fondo_url: branding.fondo_url,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Marca guardada");
      onOpenChange(false);
    } else {
      toast.error(res.error ?? "Error al guardar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Imagen de marca</DialogTitle>
          <DialogDescription>
            Se aplica automáticamente a las nuevas presentaciones.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <LoadingSpinner className="py-8" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
            {/* LOGO */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Logo</h3>
              <div
                className="rounded-lg border-2 border-dashed flex items-center justify-center h-32 bg-muted/30"
                style={{ backgroundColor: branding.color_fondo }}
              >
                {branding.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={branding.logo_url}
                    alt="Logo"
                    className="max-h-24 max-w-[80%] object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Sin logo (opcional)
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Subiendo…" : branding.logo_url ? "Cambiar" : "Subir"}
                </Button>
                {branding.logo_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBranding((b) => ({ ...b, logo_url: null }))}
                  >
                    Quitar
                  </Button>
                )}
              </div>
            </section>

            {/* PREVIEW */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Vista previa</h3>
              <BrandingPreview branding={branding} />
            </section>

            {/* COLORES */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Colores</h3>
              <ColorField
                label="Primario"
                value={branding.color_primario}
                onChange={(v) => setBranding((b) => ({ ...b, color_primario: v }))}
              />
              <ColorField
                label="Secundario"
                value={branding.color_secundario}
                onChange={(v) => setBranding((b) => ({ ...b, color_secundario: v }))}
              />
              <ColorField
                label="Fondo"
                value={branding.color_fondo}
                onChange={(v) => setBranding((b) => ({ ...b, color_fondo: v }))}
              />
              <ColorField
                label="Texto"
                value={branding.color_texto}
                onChange={(v) => setBranding((b) => ({ ...b, color_texto: v }))}
              />
            </section>

            {/* TIPOGRAFÍAS */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Tipografías</h3>
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Select
                  value={branding.tipografia_titulo}
                  onValueChange={(v) =>
                    setBranding((b) => ({ ...b, tipografia_titulo: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOGRAFIAS.map((t) => (
                      <SelectItem key={t} value={t} style={{ fontFamily: t }}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cuerpo</Label>
                <Select
                  value={branding.tipografia_cuerpo}
                  onValueChange={(v) =>
                    setBranding((b) => ({ ...b, tipografia_cuerpo: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOGRAFIAS.map((t) => (
                      <SelectItem key={t} value={t} style={{ fontFamily: t }}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving || loading}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono h-9 text-sm"
        />
      </div>
    </div>
  );
}

function BrandingPreview({ branding }: { branding: Branding }) {
  return (
    <div
      className="aspect-video rounded-lg border overflow-hidden flex flex-col p-5"
      style={{
        backgroundColor: branding.color_fondo,
        color: branding.color_texto,
        fontFamily: branding.tipografia_cuerpo,
      }}
    >
      {branding.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logo_url}
          alt=""
          className="max-h-8 w-auto mb-3"
          style={{ objectFit: "contain" }}
        />
      )}
      <h2
        className="text-xl font-bold mb-2"
        style={{ color: branding.color_primario, fontFamily: branding.tipografia_titulo }}
      >
        Título
      </h2>
      <ul className="text-xs space-y-1 list-disc ml-4">
        <li>Punto del contenido</li>
        <li>
          Con un{" "}
          <span style={{ color: branding.color_secundario, fontWeight: 600 }}>
            acento
          </span>
        </li>
      </ul>
      <div
        className="mt-auto h-1 w-16 rounded"
        style={{ backgroundColor: branding.color_primario }}
      />
    </div>
  );
}
