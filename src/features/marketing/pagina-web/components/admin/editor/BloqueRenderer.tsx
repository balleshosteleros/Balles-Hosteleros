"use client";

/**
 * Render compacto (read-only) de cada bloque en el canvas del editor.
 * El render público rico vive en components/public/ (Fase 6-7).
 */
import { getCatalogo } from "../../../data/bloques-catalogo";
import type { Bloque } from "../../../types";

interface Props {
  bloque: Bloque;
  modo: "canvas" | "preview";
}

export function BloqueRenderer({ bloque, modo }: Props) {
  switch (bloque.tipo) {
    case "hero":
      return (
        <div className="min-h-[120px] rounded-md bg-gradient-to-br from-muted/60 to-muted flex flex-col justify-center px-4">
          <div className="text-xl font-bold truncate">{bloque.datos.titulo}</div>
          {bloque.datos.subtitulo ? (
            <div className="text-sm text-muted-foreground truncate">{bloque.datos.subtitulo}</div>
          ) : null}
          {bloque.datos.cta ? (
            <div className="mt-2">
              <span className="inline-block rounded bg-primary text-primary-foreground text-xs px-2 py-1">
                {bloque.datos.cta.label}
              </span>
            </div>
          ) : null}
        </div>
      );
    case "galeria":
      return (
        <div className="grid grid-cols-4 gap-1">
          {(bloque.datos.imagenes.length > 0
            ? bloque.datos.imagenes
            : [1, 2, 3, 4].map(() => ({ url: "", alt: "" }))
          )
            .slice(0, 4)
            .map((img, i) => (
              <div
                key={i}
                className="aspect-square rounded bg-muted"
                style={img.url ? { backgroundImage: `url(${img.url})`, backgroundSize: "cover" } : undefined}
              />
            ))}
          <PlaceholderEtiqueta text={`Galería · ${bloque.datos.imagenes.length} imágenes · ${bloque.datos.layout}`} />
        </div>
      );
    case "menu":
      return (
        <PlaceholderEtiqueta
          text={
            bloque.datos.fuente === "carta_items"
              ? `Menú desde carta digital · ${bloque.datos.categoria_ids?.length ?? 0} categorías`
              : `Menú manual · ${bloque.datos.items_manual?.length ?? 0} items`
          }
        />
      );
    case "reservas":
      return <PlaceholderEtiqueta text={`Reservas · modo ${bloque.datos.modo}`} />;
    case "testimonios":
      return <PlaceholderEtiqueta text={`Testimonios · ${bloque.datos.items.length} reseñas`} />;
    case "cta": {
      const cta = bloque.datos;
      return (
        <div className="rounded-md border border-dashed p-3">
          <div className="font-semibold">{cta.titulo}</div>
          {cta.texto ? <div className="text-sm text-muted-foreground">{cta.texto}</div> : null}
          <div className="mt-2">
            <span className="inline-block rounded bg-primary text-primary-foreground text-xs px-2 py-1">
              {cta.boton.label}
            </span>
          </div>
        </div>
      );
    }
    case "formulario":
      return (
        <PlaceholderEtiqueta
          text={`Formulario · ${bloque.datos.campos.length} campos · "${bloque.datos.titulo}"`}
        />
      );
    case "mapa":
      return <PlaceholderEtiqueta text={`Mapa · ${bloque.datos.direccion_texto}`} />;
    case "footer":
      return (
        <PlaceholderEtiqueta
          text={`Footer · ${bloque.datos.columnas.length} columnas · ${bloque.datos.redes?.length ?? 0} redes`}
        />
      );
    case "texto_libre":
      if (modo === "preview") {
        return (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: bloque.datos.html_seguro }}
          />
        );
      }
      return (
        <PlaceholderEtiqueta
          text={`Texto libre · ${bloque.datos.html_seguro.length} caracteres`}
        />
      );
    case "video":
      return (
        <PlaceholderEtiqueta
          text={`Video · ${bloque.datos.proveedor} · ${bloque.datos.url.slice(0, 48)}…`}
        />
      );
    default: {
      const catalogo = getCatalogo((bloque as Bloque).tipo);
      return <PlaceholderEtiqueta text={catalogo.label} />;
    }
  }
}

function PlaceholderEtiqueta({ text }: { text: string }) {
  return (
    <div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1.5 truncate">
      {text}
    </div>
  );
}
