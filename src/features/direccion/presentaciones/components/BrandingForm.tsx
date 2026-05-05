"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Palette, Upload, ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

export function BrandingForm() {
  const [branding, setBranding] = useState<Branding>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const res = await getBranding();
      if (res.ok && res.data) setBranding(res.data);
      else if (res.error) toast.error(res.error);
      setLoading(false);
    })();
  }, []);

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
    if (res.ok) toast.success("Marca guardada");
    else toast.error(res.error ?? "Error al guardar");
  };

  if (loading) {
    return <LoadingSpinner className="p-8" />;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/direccion/presentaciones">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Palette className="h-6 w-6" /> Imagen de marca
            </h1>
            <p className="text-sm text-muted-foreground">
              Se aplica automáticamente a todas las nuevas presentaciones.
            </p>
          </div>
        </div>
        <Button variant="primary" size="lg" onClick={onSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Guardando…" : "Guardar marca"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LOGO */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="rounded-lg border-2 border-dashed flex items-center justify-center h-40 bg-muted/30"
              style={{ backgroundColor: branding.color_fondo }}
            >
              {branding.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logo_url}
                  alt="Logo"
                  className="max-h-32 max-w-[80%] object-contain"
                />
              ) : (
                <span className="text-sm text-muted-foreground">
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
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Subiendo…" : branding.logo_url ? "Cambiar logo" : "Subir logo"}
              </Button>
              {branding.logo_url && (
                <Button
                  variant="ghost"
                  onClick={() => setBranding((b) => ({ ...b, logo_url: null }))}
                >
                  Quitar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              PNG/SVG con fondo transparente funciona mejor.
            </p>
          </CardContent>
        </Card>

        {/* COLORES */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorField
              label="Primario (títulos, acentos)"
              value={branding.color_primario}
              onChange={(v) => setBranding((b) => ({ ...b, color_primario: v }))}
            />
            <ColorField
              label="Secundario (detalles)"
              value={branding.color_secundario}
              onChange={(v) => setBranding((b) => ({ ...b, color_secundario: v }))}
            />
            <ColorField
              label="Fondo de slide"
              value={branding.color_fondo}
              onChange={(v) => setBranding((b) => ({ ...b, color_fondo: v }))}
            />
            <ColorField
              label="Texto"
              value={branding.color_texto}
              onChange={(v) => setBranding((b) => ({ ...b, color_texto: v }))}
            />
          </CardContent>
        </Card>

        {/* TIPOGRAFÍAS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipografías</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* PREVIEW */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vista previa</CardTitle>
          </CardHeader>
          <CardContent>
            <BrandingPreview branding={branding} />
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium">Se aplica automáticamente</p>
          <p className="text-muted-foreground">
            Cada presentación nueva guarda una copia de esta marca. Editarla aquí no
            altera las presentaciones ya generadas.
          </p>
        </div>
      </div>
    </div>
  );
}

function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-16 rounded border cursor-pointer"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  );
}

function BrandingPreview({ branding }: { branding: Branding }) {
  return (
    <div
      className="aspect-video rounded-lg border overflow-hidden flex flex-col p-8"
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
          className="max-h-10 w-auto mb-4"
          style={{ objectFit: "contain" }}
        />
      )}
      <h2
        className="text-3xl font-bold mb-3"
        style={{ color: branding.color_primario, fontFamily: branding.tipografia_titulo }}
      >
        Título de la presentación
      </h2>
      <ul className="text-sm space-y-1.5 list-disc ml-5">
        <li>Primer punto importante del contenido</li>
        <li>
          Con un{" "}
          <span style={{ color: branding.color_secundario, fontWeight: 600 }}>
            acento secundario
          </span>{" "}
          destacado
        </li>
        <li>Tercer punto de apoyo</li>
      </ul>
      <div
        className="mt-auto h-1 w-20 rounded"
        style={{ backgroundColor: branding.color_primario }}
      />
    </div>
  );
}
