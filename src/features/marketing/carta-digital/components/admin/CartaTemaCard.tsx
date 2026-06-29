"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { toast } from "sonner";
import { Upload, Trash2, Loader2, ImageIcon, Eye, Star, Utensils, Filter, Palette, AlertCircle } from "lucide-react";
import {
  uploadCartaHero,
  deleteCartaHero,
  saveBrandColors,
  getBrandConfig,
  type EstiloCards,
  type ModoCarta,
} from "@/features/empresa/actions/logo-actions";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { useGlobalLoadingSync } from "@/shared/hooks/use-global-loading-sync";

const MAX_HERO_BYTES = 8 * 1024 * 1024;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const FUENTES_TITULOS: { label: string; value: string }[] = [
  { label: "Cormorant — clásica elegante", value: "Cormorant Garamond" },
  { label: "Playfair — editorial", value: "Playfair Display" },
  { label: "DM Serif — moderna", value: "DM Serif Display" },
  { label: "Lora — cálida lectura", value: "Lora" },
  { label: "Marcellus — refinada", value: "Marcellus" },
  { label: "Italiana — fina alta", value: "Italiana" },
  { label: "Bebas Neue — display sans", value: "Bebas Neue" },
  { label: "Montserrat — limpia sans", value: "Montserrat" },
];

const FUENTES_CUERPO: { label: string; value: string }[] = [
  { label: "Inter — moderna", value: "Inter" },
  { label: "Manrope — geométrica", value: "Manrope" },
  { label: "Poppins — redondeada", value: "Poppins" },
  { label: "DM Sans — limpia", value: "DM Sans" },
  { label: "Nunito — amigable", value: "Nunito" },
  { label: "Work Sans — profesional", value: "Work Sans" },
];

type Estado = {
  primario: string;
  secundario: string;
  texto: string;
  fondo: string;
  acento: string;
  fuenteTitulos: string;
  fuenteCuerpo: string;
  estiloCards: EstiloCards;
  modo: ModoCarta;
  heroUrl: string | null;
};

const DEFAULT_ESTADO: Estado = {
  primario: "#1F2937",
  secundario: "#94A3B8",
  texto: "#FFFFFF",
  fondo: "#FAF7F2",
  acento: "#D4A574",
  fuenteTitulos: "Cormorant Garamond",
  fuenteCuerpo: "Inter",
  estiloCards: "sombra",
  modo: "claro",
  heroUrl: null,
};

export function CartaTemaCard({ empresaSlug, nombreEmpresa }: { empresaSlug: string; nombreEmpresa: string }) {
  const [estado, setEstado] = useState<Estado>(DEFAULT_ESTADO);
  const [cargando, setCargando] = useState(true);
  const [subiendoHero, setSubiendoHero] = useState(false);
  const [guardando, setGuardando] = useState(false);
  useGlobalLoadingSync(cargando || subiendoHero || guardando);
  const fileHeroRef = useRef<HTMLInputElement>(null);

  // Carga inicial.
  useEffect(() => {
    let alive = true;
    setCargando(true);
    getBrandConfig(empresaSlug)
      .then((cfg) => {
        if (!alive) return;
        if (!cfg) return setEstado(DEFAULT_ESTADO);
        setEstado({
          primario: cfg.colorPrimario && HEX_RE.test(cfg.colorPrimario) ? cfg.colorPrimario : DEFAULT_ESTADO.primario,
          secundario:
            cfg.colorSecundario && HEX_RE.test(cfg.colorSecundario) ? cfg.colorSecundario : DEFAULT_ESTADO.secundario,
          texto: cfg.colorTexto && HEX_RE.test(cfg.colorTexto) ? cfg.colorTexto : DEFAULT_ESTADO.texto,
          fondo:
            cfg.cartaColorFondo && HEX_RE.test(cfg.cartaColorFondo) ? cfg.cartaColorFondo : DEFAULT_ESTADO.fondo,
          acento:
            cfg.cartaColorAcento && HEX_RE.test(cfg.cartaColorAcento) ? cfg.cartaColorAcento : DEFAULT_ESTADO.acento,
          fuenteTitulos: cfg.cartaFuenteTitulos ?? DEFAULT_ESTADO.fuenteTitulos,
          fuenteCuerpo: cfg.cartaFuenteCuerpo ?? DEFAULT_ESTADO.fuenteCuerpo,
          estiloCards: (cfg.cartaEstiloCards ?? DEFAULT_ESTADO.estiloCards) as EstiloCards,
          modo: (cfg.cartaModo ?? DEFAULT_ESTADO.modo) as ModoCarta,
          heroUrl: cfg.cartaHeroUrl,
        });
      })
      .catch((err) => console.error("[CartaTemaCard] getBrandConfig:", err))
      .finally(() => {
        if (alive) setCargando(false);
      });
    return () => {
      alive = false;
    };
  }, [empresaSlug]);

  // Cargar Google Fonts dinámicamente para preview en vivo.
  useEffect(() => {
    const id = "carta-tema-fonts";
    const fams = [estado.fuenteTitulos, estado.fuenteCuerpo]
      .filter((f) => f && f.length < 60)
      .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700`)
      .join("&");
    const href = `https://fonts.googleapis.com/css2?${fams}&display=swap`;
    const existing = document.getElementById(id) as HTMLLinkElement | null;
    if (existing) {
      existing.href = href;
    } else {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }, [estado.fuenteTitulos, estado.fuenteCuerpo]);

  const subirHero = async (file: File) => {
    if (file.size > MAX_HERO_BYTES) return toast.error("La imagen pesa más de 8 MB.");
    setSubiendoHero(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const url = await uploadCartaHero(empresaSlug, fd);
      setEstado((p) => ({ ...p, heroUrl: url }));
      toast.success("Cabecera de la carta guardada");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSubiendoHero(false);
    }
  };

  const borrarHero = async () => {
    setSubiendoHero(true);
    try {
      await deleteCartaHero(empresaSlug);
      setEstado((p) => ({ ...p, heroUrl: null }));
      toast.success("Cabecera eliminada");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSubiendoHero(false);
    }
  };

  const guardar = async () => {
    if (!HEX_RE.test(estado.fondo) || !HEX_RE.test(estado.acento)) {
      return toast.error("Los colores deben estar en formato #RRGGBB.");
    }
    setGuardando(true);
    try {
      await saveBrandColors(empresaSlug, {
        cartaColorFondo: estado.fondo,
        cartaColorAcento: estado.acento,
        cartaFuenteTitulos: estado.fuenteTitulos,
        cartaFuenteCuerpo: estado.fuenteCuerpo,
        cartaEstiloCards: estado.estiloCards,
        cartaModo: estado.modo,
      });
      toast.success("Estilo de la carta guardado");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4" />
          Estilo de la carta digital
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Aquí defines cómo se ve la carta pública de <strong className="text-foreground">{nombreEmpresa}</strong>.
            Los colores primario y de marca se heredan de Ajustes → Imagen de marca; el resto es exclusivo de la carta.
          </p>
        </div>

        {/* Hero */}
        <Section titulo="Imagen de cabecera">
          <p className="text-xs text-muted-foreground">
            Foto panorámica que aparece detrás del nombre del negocio. Si no se sube, se genera un gradiente con tu
            color primario y de acento.
          </p>
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <div className="relative h-44 overflow-hidden rounded-md border-2 border-dashed border-muted-foreground/20 bg-muted/20">
              {estado.heroUrl ? (
                <Image src={estado.heroUrl} alt="Cabecera" fill className="object-cover" sizes="600px" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  <ImageIcon className="mr-2 h-5 w-5" /> Sin imagen — se usará gradiente de marca
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileHeroRef.current?.click()}
                disabled={subiendoHero}
              >
                {subiendoHero ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {estado.heroUrl ? "Cambiar imagen" : "Subir imagen"}
              </Button>
              {estado.heroUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={borrarHero}
                  disabled={subiendoHero}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </Button>
              ) : null}
              <input
                ref={fileHeroRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) subirHero(f);
                }}
              />
            </div>
          </div>
        </Section>

        {/* Colores específicos de la carta */}
        <Section titulo="Colores específicos de la carta">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ColorField
              label="Fondo de la carta"
              hint="Color base de toda la página"
              value={estado.fondo}
              onChange={(v) => setEstado((p) => ({ ...p, fondo: v }))}
            />
            <ColorField
              label="Acento"
              hint="Destacados, bordes, decoraciones"
              value={estado.acento}
              onChange={(v) => setEstado((p) => ({ ...p, acento: v }))}
            />
          </div>
        </Section>

        {/* Tipografía */}
        <Section titulo="Tipografía">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FontSelect
              label="Títulos"
              value={estado.fuenteTitulos}
              options={FUENTES_TITULOS}
              onChange={(v) => setEstado((p) => ({ ...p, fuenteTitulos: v }))}
            />
            <FontSelect
              label="Cuerpo"
              value={estado.fuenteCuerpo}
              options={FUENTES_CUERPO}
              onChange={(v) => setEstado((p) => ({ ...p, fuenteCuerpo: v }))}
            />
          </div>
        </Section>

        {/* Estilo cards + modo */}
        <Section titulo="Apariencia">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Estilo de tarjetas</Label>
              <div className="flex gap-2">
                {(["plana", "sombra", "borde"] as EstiloCards[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEstado((p) => ({ ...p, estiloCards: s }))}
                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium capitalize transition ${
                      estado.estiloCards === s
                        ? "border-primary bg-primary/5 text-primary"
                        : "text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Modo de color</Label>
              <div className="flex gap-2">
                {(["claro", "oscuro", "auto"] as ModoCarta[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEstado((p) => ({ ...p, modo: m }))}
                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium capitalize transition ${
                      estado.modo === m
                        ? "border-primary bg-primary/5 text-primary"
                        : "text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Vista previa */}
        <Section titulo="Vista previa en vivo">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            Cambios visibles en tiempo real
          </div>
          <PreviewCarta nombre={nombreEmpresa} estado={estado} />
        </Section>

        <div className="flex justify-end pt-2">
          <Button onClick={guardar} disabled={guardando} size="lg">
            {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="border-b pb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = HEX_RE.test(value);
  return (
    <div className="space-y-1.5">
      <div>
        <Label className="text-xs font-bold uppercase">{label}</Label>
        {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
      </div>
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
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

function FontSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Selecciona fuente" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <span style={{ fontFamily: `'${opt.value}', serif` }}>{opt.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PreviewCarta({ nombre, estado }: { nombre: string; estado: Estado }) {
  const sombra =
    estado.estiloCards === "sombra"
      ? "0 1px 3px rgba(0,0,0,0.06), 0 6px 16px rgba(0,0,0,0.04)"
      : "none";
  const oscuro = estado.modo === "oscuro";
  const fondo = oscuro ? "#101010" : estado.fondo;
  const texto = oscuro ? "#F5F1EA" : "#1A1A1A";
  const textoSuave = oscuro ? "#B8B0A4" : "#5A5550";
  const superficie = oscuro ? "#1A1614" : "#FFFFFF";
  const borde = oscuro ? "#2A2622" : "#E8E2D6";

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: borde }}>
      {/* Hero */}
      <div
        className="relative flex h-40 flex-col items-center justify-center"
        style={{
          background: estado.heroUrl
            ? `url(${estado.heroUrl}) center/cover`
            : `radial-gradient(120% 80% at 50% 30%, ${estado.acento} 0%, ${estado.primario} 60%, #000 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-black/30" />
        <h2
          className="relative text-3xl font-light tracking-[0.06em] text-white"
          style={{ fontFamily: `'${estado.fuenteTitulos}', serif` }}
        >
          {nombre.toUpperCase()}
        </h2>
        <p className="relative mt-1 text-[10px] uppercase tracking-[0.3em] text-white/80">Carta digital</p>
      </div>

      {/* Body */}
      <div className="grid grid-cols-[120px_1fr] gap-4 p-4" style={{ backgroundColor: fondo }}>
        <div>
          <div className="space-y-1">
            {["DELICATESES", "COCTELES", "CERVEZAS"].map((c, i) => (
              <div
                key={c}
                className="relative rounded-md py-1.5 pl-3 pr-2 text-[10px] font-bold uppercase tracking-widest"
                style={{
                  color: i === 0 ? estado.primario : textoSuave,
                  backgroundColor: i === 0 ? `${estado.primario}14` : "transparent",
                }}
              >
                {i === 0 ? (
                  <span
                    className="absolute left-0 top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-r-full"
                    style={{ backgroundColor: estado.primario }}
                  />
                ) : null}
                {c}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-widest"
            style={{ borderColor: borde, color: textoSuave }}
          >
            <Filter className="h-2.5 w-2.5" /> Sin alérgenos
          </button>

          <div className="space-y-2">
            <div
              className="flex items-stretch gap-3 rounded-lg p-2"
              style={{
                backgroundColor: superficie,
                boxShadow: sombra,
                border: estado.estiloCards === "borde" ? `1px solid ${borde}` : "none",
              }}
            >
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: `linear-gradient(135deg, ${estado.acento}40, ${superficie} 100%)`,
                }}
              >
                <Utensils className="h-4 w-4 opacity-50" style={{ color: estado.primario }} />
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{ color: texto, fontFamily: `'${estado.fuenteCuerpo}', sans-serif` }}
                  >
                    Burger Balles Hosteleros
                  </span>
                  <span
                    className="text-[12px] font-bold tabular-nums"
                    style={{ color: estado.primario, fontFamily: `'${estado.fuenteTitulos}', serif` }}
                  >
                    14,80€
                  </span>
                </div>
                <span className="mt-0.5 text-[9px]" style={{ color: textoSuave }}>
                  Carne angus, queso curado, panceta…
                </span>
              </div>
            </div>

            <div
              className="flex items-stretch gap-3 rounded-lg p-2"
              style={{
                backgroundColor: superficie,
                boxShadow: sombra,
                border: estado.estiloCards === "borde" ? `1px solid ${borde}` : "none",
              }}
            >
              <div
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: `linear-gradient(135deg, ${estado.acento}40, ${superficie} 100%)`,
                }}
              >
                <span
                  className="absolute left-0.5 top-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full"
                  style={{ backgroundColor: estado.acento, color: estado.texto }}
                >
                  <Star className="h-2 w-2 fill-current" />
                </span>
                <Utensils className="h-4 w-4 opacity-50" style={{ color: estado.primario }} />
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{ color: texto, fontFamily: `'${estado.fuenteCuerpo}', sans-serif` }}
                  >
                    Mojito Habanero
                  </span>
                  <span
                    className="text-[12px] font-bold tabular-nums"
                    style={{ color: estado.primario, fontFamily: `'${estado.fuenteTitulos}', serif` }}
                  >
                    8,75€
                  </span>
                </div>
                <span className="mt-0.5 text-[9px]" style={{ color: textoSuave }}>
                  Ron, hierbabuena, sour, azúcar, soda
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
