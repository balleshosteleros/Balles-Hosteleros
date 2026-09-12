"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { CalendarioMes, diasDelMes, nombreMes } from "./CalendarioMes";
import {
  calendarioCumpleanos,
  type CumpleanosCliente,
} from "@/features/sala/actions/clientes-calendario-actions";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { toast } from "sonner";

/**
 * El calendario de CUMPLEAÑOS de la clientela.
 *
 * Qué días del año cumple más gente, pintado como mapa de calor con el color
 * de la EMPRESA activa: cuanta más gente cumple ese día, más fuerte el color.
 * La escala es relativa al mes que se mira, para que un mes flojo también se
 * lea en vez de salir entero en blanco.
 *
 * Se carga entero de una vez —una fecha de nacimiento no cambia al pasar de
 * mes— y por eso navegar entre meses es instantáneo.
 */

interface CalendarioClientesProps {
  abierto: boolean;
  onClose: () => void;
  /** Color de la empresa activa. */
  color: string;
  /** Zona de la empresa: "hoy" es el día del restaurante, no el del navegador. */
  zonaHoraria: string;
  /** Abre la ficha de esa persona (cierra el calendario). */
  onAbrirCliente: (clienteId: string) => void;
}

export function CalendarioClientes({
  abierto,
  onClose,
  color,
  zonaHoraria,
  onAbrirCliente,
}: CalendarioClientesProps) {
  const hoy = hoyEnZona(zonaHoraria);
  const [anioHoy, mesHoy, diaHoy] = hoy.split("-").map(Number);

  const [anio, setAnio] = useState(anioHoy);
  const [mes, setMes] = useState(mesHoy);
  const [diaSel, setDiaSel] = useState<number | null>(null);

  const [cumples, setCumples] = useState<Record<string, CumpleanosCliente[]>>({});
  const [totalConFecha, setTotalConFecha] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [cargando, setCargando] = useState(false);

  /**
   * Se piden UNA sola vez: son los mismos en enero que en agosto, así que
   * volver a pedirlos al cambiar de mes sería trabajo tirado.
   *
   * La marca va en una ref y no en un estado: mirando si ya hay datos, una
   * empresa sin clientes (o un fallo de red) volvería a pedirlos en cada
   * render, en bucle y para siempre.
   */
  const yaPedidos = useRef(false);
  useEffect(() => {
    if (!abierto || yaPedidos.current) return;
    yaPedidos.current = true;
    let vivo = true;
    setCargando(true);
    calendarioCumpleanos()
      .then((res) => {
        if (!vivo) return;
        if (!res.ok) {
          toast.error("No se han podido cargar los cumpleaños", {
            description: res.error,
          });
          return;
        }
        setCumples(res.dias);
        setTotalConFecha(res.total);
        setTotalClientes(res.totalClientes);
      })
      .catch((err) =>
        toast.error("No se han podido cargar los cumpleaños", {
          description: friendlyError(err, "CalendarioClientes"),
        }),
      )
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [abierto]);

  /**
   * El día abierto pertenece al mes que se estaba mirando: al cambiar de mes
   * deja de tener sentido y se cierra.
   */
  const cerrarDia = useCallback(() => setDiaSel(null), []);

  const irMes = useCallback(
    (paso: number) => {
      cerrarDia();
      setMes((m) => {
        const total = m + paso;
        if (total < 1) {
          setAnio((a) => a - 1);
          return 12;
        }
        if (total > 12) {
          setAnio((a) => a + 1);
          return 1;
        }
        return total;
      });
    },
    [cerrarDia],
  );

  const volverAHoy = useCallback(() => {
    cerrarDia();
    setAnio(anioHoy);
    setMes(mesHoy);
  }, [anioHoy, mesHoy, cerrarDia]);

  const valores = useMemo(() => {
    const out: Record<number, number> = {};
    const total = diasDelMes(anio, mes);
    for (let d = 1; d <= total; d++) {
      const clave = `${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const n = cumples[clave]?.length ?? 0;
      if (n > 0) out[d] = n;
    }
    return out;
  }, [cumples, anio, mes]);

  const enElMes = Object.values(valores).reduce((a, b) => a + b, 0);

  const cumplesDelDia: CumpleanosCliente[] =
    diaSel !== null
      ? cumples[`${String(mes).padStart(2, "0")}-${String(diaSel).padStart(2, "0")}`] ?? []
      : [];

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calendario de cumpleaños</DialogTitle>
        </DialogHeader>

        {cargando ? (
          <LoadingSpinner className="py-16" />
        ) : (
          <div className="space-y-4">
            <CalendarioMes
              anio={anio}
              mes={mes}
              valores={valores}
              color={color}
              hoy={mes === mesHoy ? diaHoy : null}
              seleccionado={diaSel}
              onSeleccionar={setDiaSel}
              onMesAnterior={() => irMes(-1)}
              onMesSiguiente={() => irMes(1)}
              mostrarAnio={false}
              extraCabecera={
                anio === anioHoy && mes === mesHoy ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={volverAHoy}
                  >
                    Hoy
                  </Button>
                )
              }
              leyenda={`${enElMes} en ${nombreMes(mes)}`}
            />
            <p className="text-xs text-muted-foreground">
              Se sabe la fecha de nacimiento de {totalConFecha} de {totalClientes}{" "}
              clientes. Quien no la dio no aparece en ningún día.
            </p>
            {diaSel !== null && (
              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="text-sm font-medium">
                    {diaSel} de {nombreMes(mes)} · {cumplesDelDia.length}{" "}
                    {cumplesDelDia.length === 1 ? "persona" : "personas"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={cerrarDia}
                  >
                    Cerrar
                  </Button>
                </div>
                <div className="max-h-64 divide-y overflow-y-auto">
                  {cumplesDelDia.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onAbrirCliente(c.id)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {c.nombre || (
                          <span className="text-muted-foreground">Sin nombre</span>
                        )}
                        {c.telefono && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {c.telefono}
                          </span>
                        )}
                      </span>
                      {c.anio && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Cumple {anio - c.anio}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
