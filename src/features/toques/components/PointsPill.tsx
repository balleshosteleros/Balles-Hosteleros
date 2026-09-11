"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { iconoDeNivel, COLOR_NIVEL_POR_DEFECTO } from "@/features/toques/lib/nivel-icono";
import { getPointsResumen, type PointsResumen } from "@/features/toques/lib/points-resumen";
import { cn } from "@/lib/utils";

interface Props {
  /** Resuelto en el servidor (Inicio del móvil): así sale pintada de una vez. */
  inicial?: PointsResumen | null;
  href?: string;
  className?: string;
}

/** Cada "+2" que sube y se desvanece encima de la píldora. */
interface Flotante {
  id: number;
  texto: string;
  positivo: boolean;
}

/**
 * La píldora de POINTS: el nivel y los points, arriba del todo.
 *
 * Es el marcador del juego. Se ve de un vistazo en qué nivel va (la insignia,
 * con su color y un aro que enseña cuánto le falta para el siguiente) y cuántos
 * points tiene. Cuando gana, sale un «+10» que sube y se apaga, y el número da
 * un saltito. Nada más: ni tarjetas, ni barras, ni texto — la pantalla de
 * arriba tiene que seguir despejada, y el detalle está a un toque.
 *
 * Es el ÚNICO acceso a Points: por eso se quitó de la rejilla de paneles y del
 * menú del ordenador (Iván, 12-09-2026).
 */
export function PointsPill({ inicial = null, href = "/m/points", className }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { empresaActual } = useEmpresa();
  const empresaDbId = empresaActual?.dbId ?? null;

  const [datos, setDatos] = useState<PointsResumen | null>(inicial);
  const [flotantes, setFlotantes] = useState<Flotante[]>([]);
  const [salto, setSalto] = useState(false);
  const contador = useRef(0);

  const cargar = useCallback(async () => {
    if (!empresaDbId) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setDatos(await getPointsResumen(supabase, user.id, empresaDbId));
    } catch (err) {
      console.error("[PointsPill] no se pudo leer el saldo", err);
    }
  }, [supabase, empresaDbId]);

  // Sin datos del servidor (ordenador), o al cambiar de empresa: los points son
  // de CADA empresa, así que al cambiar de empresa el marcador cambia entero.
  // Lo que viene del servidor vale para el primer pintado y no se vuelve a pedir.
  const yaPintado = useRef(false);
  useEffect(() => {
    if (!empresaDbId) return;
    if (!yaPintado.current) {
      yaPintado.current = true;
      if (inicial) return;
    }
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaDbId, cargar]);

  // Cada point que entra se ve caer en el marcador, en el momento.
  useEffect(() => {
    const userId = datos?.userId;
    if (!userId || !empresaDbId) return;
    const canal = supabase
      .channel(`points-pill-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "toques_movimientos",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: unknown }) => {
          const m = payload.new as { toques?: number; empresa_id?: string } | null;
          if (!m || typeof m.toques !== "number") return;
          // Los points son de cada empresa: los de la otra no tocan este marcador.
          if (m.empresa_id && m.empresa_id !== empresaDbId) return;

          const id = ++contador.current;
          const positivo = m.toques > 0;
          setFlotantes((prev) => [
            ...prev,
            { id, texto: `${positivo ? "+" : ""}${m.toques}`, positivo },
          ]);
          setSalto(true);
          window.setTimeout(() => setSalto(false), 400);
          window.setTimeout(
            () => setFlotantes((prev) => prev.filter((f) => f.id !== id)),
            1400,
          );
          // El saldo y el nivel los recalcula el servidor (un canje, un nivel
          // nuevo): se vuelven a leer en vez de sumarlos a mano aquí.
          void cargar();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [supabase, datos?.userId, empresaDbId, cargar]);

  if (!datos) return null;

  const Insignia = iconoDeNivel(datos.nivelIcono);
  const color = datos.nivelColor || COLOR_NIVEL_POR_DEFECTO;
  const pct = Math.min(100, Math.max(0, datos.progresoPct));

  return (
    <Link
      href={href}
      aria-label={`${datos.saldo} points · nivel ${datos.nivelNombre}`}
      title={`Nivel ${datos.nivelNombre}`}
      className={cn(
        "relative flex shrink-0 items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-1 pr-2.5 transition-transform active:scale-95",
        className,
      )}
    >
      {/* Insignia del nivel, con el aro de lo que lleva hecho hacia el siguiente.
          El hueco del aro va en gris oscuro y no en `muted`: los colores de los
          niveles son pastel y sobre gris claro el aro no se veía. */}
      <span
        className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(from -90deg, ${color} ${pct}%, hsl(var(--foreground) / 0.14) ${pct}%)`,
        }}
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-background"
          style={{ backgroundColor: color }}
        >
          <Insignia className="h-3 w-3 text-white" strokeWidth={2.4} />
        </span>
      </span>

      <span
        className={cn(
          "text-sm font-bold leading-none tabular-nums transition-transform duration-200",
          salto && "scale-125",
        )}
      >
        {datos.saldo}
      </span>

      {/* El «+10» que sube y se apaga. */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 -top-1 flex justify-center">
        {flotantes.map((f) => (
          <span
            key={f.id}
            className={cn(
              "points-sube absolute text-xs font-extrabold",
              f.positivo ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {f.texto}
          </span>
        ))}
      </span>
    </Link>
  );
}
