"use client";

import { useEffect, useRef, useState } from "react";
import { Cctv, Loader2 } from "lucide-react";
import {
  listGrabaciones,
  type CamaraGrabacionRow,
} from "@/features/camaras/actions/camaras-actions";

/**
 * Tile de una cámara en el mosaico. Reproduce grabación desde Cloudflare R2
 * (arquitectura B: el vídeo vive en la nube, NO nos conectamos al grabador).
 *
 * Estrategia simple y robusta: encadena los clips más recientes de la cámara
 * (cada uno ~1 min) reproduciéndolos en secuencia. Al terminar uno, salta al
 * siguiente. Cada cierto tiempo refresca la lista para incorporar clips nuevos.
 */
export function CamaraTile({
  camaraId,
  nombre,
  ubicacion,
}: {
  camaraId: string;
  nombre: string;
  ubicacion?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [clips, setClips] = useState<CamaraGrabacionRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [estado, setEstado] = useState<"cargando" | "reproduciendo" | "sin-grabacion" | "error">(
    "cargando",
  );

  // Carga (y refresco periódico) de los clips más recientes de la cámara.
  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      const res = await listGrabaciones({ camaraId, limit: 30 });
      if (cancelado) return;
      if (!res.ok) {
        setEstado("error");
        return;
      }
      // Orden ascendente para reproducir en orden cronológico.
      const ordenados = [...res.data].reverse();
      setClips((prev) => {
        // Primera carga: arranca por el clip más reciente disponible.
        if (prev.length === 0 && ordenados.length > 0) {
          setIdx(ordenados.length - 1);
        }
        return ordenados;
      });
      setEstado(ordenados.length === 0 ? "sin-grabacion" : "reproduciendo");
    }

    cargar();
    // Refresca cada 60 s para captar clips nuevos que suba el grabador.
    const t = setInterval(cargar, 60_000);
    return () => {
      cancelado = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camaraId]);

  const actual = clips[idx];

  if (estado === "cargando") {
    return (
      <TileFrame nombre={nombre} ubicacion={ubicacion}>
        <div className="text-center text-white/40">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          <p className="mt-2 text-[10px] uppercase tracking-wider">Cargando</p>
        </div>
      </TileFrame>
    );
  }

  if (estado === "sin-grabacion" || estado === "error" || !actual?.url) {
    return (
      <TileFrame nombre={nombre} ubicacion={ubicacion}>
        <div className="text-center text-white/40">
          <Cctv className="mx-auto h-8 w-8" />
          <p className="mt-2 text-[10px] uppercase tracking-wider">
            {estado === "error" ? "Sin conexión" : "Sin grabación aún"}
          </p>
        </div>
      </TileFrame>
    );
  }

  return (
    <TileFrame nombre={nombre} ubicacion={ubicacion}>
      <video
        ref={videoRef}
        key={actual.id}
        src={actual.url}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        playsInline
        onEnded={() => {
          // Salta al siguiente clip; si era el último, se queda esperando el
          // refresco periódico que traerá clips nuevos.
          setIdx((i) => (i + 1 < clips.length ? i + 1 : i));
        }}
        onError={() => {
          // Un clip corrupto no debe romper el tile: intenta el siguiente.
          setIdx((i) => (i + 1 < clips.length ? i + 1 : i));
        }}
      />
    </TileFrame>
  );
}

function TileFrame({
  nombre,
  ubicacion,
  children,
}: {
  nombre: string;
  ubicacion?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-md bg-zinc-950 border border-white/10">
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      <div className="absolute left-0 bottom-0 right-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-white truncate">{nombre}</p>
          {ubicacion && <p className="text-[9px] text-white/70 truncate">{ubicacion}</p>}
        </div>
      </div>
    </div>
  );
}
