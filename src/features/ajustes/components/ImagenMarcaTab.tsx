"use client";

import { useEffect, useRef, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Trash2, Loader2, ImageIcon, Wand2, Info, Eye } from "lucide-react";
import {
  uploadLogo,
  deleteLogo,
  uploadLogoAlt,
  deleteLogoAlt,
  saveBrandColors,
  getBrandConfig,
} from "@/features/empresa/actions/logo-actions";
import { extractBrandColorsFromUrl, pickReadableTextColor } from "@/features/empresa/lib/extract-brand-colors";
import { friendlyError } from "@/shared/lib/friendly-errors";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

type Estado = {
  logoUrl: string | null;
  logoAltUrl: string | null;
  primario: string;
  secundario: string;
  texto: string;
};

const DEFAULT_ESTADO: Estado = {
  logoUrl: null,
  logoAltUrl: null,
  primario: "#1F2937",
  secundario: "#94A3B8",
  texto: "#FFFFFF",
};

export function ImagenMarcaTab() {
  const { empresaActual, setLogoUrl } = useEmpresa();
  const [estado, setEstado] = useState<Estado>(DEFAULT_ESTADO);
  const [cargando, setCargando] = useState(true);
  const [subiendoPrincipal, setSubiendoPrincipal] = useState(false);
  const [subiendoAlt, setSubiendoAlt] = useState(false);
  const [extrayendo, setExtrayendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const filePrincipalRef = useRef<HTMLInputElement>(null);
  const fileAltRef = useRef<HTMLInputElement>(null);

  // Cargar config de marca de la empresa actual
  useEffect(() => {
    let alive = true;
    setCargando(true);
    getBrandConfig(empresaActual.id)
      .then((cfg) => {
        if (!alive) return;
        if (!cfg) {
          setEstado(DEFAULT_ESTADO);
        } else {
          setEstado({
            logoUrl: cfg.logoUrl,
            logoAltUrl: cfg.logoAltUrl,
            primario: cfg.colorPrimario && HEX_RE.test(cfg.colorPrimario) ? cfg.colorPrimario : DEFAULT_ESTADO.primario,
            secundario:
              cfg.colorSecundario && HEX_RE.test(cfg.colorSecundario) ? cfg.colorSecundario : DEFAULT_ESTADO.secundario,
            texto: cfg.colorTexto && HEX_RE.test(cfg.colorTexto) ? cfg.colorTexto : DEFAULT_ESTADO.texto,
          });
        }
      })
      .catch((err) => {
        console.error("[ImagenMarcaTab] getBrandConfig:", err);
      })
      .finally(() => {
        if (alive) setCargando(false);
      });
    return () => {
      alive = false;
    };
  }, [empresaActual.id]);

  const subirLogoPrincipal = async (file: File) => {
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("El logotipo es demasiado grande. Usa una imagen de menos de 5 MB.");
      return;
    }
    setSubiendoPrincipal(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const url = await uploadLogo(empresaActual.id, fd);
      setEstado((prev) => ({ ...prev, logoUrl: url }));
      setLogoUrl(empresaActual.id, url);
      toast.success("Logotipo principal guardado");
    } catch (err) {
      console.error("[ImagenMarcaTab] uploadLogo:", err);
      toast.error(friendlyError(err));
    } finally {
      setSubiendoPrincipal(false);
    }
  };

  const subirLogoAlt = async (file: File) => {
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("El logotipo es demasiado grande. Usa una imagen de menos de 5 MB.");
      return;
    }
    setSubiendoAlt(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const url = await uploadLogoAlt(empresaActual.id, fd);
      setEstado((prev) => ({ ...prev, logoAltUrl: url }));
      toast.success("Logotipo alternativo guardado");
    } catch (err) {
      console.error("[ImagenMarcaTab] uploadLogoAlt:", err);
      toast.error(friendlyError(err));
    } finally {
      setSubiendoAlt(false);
    }
  };

  const borrarPrincipal = async () => {
    setSubiendoPrincipal(true);
    try {
      await deleteLogo(empresaActual.id);
      setEstado((prev) => ({ ...prev, logoUrl: null }));
      setLogoUrl(empresaActual.id, "");
      toast.success("Logotipo eliminado");
    } catch (err) {
      console.error("[ImagenMarcaTab] deleteLogo:", err);
      toast.error(friendlyError(err));
    } finally {
      setSubiendoPrincipal(false);
    }
  };

  const borrarAlt = async () => {
    setSubiendoAlt(true);
    try {
      await deleteLogoAlt(empresaActual.id);
      setEstado((prev) => ({ ...prev, logoAltUrl: null }));
      toast.success("Logotipo alternativo eliminado");
    } catch (err) {
      console.error("[ImagenMarcaTab] deleteLogoAlt:", err);
      toast.error(friendlyError(err));
    } finally {
      setSubiendoAlt(false);
    }
  };

  const autoDetectar = async () => {
    if (!estado.logoUrl) {
      toast.error("Sube primero un logotipo principal.");
      return;
    }
    setExtrayendo(true);
    try {
      const palette = await extractBrandColorsFromUrl(estado.logoUrl);
      setEstado((prev) => ({
        ...prev,
        primario: palette.primario,
        secundario: palette.secundario,
        texto: palette.texto,
      }));
      toast.success("Colores detectados desde el logotipo");
    } catch (err) {
      console.error("[ImagenMarcaTab] auto-detect:", err);
      toast.error(friendlyError(err));
    } finally {
      setExtrayendo(false);
    }
  };

  const guardarColores = async () => {
    if (!HEX_RE.test(estado.primario) || !HEX_RE.test(estado.secundario) || !HEX_RE.test(estado.texto)) {
      toast.error("Los colores deben estar en formato #RRGGBB.");
      return;
    }
    setGuardando(true);
    try {
      await saveBrandColors(empresaActual.id, {
        primario: estado.primario,
        secundario: estado.secundario,
        texto: estado.texto,
      });
      toast.success("Paleta de marca guardada");
    } catch (err) {
      console.error("[ImagenMarcaTab] saveBrandColors:", err);
      toast.error(friendlyError(err));
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Imagen de marca · {empresaActual.nombre}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Identidad visual global de <strong className="text-foreground">{empresaActual.nombre}</strong>: logotipos
              y paleta de marca. Se aplica al selector de empresa, comunicaciones y como base de la carta digital.
              El estilo específico de la carta (cabecera, tipografías, modo claro/oscuro…) se configura desde el
              módulo Marketing → Carta digital.
            </p>
          </div>

          {/* Logos */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <LogoSlot
              titulo="Logotipo principal"
              descripcion="Para fondos claros. Recomendado: PNG o SVG con fondo transparente."
              url={estado.logoUrl}
              previewBg="#FFFFFF"
              uploading={subiendoPrincipal}
              fileRef={filePrincipalRef}
              onUpload={subirLogoPrincipal}
              onDelete={borrarPrincipal}
            />
            <LogoSlot
              titulo="Logotipo alternativo (opcional)"
              descripcion="Para fondos oscuros. Se usa cuando el principal no es legible."
              url={estado.logoAltUrl}
              previewBg="#1F2937"
              uploading={subiendoAlt}
              fileRef={fileAltRef}
              onUpload={subirLogoAlt}
              onDelete={borrarAlt}
            />
          </div>

          {/* Colores */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Paleta de marca</h3>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={autoDetectar}
                disabled={!estado.logoUrl || extrayendo}
              >
                {extrayendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Auto-detectar del logo
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <ColorField
                label="Color primario"
                value={estado.primario}
                onChange={(v) =>
                  setEstado((prev) => ({
                    ...prev,
                    primario: v,
                    texto: HEX_RE.test(v) ? pickReadableTextColor(v) : prev.texto,
                  }))
                }
              />
              <ColorField
                label="Color secundario"
                value={estado.secundario}
                onChange={(v) => setEstado((prev) => ({ ...prev, secundario: v }))}
              />
              <ColorField
                label="Color de texto sobre marca"
                value={estado.texto}
                onChange={(v) => setEstado((prev) => ({ ...prev, texto: v }))}
              />
            </div>
          </div>

          {/* Vista previa */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Eye className="h-3.5 w-3.5" />
              Vista previa
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <PreviewIdentidad
                nombre={empresaActual.nombre}
                logoUrl={estado.logoUrl}
                primario={estado.primario}
                secundario={estado.secundario}
                texto={estado.texto}
              />
              <PreviewBoton primario={estado.primario} texto={estado.texto} secundario={estado.secundario} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={guardarColores} disabled={guardando}>
              {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar paleta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LogoSlot({
  titulo,
  descripcion,
  url,
  previewBg,
  uploading,
  fileRef,
  onUpload,
  onDelete,
}: {
  titulo: string;
  descripcion: string;
  url: string | null;
  previewBg: string;
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div>
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </div>
      <div
        className="flex h-32 items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-muted-foreground/20"
        style={{ backgroundColor: previewBg }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={titulo} className="max-h-full max-w-full object-contain p-3" />
        ) : (
          <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {url ? "Cambiar" : "Subir"}
        </Button>
        {url && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={uploading}
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onUpload(file);
          }}
        />
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const valid = HEX_RE.test(value);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded border bg-background"
          aria-label={`Selector ${label}`}
        />
        <Input
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next.startsWith("#") ? next.toUpperCase() : `#${next.toUpperCase()}`);
          }}
          maxLength={7}
          className="h-9 font-mono text-xs"
          placeholder="#1F2937"
        />
      </div>
    </div>
  );
}

function PreviewIdentidad({
  nombre,
  logoUrl,
  primario,
  secundario,
  texto,
}: {
  nombre: string;
  logoUrl: string | null;
  primario: string;
  secundario: string;
  texto: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="px-4 py-5 text-center" style={{ backgroundColor: primario, color: texto }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="logo" className="mx-auto mb-2 h-10 w-10 rounded-full bg-white/90 object-contain p-1" />
        ) : null}
        <p className="text-lg font-semibold tracking-wide">{nombre}</p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.3em] opacity-80">Identidad de marca</p>
      </div>
      <div className="bg-card p-3">
        <p className="text-xs font-semibold" style={{ color: primario }}>
          Encabezados
        </p>
        <p className="text-xs" style={{ color: secundario }}>
          Texto secundario en color de apoyo.
        </p>
      </div>
    </div>
  );
}

function PreviewBoton({
  primario,
  texto,
  secundario,
}: {
  primario: string;
  texto: string;
  secundario: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-4">
      <p className="text-xs text-muted-foreground">Botón con la marca</p>
      <button
        type="button"
        className="rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition-opacity hover:opacity-90"
        style={{ backgroundColor: primario, color: texto }}
      >
        Reservar mesa
      </button>
      <p className="text-xs text-muted-foreground">Texto secundario</p>
      <p className="text-sm" style={{ color: secundario }}>
        Sirviendo cocina mediterránea desde 1998.
      </p>
    </div>
  );
}
