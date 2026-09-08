import Image from "next/image";
import { cn } from "@/shared/lib/utils";
import type { ClaseEscuela } from "../../types";

/**
 * Miniatura de una clase.
 *
 * Si la clase trae imagen propia, se pinta esa. Si no, se dibuja una con la
 * IMAGEN DE MARCA de la empresa (colores de Ajustes → Imagen de marca + su
 * isotipo) y el título encima: así el calendario nunca tiene huecos grises y
 * todas las clases se ven de la misma familia, sin subir ni generar ficheros.
 */

export function MiniaturaClase({
  clase,
  isotipoUrl,
  className,
  compacta = false,
}: {
  clase: Pick<ClaseEscuela, "titulo" | "tipo" | "cover" | "horaInicio">;
  isotipoUrl?: string | null;
  className?: string;
  /** En el calendario la miniatura es pequeña: menos texto, más imagen. */
  compacta?: boolean;
}) {
  const base = cn(
    "relative overflow-hidden rounded-lg w-full aspect-video ring-1 ring-black/5",
    className,
  );

  if (clase.cover) {
    return (
      <div className={base}>
        <Image src={clase.cover} alt={clase.titulo} fill sizes="320px" className="object-cover" />
      </div>
    );
  }

  // Un directo se distingue de una clase por el peso del color, no por otro
  // color inventado: el secundario ya es de la marca.
  const esDirecto = clase.tipo === "DIRECTO";
  const fondo = esDirecto
    ? "linear-gradient(135deg, var(--marca-secundario) 0%, var(--marca-primario) 100%)"
    : "linear-gradient(135deg, var(--marca-primario) 0%, color-mix(in srgb, var(--marca-primario) 55%, #000) 100%)";

  return (
    <div className={base} style={{ background: fondo }}>
      {isotipoUrl ? (
        <Image
          src={isotipoUrl}
          alt=""
          fill
          sizes="320px"
          className="object-contain p-[18%] opacity-25"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end gap-1 p-2.5">
        {!compacta ? (
          <span className="self-start rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            {clase.horaInicio}
          </span>
        ) : null}
        <span
          className={cn(
            "font-semibold leading-tight text-white drop-shadow",
            compacta ? "text-[11px] line-clamp-2" : "text-sm line-clamp-2",
          )}
        >
          {clase.titulo}
        </span>
      </div>
    </div>
  );
}
