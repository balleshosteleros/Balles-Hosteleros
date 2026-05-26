"use client";

import { type ReactNode } from "react";
import { Users, Wine, Shield, Star, Award, Lightbulb, Coffee, Heart, Sparkles, Target, Eye, ThumbsUp, BookOpen, type LucideIcon } from "lucide-react";
import type { Slide, SlideBlock, EmpresaTheme } from "../types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  users: Users, wine: Wine, shield: Shield, star: Star, award: Award,
  lightbulb: Lightbulb, coffee: Coffee, heart: Heart, sparkles: Sparkles,
  target: Target, eye: Eye, "thumbs-up": ThumbsUp, "book-open": BookOpen,
};

// Fotos genéricas (restauración/sala) que se muestran por defecto cuando una
// slide aún no tiene imagen propia. Se pueden sustituir desde el editor.
const DEFAULT_SLIDE_IMAGES = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=900&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1592861956120-e524fc739696?w=900&auto=format&fit=crop&q=80",
];

function genericImageFor(index: number): string {
  return DEFAULT_SLIDE_IMAGES[index % DEFAULT_SLIDE_IMAGES.length];
}

interface SlideRendererProps {
  slide: Slide;
  theme: Pick<EmpresaTheme, "color" | "color_secundario" | "color_texto" | "logo_url" | "nombre">;
  /**
   * Posición de la slide dentro de la presentación. El logo solo se pinta
   * cuando `index === 0` (portada). En el resto el branding se sostiene
   * por colores corporativos, sin repetir el logo. Default 0 para mantener
   * compatibilidad con previews de slide única en el editor.
   */
  index?: number;
}

export function SlideRenderer({ slide, theme, index = 0 }: SlideRendererProps) {
  const bg = theme.color ?? "hsl(210 50% 20%)";
  const accent = theme.color_secundario ?? "hsl(170 70% 45%)";
  const text = theme.color_texto ?? "#ffffff";
  const isCover = index === 0;
  const showLogo = isCover && Boolean(theme.logo_url);

  const styleVars: React.CSSProperties = {
    "--slide-bg": bg,
    "--slide-accent": accent,
    "--slide-text": text,
  } as React.CSSProperties;

  const sideImage = slide.image ?? genericImageFor(index);
  const sideFocalX = clampFocal(slide.image_focal_x, 50);
  const sideFocalY = clampFocal(slide.image_focal_y, 50);
  const sideObjectPosition = `${sideFocalX}% ${sideFocalY}%`;

  return (
    <div
      style={{ ...styleVars, backgroundColor: bg, color: text }}
      className="relative rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/10"
    >
      {showLogo && (
        <div
          className={cn(
            "absolute z-10",
            slide.layout === "cover"
              ? "top-6 left-1/2 -translate-x-1/2"
              : "top-5 left-6",
          )}
        >
          <div
            className="rounded-xl px-3 py-2 backdrop-blur-md"
            style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={theme.logo_url!}
              alt={theme.nombre}
              className={cn(
                "w-auto object-contain",
                slide.layout === "cover" ? "h-14 md:h-16" : "h-10",
              )}
            />
          </div>
        </div>
      )}
      <div
        className={cn(
          "w-full",
          slide.layout === "cover" && "min-h-[420px] flex items-center justify-center text-center px-8 md:px-16 py-16",
          slide.layout === "split-right" && "grid md:grid-cols-[1.1fr_1fr] gap-8 items-center min-h-[420px] px-8 md:px-16 py-12",
          slide.layout === "split-left" && "grid md:grid-cols-[1fr_1.1fr] gap-8 items-center min-h-[420px] px-8 md:px-16 py-12",
          slide.layout === "default" && "px-8 md:px-16 py-12 space-y-6",
          showLogo && slide.layout === "cover" && "pt-28",
        )}
      >
        {slide.layout === "split-right" ? (
          <>
            <div className="space-y-5">
              {slide.blocks.map((b) => <BlockRenderer key={b.id} block={b} accent={accent} />)}
            </div>
            <div className="hidden md:block">
              <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl shadow-lg bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sideImage}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: sideObjectPosition }}
                />
              </div>
            </div>
          </>
        ) : slide.layout === "split-left" ? (
          <>
            <div className="hidden md:block">
              <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl shadow-lg bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sideImage}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: sideObjectPosition }}
                />
              </div>
            </div>
            <div className="space-y-5">
              {slide.blocks.map((b) => <BlockRenderer key={b.id} block={b} accent={accent} />)}
            </div>
          </>
        ) : (
          slide.blocks.map((b) => <BlockRenderer key={b.id} block={b} accent={accent} />)
        )}
      </div>
    </div>
  );
}

function BlockRenderer({ block, accent }: { block: SlideBlock; accent: string }): ReactNode {
  switch (block.type) {
    case "title":
      return (
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
          {block.href ? (
            <a href={block.href} target="_blank" rel="noopener noreferrer" className="underline decoration-current/40 hover:decoration-current">{block.text}</a>
          ) : (
            block.text
          )}
        </h1>
      );
    case "subtitle":
      return <h2 className="text-2xl md:text-3xl font-semibold opacity-90">{block.text}</h2>;
    case "paragraph":
      return (
        <p className="text-base md:text-lg leading-relaxed opacity-90 max-w-3xl">
          {block.href ? (
            <a href={block.href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: accent }}>{block.text}</a>
          ) : (
            block.text
          )}
        </p>
      );
    case "bullets":
      return (
        <ul className="space-y-2 text-base md:text-lg leading-relaxed">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    case "numbered":
      return (
        <ol className="space-y-5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-4">
              <div
                className="shrink-0 h-10 w-10 rounded-md flex items-center justify-center font-bold text-lg border-2"
                style={{ borderColor: accent, color: accent }}
              >
                {i + 1}
              </div>
              <div>
                <div className="font-semibold text-lg" style={{ color: accent }}>{it.titulo}</div>
                <div className="text-sm md:text-base opacity-90 mt-0.5 leading-relaxed">{it.descripcion}</div>
              </div>
            </li>
          ))}
        </ol>
      );
    case "cards":
      return (
        <div
          className={cn(
            "grid gap-4",
            block.columns === 2 && "grid-cols-1 md:grid-cols-2",
            block.columns === 3 && "grid-cols-1 md:grid-cols-3",
            block.columns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
          )}
        >
          {block.items.map((card, i) => {
            const cardFx = clampFocal(card.imagen_focal_x, 50);
            const cardFy = clampFocal(card.imagen_focal_y, 50);
            return (
              <div key={i} className="rounded-lg p-1 bg-white/5 backdrop-blur-sm">
                {card.imagen && (
                  <div className="relative w-full aspect-[4/3] overflow-hidden rounded-md mb-3 bg-black/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.imagen}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ objectPosition: `${cardFx}% ${cardFy}%` }}
                    />
                  </div>
                )}
                <div className="p-3 space-y-1.5">
                  <div className="font-semibold text-base md:text-lg leading-tight">{card.titulo}</div>
                  <div className="text-sm opacity-85 leading-relaxed">{card.descripcion}</div>
                </div>
              </div>
            );
          })}
        </div>
      );
    case "icon-row":
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {block.items.map((it, i) => {
            const Ico = ICONS[it.icono] ?? Star;
            return (
              <div key={i} className="space-y-2">
                <Ico className="h-8 w-8" style={{ color: accent }} />
                <div className="font-semibold text-lg">{it.titulo}</div>
                <div className="text-sm opacity-85 leading-relaxed">{it.descripcion}</div>
              </div>
            );
          })}
        </div>
      );
    case "buttons":
      return (
        <div className="flex flex-wrap gap-3">
          {block.items.map((btn, i) => (
            <a
              key={i}
              href={btn.href || "#"}
              target={btn.href?.startsWith("#") ? undefined : "_blank"}
              rel={btn.href?.startsWith("#") ? undefined : "noopener noreferrer"}
              className="inline-flex items-center px-5 py-2.5 rounded-md font-medium text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent, color: "#0a0a0a" }}
            >
              {btn.label}
            </a>
          ))}
        </div>
      );
    case "image": {
      if (!block.src) {
        return (
          <div className="w-full aspect-video rounded-xl flex items-center justify-center opacity-30 border border-dashed" style={{ borderColor: accent }}>
            <span className="text-xs uppercase tracking-wider">Imagen</span>
          </div>
        );
      }
      const fx = clampFocal(block.focal_x, 50);
      const fy = clampFocal(block.focal_y, 50);
      return (
        <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.src}
            alt={block.alt ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: `${fx}% ${fy}%` }}
          />
        </div>
      );
    }
    case "note":
      return (
        <div className="rounded-md px-4 py-3 text-sm opacity-90 border-l-2 italic" style={{ borderColor: accent }}>
          {block.text}
        </div>
      );
    case "divider":
      return <div className="h-px w-full opacity-30" style={{ backgroundColor: accent }} />;
  }
}

function clampFocal(v: number | null | undefined, fallback: number): number {
  if (v == null || !Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, v));
}
