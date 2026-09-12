"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/shared/components/ui/hover-card";
import {
  iconoDeNivel,
  tonosDeInsignia,
  COLOR_NIVEL_POR_DEFECTO,
} from "@/features/toques/lib/nivel-icono";
import { getPointsResumen, type PointsResumen } from "@/features/toques/lib/points-resumen";
import { cn } from "@/lib/utils";

// La pantalla entera de Points solo se carga cuando se abre la ventana: es
// grande y no tiene por qué viajar con cada página del software.
const ToquesView = dynamic(
  () => import("@/features/toques/components/ToquesView").then((m) => m.ToquesView),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

interface Props {
  /** Resuelto en el servidor: así sale pintada de una vez. */
  inicial?: PointsResumen | null;
  /**
   * A dónde lleva en el TELÉFONO, donde Points tiene pantalla propia. En el
   * ordenador no se navega: se abre la ventana entera encima.
   */
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
 * Es el marcador del juego, y el único acceso a Points desde que salió de la
 * lista de paneles. Enseña la insignia del nivel EN SU COLOR, un aro con lo que
 * lleva hecho hacia el siguiente, y los points que tiene. Cuando gana, sube un
 * «+10» y el número da un saltito; cuando le llega para un premio se enciende
 * un punto verde — que es lo que de verdad engancha: saber que ya puede canjear.
 *
 * Al pasar el ratón (ordenador) se despliega la escalera de niveles con el suyo
 * encendido y lo que le falta para el siguiente: se ve de un vistazo a dónde
 * puede llegar. Al pulsar se abre Points ENTERO: ventana a pantalla casi
 * completa en el ordenador, pantalla propia en el teléfono.
 */
export function PointsPill({ inicial = null, href = "/m/points", className }: Props) {
  const supabase = useMemo(() => createClient(), []);
  // `empresaVisible` es la empresa que el SERVIDOR dice estar sirviendo — la
  // misma con la que se pinta el logotipo de arriba. La elegida en el navegador
  // (`empresaActual`) puede ir por delante o por detrás un instante, y con ella
  // se acababa enseñando el saldo de una empresa bajo el logo de otra.
  const { empresaVisible, empresas } = useEmpresa();
  const empresaDbId = empresaVisible?.dbId ?? null;
  const esMovil = useIsMobile();
  const router = useRouter();

  const [datos, setDatos] = useState<PointsResumen | null>(inicial);
  const [flotantes, setFlotantes] = useState<Flotante[]>([]);
  const [salto, setSalto] = useState(false);
  const [subidaNivel, setSubidaNivel] = useState(false);
  const [ventanaAbierta, setVentanaAbierta] = useState(false);
  const contador = useRef(0);

  const cargar = useCallback(async () => {
    if (!empresaDbId) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const fresco = await getPointsResumen(supabase, user.id, empresaDbId);
      setDatos((previo) => {
        // Subir de nivel es LA recompensa: se celebra con un destello.
        if (
          previo &&
          previo.nivelNombre !== fresco.nivelNombre &&
          fresco.acumulados > previo.acumulados
        ) {
          setSubidaNivel(true);
          window.setTimeout(() => setSubidaNivel(false), 2500);
        }
        return fresco;
      });
    } catch (err) {
      console.error("[PointsPill] no se pudo leer el saldo", err);
    }
  }, [supabase, empresaDbId]);

  // Los points son de CADA empresa, así que el marcador tiene que ser SIEMPRE
  // el de la empresa que el usuario ve arriba. Lo que trae el servidor sirve
  // para el primer pintado, pero si la empresa del selector es otra —pasa al
  // cambiar de empresa, o cuando el navegador rearma su última empresa después
  // de que el servidor ya haya resuelto la suya— se vuelve a pedir. Si no, se
  // quedaba el saldo de una empresa debajo del logo de otra (Iván, 12-sep).
  const empresaDeLosDatos = datos?.empresaId ?? null;
  useEffect(() => {
    if (!empresaDbId) return;
    if (empresaDeLosDatos === empresaDbId) return;
    void cargar();
  }, [empresaDbId, empresaDeLosDatos, cargar]);

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

  const color = datos.nivelColor || COLOR_NIVEL_POR_DEFECTO;
  const pct = Math.min(100, Math.max(0, datos.progresoPct));
  // El nombre que se enseña es el de la empresa CON LA QUE SE CALCULÓ el saldo,
  // no el de la del selector: así el rótulo nunca miente sobre de quién son.
  // Si la lista de empresas aún no ha llegado, no se pone nombre: mejor sin
  // rótulo que con el de otra empresa.
  const nombreEmpresaDeLosDatos =
    empresas.find((e) => e.dbId === datos.empresaId)?.nombre ?? null;

  function abrir() {
    // En el teléfono Points tiene su pantalla; en el ordenador se abre encima
    // para no sacar a nadie de donde estaba trabajando.
    if (esMovil) router.push(href);
    else setVentanaAbierta(true);
  }

  const boton = (
    <button
      type="button"
      onClick={abrir}
      aria-label={`Points: ${datos.saldo}, nivel ${datos.nivelNombre}`}
      className={cn(
        // Mismo alto y mismo aire que la píldora de al lado (empresa + foto):
        // las tres tienen que leerse como una sola fila de pastillas.
        "relative flex h-10 shrink-0 items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-1 pr-3 transition-transform active:scale-95",
        className,
      )}
    >
      <Insignia color={color} icono={datos.nivelIcono} pct={pct} destello={subidaNivel} />

      <span
        className={cn(
          "text-sm font-bold leading-none tabular-nums transition-transform duration-200",
          salto && "scale-125",
        )}
      >
        {datos.saldo}
      </span>

      {/* Ya le llega para un premio: el punto verde es el que pica. */}
      {datos.puedeCanjear && (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background"
        />
      )}

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
    </button>
  );

  return (
    <>
      {esMovil ? (
        boton
      ) : (
        <HoverCard openDelay={120} closeDelay={80}>
          <HoverCardTrigger asChild>{boton}</HoverCardTrigger>
          <HoverCardContent align="end" className="w-80 p-4">
            <Escalera datos={datos} empresa={nombreEmpresaDeLosDatos} />
          </HoverCardContent>
        </HoverCard>
      )}

      <Dialog open={ventanaAbierta} onOpenChange={setVentanaAbierta}>
        <DialogContent className="h-[90vh] max-w-5xl overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 border-b bg-background px-5 py-3">
            <DialogTitle className="text-base">
              Points{nombreEmpresaDeLosDatos ? ` · ${nombreEmpresaDeLosDatos}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">{ventanaAbierta && <ToquesView />}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** La chapa del nivel: su color, su dibujo y el aro de lo que lleva avanzado. */
function Insignia({
  color,
  icono,
  pct,
  destello,
}: {
  color: string;
  icono: string | null;
  pct: number;
  destello?: boolean;
}) {
  const Dibujo = iconoDeNivel(icono);
  const { claro, hondo } = tonosDeInsignia(color);
  return (
    <span
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        destello && "points-nivel-nuevo",
      )}
      style={{
        background: `conic-gradient(from -90deg, ${hondo} ${pct}%, hsl(var(--foreground) / 0.14) ${pct}%)`,
      }}
    >
      <span
        className="flex h-[26px] w-[26px] items-center justify-center rounded-full ring-1 ring-background"
        style={{
          background: `linear-gradient(145deg, ${claro} 0%, ${hondo} 100%)`,
          boxShadow: `0 1px 4px -1px ${hondo}`,
        }}
      >
        <Dibujo className="h-4 w-4 text-white" strokeWidth={2.4} />
      </span>
    </span>
  );
}

/** La escalera de niveles: dónde está y qué le queda por delante. */
function Escalera({ datos, empresa }: { datos: PointsResumen; empresa: string | null }) {
  const pct = Math.min(100, Math.max(0, datos.progresoPct));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <Insignia color={datos.nivelColor} icono={datos.nivelIcono} pct={pct} />
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">{datos.nivelNombre}</div>
          <div className="text-xs text-muted-foreground">
            {datos.acumulados} points ganados · {datos.saldo} para gastar
          </div>
          {/* De qué empresa son: cada una tiene los suyos, y sin decirlo parecía
              un descuadre al cambiar de empresa (Iván, 12-sep). */}
          {empresa && (
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {empresa}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: tonosDeInsignia(datos.nivelColor).hondo,
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {datos.siguienteNombre ? (
            <>
              Te faltan <strong className="text-foreground">{datos.faltan} points</strong> para{" "}
              <strong className="text-foreground">{datos.siguienteNombre}</strong>
            </>
          ) : (
            <span className="font-medium text-amber-700">Has llegado al último nivel</span>
          )}
        </p>
      </div>

      {datos.escalera.length > 0 && (
        <div className="flex items-end justify-between gap-1 border-t pt-3">
          {datos.escalera.map((paso) => {
            const Dibujo = iconoDeNivel(paso.icono);
            const { claro, hondo } = tonosDeInsignia(paso.color);
            return (
              <div key={paso.nombre} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full",
                    paso.actual && "ring-2 ring-offset-1 ring-offset-background",
                  )}
                  style={{
                    background: paso.alcanzado
                      ? `linear-gradient(145deg, ${claro} 0%, ${hondo} 100%)`
                      : "hsl(var(--muted))",
                    ...(paso.actual ? { ["--tw-ring-color" as string]: hondo } : {}),
                  }}
                >
                  <Dibujo
                    className={cn(
                      "h-3.5 w-3.5",
                      paso.alcanzado ? "text-white" : "text-muted-foreground",
                    )}
                    strokeWidth={2.4}
                  />
                </span>
                <span
                  className={cn(
                    "w-full truncate text-center text-[10px] leading-tight",
                    paso.actual ? "font-bold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {paso.nombre}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {datos.puedeCanjear
          ? "Ya tienes points para canjear un premio."
          : "Pulsa para ver cómo ganar más y qué puedes canjear."}
      </p>
    </div>
  );
}
