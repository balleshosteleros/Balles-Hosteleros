"use client";

import { useEffect, useRef, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Trash2, Loader2, ImageIcon, Info, Eye, Sparkles } from "lucide-react";
import {
  uploadLogo,
  deleteLogo,
  uploadIsotipo,
  deleteIsotipo,
  saveBrandColors,
  getBrandConfig,
} from "@/features/empresa/actions/logo-actions";
import { pickReadableTextColor } from "@/features/empresa/lib/extract-brand-colors";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";
import { ImportarMarcaDialog } from "./ImportarMarcaDialog";
import type { MarcaImportada } from "@/features/empresa/actions/marca-import-actions";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

type Estado = {
  logoUrl: string | null;
  isotipoUrl: string | null;
  primario: string;
  secundario: string;
  texto: string;
  fuenteTitulos: string;
  fuenteCuerpo: string;
};

const DEFAULT_ESTADO: Estado = {
  logoUrl: null,
  isotipoUrl: null,
  primario: "#1F2937",
  secundario: "#94A3B8",
  texto: "#FFFFFF",
  fuenteTitulos: "",
  fuenteCuerpo: "",
};

export function ImagenMarcaTab() {
  const { empresaActual, setLogoUrl, setIsotipoUrl } = useEmpresa();
  const [estado, setEstado] = useState<Estado>(DEFAULT_ESTADO);
  const [cargando, setCargando] = useState(true);
  const [subiendoPrincipal, setSubiendoPrincipal] = useState(false);
  const [subiendoIsotipo, setSubiendoIsotipo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [aplicandoImport, setAplicandoImport] = useState(false);
  useGlobalLoadingSync(
    cargando || subiendoPrincipal || subiendoIsotipo || guardando || aplicandoImport,
  );
  const filePrincipalRef = useRef<HTMLInputElement>(null);
  const fileIsotipoRef = useRef<HTMLInputElement>(null);

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
            isotipoUrl: cfg.isotipoUrl,
            primario: cfg.colorPrimario && HEX_RE.test(cfg.colorPrimario) ? cfg.colorPrimario : DEFAULT_ESTADO.primario,
            secundario:
              cfg.colorSecundario && HEX_RE.test(cfg.colorSecundario) ? cfg.colorSecundario : DEFAULT_ESTADO.secundario,
            texto: cfg.colorTexto && HEX_RE.test(cfg.colorTexto) ? cfg.colorTexto : DEFAULT_ESTADO.texto,
            fuenteTitulos: cfg.fuenteTitulos ?? "",
            fuenteCuerpo: cfg.fuenteCuerpo ?? "",
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

  const subirIsotipoFile = async (file: File) => {
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("El isotipo es demasiado grande. Usa una imagen de menos de 5 MB.");
      return;
    }
    setSubiendoIsotipo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const url = await uploadIsotipo(empresaActual.id, fd);
      setEstado((prev) => ({ ...prev, isotipoUrl: url }));
      setIsotipoUrl(empresaActual.id, url);
      toast.success("Isotipo guardado");
    } catch (err) {
      console.error("[ImagenMarcaTab] uploadIsotipo:", err);
      toast.error(friendlyError(err));
    } finally {
      setSubiendoIsotipo(false);
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

  const borrarIsotipo = async () => {
    setSubiendoIsotipo(true);
    try {
      await deleteIsotipo(empresaActual.id);
      setEstado((prev) => ({ ...prev, isotipoUrl: null }));
      setIsotipoUrl(empresaActual.id, "");
      toast.success("Isotipo eliminado");
    } catch (err) {
      console.error("[ImagenMarcaTab] deleteIsotipo:", err);
      toast.error(friendlyError(err));
    } finally {
      setSubiendoIsotipo(false);
    }
  };

  const aplicarMarcaImportada = async (data: MarcaImportada) => {
    setAplicandoImport(true);
    try {
      let nextLogoUrl: string | null = estado.logoUrl;
      let nextIsotipoUrl: string | null = estado.isotipoUrl;

      // 1) Logotipo (imagen ancha con texto)
      if (data.logotipo) {
        const blob = await (await fetch(data.logotipo.dataUrl)).blob();
        const ext = (data.logotipo.mimeType.split("/")[1] ?? "png").replace("svg+xml", "svg");
        const file = new File([blob], `logo-importado.${ext}`, { type: data.logotipo.mimeType });
        const fd = new FormData();
        fd.append("file", file);
        nextLogoUrl = await uploadLogo(empresaActual.id, fd);
        setLogoUrl(empresaActual.id, nextLogoUrl);
      }

      // 2) Isotipo (icono cuadrado)
      if (data.isotipo) {
        const blob = await (await fetch(data.isotipo.dataUrl)).blob();
        const ext = (data.isotipo.mimeType.split("/")[1] ?? "png").replace("svg+xml", "svg");
        const file = new File([blob], `isotipo-importado.${ext}`, { type: data.isotipo.mimeType });
        const fd = new FormData();
        fd.append("file", file);
        nextIsotipoUrl = await uploadIsotipo(empresaActual.id, fd);
        setIsotipoUrl(empresaActual.id, nextIsotipoUrl);
      }

      // 3) Paleta + tipografía
      await saveBrandColors(empresaActual.id, {
        primario: data.paleta.primario,
        secundario: data.paleta.secundario,
        texto: data.paleta.texto,
        fuenteTitulos: data.tipografia.titulos ?? undefined,
        fuenteCuerpo: data.tipografia.cuerpo ?? undefined,
      });

      // 4) Reflejar en UI
      setEstado((prev) => ({
        ...prev,
        logoUrl: nextLogoUrl,
        isotipoUrl: nextIsotipoUrl,
        primario: data.paleta.primario,
        secundario: data.paleta.secundario,
        texto: data.paleta.texto,
        fuenteTitulos: data.tipografia.titulos ?? prev.fuenteTitulos,
        fuenteCuerpo: data.tipografia.cuerpo ?? prev.fuenteCuerpo,
      }));
    } catch (err) {
      console.error("[ImagenMarcaTab] aplicarMarcaImportada:", err);
      throw new Error(friendlyError(err));
    } finally {
      setAplicandoImport(false);
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
        fuenteTitulos: estado.fuenteTitulos.trim() || null,
        fuenteCuerpo: estado.fuenteCuerpo.trim() || null,
      });
      toast.success("Marca guardada");
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
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Imagen de marca · {empresaActual.nombre}</CardTitle>
          <Button
            size="sm"
            variant="primary"
            className="gap-1.5"
            onClick={() => setImportarOpen(true)}
            disabled={aplicandoImport}
          >
            {aplicandoImport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Importar con IA
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Identidad visual global de <strong className="text-foreground">{empresaActual.nombre}</strong>: logotipos
              y paleta de marca. Se aplica al selector de empresa, comunicaciones y como base de la carta digital.
              El estilo específico de la carta (cabecera, tipografías, modo claro/oscuro…) se configura desde el
              módulo Marketing → Carta digital.
              {" "}<span className="text-foreground">Atajo:</span> pulsa <strong>Importar con IA</strong> y pega la URL de tu web para rellenarlo todo en segundos.
            </p>
          </div>

          {/* Logos */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <LogoSlot
              titulo="Logotipo"
              descripcion="Icono + texto. Se usa en presentaciones, comunicaciones y header de la carta."
              url={estado.logoUrl}
              previewBg="#FFFFFF"
              uploading={subiendoPrincipal}
              fileRef={filePrincipalRef}
              onUpload={subirLogoPrincipal}
              onDelete={borrarPrincipal}
            />
            <LogoSlot
              titulo="Isotipo"
              descripcion="Solo el icono, sin texto. Se usa en el avatar del sidebar, favicons y vistas compactas."
              url={estado.isotipoUrl}
              previewBg="#FFFFFF"
              uploading={subiendoIsotipo}
              fileRef={fileIsotipoRef}
              onUpload={subirIsotipoFile}
              onDelete={borrarIsotipo}
            />
          </div>

          {/* Colores */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Paleta de marca</h3>

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

          {/* Tipografía */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Tipografía de marca</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Familia para títulos</Label>
                <Input
                  value={estado.fuenteTitulos}
                  onChange={(e) =>
                    setEstado((prev) => ({ ...prev, fuenteTitulos: e.target.value }))
                  }
                  placeholder='ej. "Playfair Display"'
                />
                <p className="text-[11px] text-muted-foreground">
                  Nombre exacto (cualquier Google Font funciona). Vacío = tipografía por defecto del sistema.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Familia para cuerpo de texto</Label>
                <Input
                  value={estado.fuenteCuerpo}
                  onChange={(e) =>
                    setEstado((prev) => ({ ...prev, fuenteCuerpo: e.target.value }))
                  }
                  placeholder='ej. "Inter"'
                />
                <p className="text-[11px] text-muted-foreground">
                  Si la dejas vacía se usará la misma que los títulos.
                </p>
              </div>
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

      <ImportarMarcaDialog
        open={importarOpen}
        onOpenChange={setImportarOpen}
        onApply={aplicarMarcaImportada}
      />
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
