"use client";

import type { Slide, Branding } from "../types/presentaciones";

interface Props {
  slide: Slide;
  branding: Partial<Branding>;
  showLogo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_BRAND: Branding = {
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

export function SlideRenderer({
  slide, branding, showLogo = true, className, style,
}: Props) {
  const b = { ...DEFAULT_BRAND, ...branding };

  const cssVars: React.CSSProperties = {
    ["--brand-primario" as string]: b.color_primario,
    ["--brand-secundario" as string]: b.color_secundario,
    ["--brand-fondo" as string]: b.color_fondo,
    ["--brand-texto" as string]: b.color_texto,
    ["--brand-fuente-titulo" as string]: b.tipografia_titulo,
    ["--brand-fuente-cuerpo" as string]: b.tipografia_cuerpo,
    backgroundColor: b.color_fondo,
    color: b.color_texto,
    fontFamily: b.tipografia_cuerpo,
    backgroundImage: b.fondo_url ? `url(${b.fondo_url})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    ...style,
  };

  return (
    <div
      className={`relative w-full aspect-video overflow-hidden ${className ?? ""}`}
      style={cssVars}
    >
      {/* Logo esquina superior derecha */}
      {showLogo && b.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={b.logo_url}
          alt=""
          className="absolute top-6 right-6 max-h-12 w-auto opacity-90"
          style={{ objectFit: "contain" }}
        />
      )}

      {/* Contenido según layout */}
      <div className="absolute inset-0 flex flex-col justify-center p-16">
        <LayoutContent slide={slide} brand={b} />
      </div>

      {/* Barra inferior con color primario */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1.5"
        style={{ backgroundColor: b.color_primario }}
      />
    </div>
  );
}

function LayoutContent({ slide, brand }: { slide: Slide; brand: Branding }) {
  const titleStyle: React.CSSProperties = {
    color: brand.color_primario,
    fontFamily: brand.tipografia_titulo,
  };

  switch (slide.layout) {
    case "portada":
      return (
        <div className="max-w-4xl">
          <h1 className="text-6xl font-bold leading-tight mb-4" style={titleStyle}>
            {slide.titulo ?? "(Sin título)"}
          </h1>
          {slide.contenido.cuerpo && (
            <p className="text-2xl opacity-80 mt-2">{slide.contenido.cuerpo}</p>
          )}
          <div
            className="h-1 w-24 mt-6"
            style={{ backgroundColor: brand.color_secundario }}
          />
        </div>
      );

    case "cita":
      return (
        <div className="max-w-4xl text-center mx-auto">
          <span
            className="text-8xl leading-none block mb-4"
            style={{ color: brand.color_secundario }}
          >
            “
          </span>
          <p className="text-3xl font-medium italic leading-snug">
            {slide.contenido.cita ?? slide.titulo}
          </p>
          {slide.titulo && slide.contenido.cita && (
            <p className="mt-6 text-base opacity-70">— {slide.titulo}</p>
          )}
        </div>
      );

    case "comparacion":
      return (
        <div className="w-full">
          <h2 className="text-4xl font-bold mb-10" style={titleStyle}>
            {slide.titulo}
          </h2>
          <div className="grid grid-cols-2 gap-8">
            {(["izquierda", "derecha"] as const).map((lado, i) => {
              const titulo =
                lado === "izquierda"
                  ? slide.contenido.comparacion?.tituloIzq
                  : slide.contenido.comparacion?.tituloDer;
              const lista = slide.contenido.comparacion?.[lado] ?? [];
              return (
                <div
                  key={lado}
                  className="rounded-lg p-6"
                  style={{
                    backgroundColor: i === 0 ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.02)",
                    borderLeft: `4px solid ${i === 0 ? brand.color_primario : brand.color_secundario}`,
                  }}
                >
                  {titulo && (
                    <h3
                      className="text-xl font-semibold mb-3"
                      style={{
                        color: i === 0 ? brand.color_primario : brand.color_secundario,
                      }}
                    >
                      {titulo}
                    </h3>
                  )}
                  <ul className="space-y-2 text-lg">
                    {lista.map((t, j) => (
                      <li key={j}>• {t}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "cierre":
      return (
        <div className="max-w-4xl text-center mx-auto">
          <h2 className="text-6xl font-bold mb-6" style={titleStyle}>
            {slide.titulo ?? "Gracias"}
          </h2>
          {slide.contenido.cuerpo && (
            <p className="text-2xl opacity-80">{slide.contenido.cuerpo}</p>
          )}
        </div>
      );

    case "imagen":
      return (
        <div className="w-full">
          <h2 className="text-4xl font-bold mb-6" style={titleStyle}>
            {slide.titulo}
          </h2>
          <div
            className="aspect-[16/7] rounded-lg flex items-center justify-center text-sm opacity-50"
            style={{
              backgroundColor: "rgba(0,0,0,0.04)",
              border: `2px dashed ${brand.color_secundario}`,
            }}
          >
            [imagen: {slide.contenido.imagen_prompt ?? "sin descripción"}]
          </div>
        </div>
      );

    case "bullets":
    default:
      return (
        <div className="max-w-5xl">
          <h2 className="text-5xl font-bold mb-8" style={titleStyle}>
            {slide.titulo}
          </h2>
          <ul className="space-y-4 text-2xl leading-snug">
            {(slide.contenido.bullets ?? []).map((b, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className="mt-3 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: brand.color_secundario }}
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {slide.contenido.cuerpo && !slide.contenido.bullets?.length && (
            <p className="text-xl opacity-85 leading-relaxed">{slide.contenido.cuerpo}</p>
          )}
        </div>
      );
  }
}
