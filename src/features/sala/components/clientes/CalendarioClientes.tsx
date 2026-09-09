"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { CalendarioMes, diasDelMes, nombreMes } from "./CalendarioMes";
import {
  calendarioCumpleanos,
  calendarioVisitas,
  visitantesDelDia,
  type CumpleanosCliente,
  type DiaVisitas,
  type VisitanteDia,
} from "@/features/sala/actions/clientes-calendario-actions";
import { hoyEnZona } from "@/features/empresa/lib/zona-horaria";
import { friendlyError } from "@/shared/lib/friendly-errors";
import { toast } from "sonner";

/**
 * Los dos calendarios de la clientela, uno al lado del otro.
 *
 * CUMPLEAÑOS: qué días del año cumple más gente. Se carga entero una vez —una
 * fecha de nacimiento no cambia al pasar de mes— y navegar es instantáneo.
 *
 * VISITAS: cuántos clientes distintos vinieron cada día. Se pide por mes,
 * porque la historia son decenas de miles de reservas.
 *
 * El color del mapa de calor es el de la EMPRESA activa, igual que el resto de
 * controles del software.
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

/** "AAAA-MM-DD" del día `d` del mes que se está mirando. */
function claveDia(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
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

  const [tab, setTab] = useState<"cumpleanos" | "visitas">("cumpleanos");
  const [anio, setAnio] = useState(anioHoy);
  const [mes, setMes] = useState(mesHoy);
  const [diaSel, setDiaSel] = useState<number | null>(null);

  const [cumples, setCumples] = useState<Record<string, CumpleanosCliente[]>>({});
  const [totalConFecha, setTotalConFecha] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [cargandoCumples, setCargandoCumples] = useState(false);

  const [visitas, setVisitas] = useState<Record<string, DiaVisitas>>({});
  const [cargandoVisitas, setCargandoVisitas] = useState(false);

  const [detalleVisitas, setDetalleVisitas] = useState<VisitanteDia[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  /**
   * Los cumpleaños se piden UNA sola vez: son los mismos en enero que en
   * agosto, así que volver a pedirlos al cambiar de mes sería trabajo tirado.
   *
   * La marca va en una ref y no en un estado: mirando si ya hay datos, una
   * empresa sin clientes (o un fallo de red) volvería a pedirlos en cada
   * render, en bucle y para siempre.
   */
  const cumplesPedidos = useRef(false);
  useEffect(() => {
    if (!abierto || cumplesPedidos.current) return;
    cumplesPedidos.current = true;
    let vivo = true;
    setCargandoCumples(true);
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
      .finally(() => vivo && setCargandoCumples(false));
    return () => {
      vivo = false;
    };
  }, [abierto]);

  // Las visitas sí se piden mes a mes, y solo con esa pestaña delante.
  useEffect(() => {
    if (!abierto || tab !== "visitas") return;
    let vivo = true;
    setCargandoVisitas(true);
    const desde = claveDia(anio, mes, 1);
    const hasta = claveDia(anio, mes, diasDelMes(anio, mes));
    calendarioVisitas(desde, hasta)
      .then((res) => {
        if (!vivo) return;
        if (!res.ok) {
          toast.error("No se han podido cargar las visitas", { description: res.error });
          return;
        }
        setVisitas(res.dias);
      })
      .catch((err) =>
        toast.error("No se han podido cargar las visitas", {
          description: friendlyError(err, "CalendarioClientes"),
        }),
      )
      .finally(() => vivo && setCargandoVisitas(false));
    return () => {
      vivo = false;
    };
  }, [abierto, tab, anio, mes]);

  /**
   * El día abierto pertenece al mes que se estaba mirando: al cambiar de mes o
   * de pestaña deja de tener sentido y se cierra.
   */
  const cerrarDia = useCallback(() => {
    setDiaSel(null);
    setDetalleVisitas([]);
  }, []);

  const irMes = useCallback((paso: number) => {
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
  }, [cerrarDia]);

  const volverAHoy = useCallback(() => {
    cerrarDia();
    setAnio(anioHoy);
    setMes(mesHoy);
  }, [anioHoy, mesHoy, cerrarDia]);

  const valoresCumples = useMemo(() => {
    const out: Record<number, number> = {};
    const total = diasDelMes(anio, mes);
    for (let d = 1; d <= total; d++) {
      const clave = `${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const n = cumples[clave]?.length ?? 0;
      if (n > 0) out[d] = n;
    }
    return out;
  }, [cumples, anio, mes]);

  const valoresVisitas = useMemo(() => {
    const out: Record<number, number> = {};
    const total = diasDelMes(anio, mes);
    for (let d = 1; d <= total; d++) {
      const n = visitas[claveDia(anio, mes, d)]?.clientes ?? 0;
      if (n > 0) out[d] = n;
    }
    return out;
  }, [visitas, anio, mes]);

  const sumaMes = (valores: Record<number, number>) =>
    Object.values(valores).reduce((a, b) => a + b, 0);

  const abrirDiaVisitas = useCallback(
    (dia: number) => {
      setDiaSel(dia);
      setCargandoDetalle(true);
      setDetalleVisitas([]);
      visitantesDelDia(claveDia(anio, mes, dia))
        .then((res) => {
          if (res.ok) setDetalleVisitas(res.data);
          else toast.error("No se ha podido abrir el día", { description: res.error });
        })
        .catch((err) =>
          toast.error("No se ha podido abrir el día", {
            description: friendlyError(err, "CalendarioClientes"),
          }),
        )
        .finally(() => setCargandoDetalle(false));
    },
    [anio, mes],
  );

  const cumplesDelDia: CumpleanosCliente[] =
    diaSel !== null
      ? cumples[`${String(mes).padStart(2, "0")}-${String(diaSel).padStart(2, "0")}`] ?? []
      : [];

  const botonHoy =
    anio === anioHoy && mes === mesHoy ? null : (
      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={volverAHoy}>
        Hoy
      </Button>
    );

  const cabeceraDia = (dia: number) => `${dia} de ${nombreMes(mes)}`;

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calendario de clientes</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            cerrarDia();
            setTab(v as typeof tab);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cumpleanos">Cumpleaños</TabsTrigger>
            <TabsTrigger value="visitas">Visitas</TabsTrigger>
          </TabsList>

          <TabsContent value="cumpleanos" className="space-y-4 pt-4">
            {cargandoCumples ? (
              <LoadingSpinner className="py-16" />
            ) : (
              <>
                <CalendarioMes
                  anio={anio}
                  mes={mes}
                  valores={valoresCumples}
                  color={color}
                  hoy={mes === mesHoy ? diaHoy : null}
                  seleccionado={diaSel}
                  onSeleccionar={setDiaSel}
                  onMesAnterior={() => irMes(-1)}
                  onMesSiguiente={() => irMes(1)}
                  mostrarAnio={false}
                  extraCabecera={botonHoy}
                  leyenda={`${sumaMes(valoresCumples)} en ${nombreMes(mes)}`}
                />
                <p className="text-xs text-muted-foreground">
                  Se sabe la fecha de nacimiento de {totalConFecha} de {totalClientes}{" "}
                  clientes. Quien no la dio no aparece en ningún día.
                </p>
                {diaSel !== null && (
                  <DetalleDia
                    titulo={`${cabeceraDia(diaSel)} · ${cumplesDelDia.length} ${
                      cumplesDelDia.length === 1 ? "persona" : "personas"
                    }`}
                    onCerrar={cerrarDia}
                  >
                    {cumplesDelDia.map((c) => (
                      <FilaPersona
                        key={c.id}
                        nombre={c.nombre}
                        telefono={c.telefono}
                        detalle={c.anio ? `Cumple ${anio - c.anio}` : ""}
                        onAbrir={() => onAbrirCliente(c.id)}
                      />
                    ))}
                  </DetalleDia>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="visitas" className="space-y-4 pt-4">
            {cargandoVisitas ? (
              <LoadingSpinner className="py-16" />
            ) : (
              <>
                <CalendarioMes
                  anio={anio}
                  mes={mes}
                  valores={valoresVisitas}
                  color={color}
                  hoy={anio === anioHoy && mes === mesHoy ? diaHoy : null}
                  seleccionado={diaSel}
                  onSeleccionar={abrirDiaVisitas}
                  onMesAnterior={() => irMes(-1)}
                  onMesSiguiente={() => irMes(1)}
                  extraCabecera={botonHoy}
                  leyenda={`${sumaMes(valoresVisitas)} visitas en ${nombreMes(mes)}`}
                />
                <p className="text-xs text-muted-foreground">
                  Cada día cuenta los clientes distintos que vinieron, contando sus
                  reservas. Las canceladas y los no show no cuentan.
                </p>
                {diaSel !== null && (
                  <DetalleDia
                    titulo={`${cabeceraDia(diaSel)} · ${detalleVisitas.length} ${
                      detalleVisitas.length === 1 ? "cliente" : "clientes"
                    }`}
                    onCerrar={cerrarDia}
                  >
                    {cargandoDetalle ? (
                      <LoadingSpinner className="py-6" size="sm" />
                    ) : (
                      detalleVisitas.map((v) => (
                        <FilaPersona
                          key={v.clienteId}
                          nombre={v.nombre}
                          telefono={v.telefono}
                          detalle={`${v.personas} ${v.personas === 1 ? "persona" : "personas"}${
                            v.reservas > 1 ? ` · ${v.reservas} reservas` : ""
                          }`}
                          onAbrir={() => onAbrirCliente(v.clienteId)}
                        />
                      ))
                    )}
                  </DetalleDia>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function DetalleDia({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">{titulo}</span>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>
      <div className="max-h-64 divide-y overflow-y-auto">{children}</div>
    </div>
  );
}

function FilaPersona({
  nombre,
  telefono,
  detalle,
  onAbrir,
}: {
  nombre: string;
  telefono: string;
  detalle: string;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/40"
    >
      <span className="min-w-0 flex-1 truncate">
        {nombre || <span className="text-muted-foreground">Sin nombre</span>}
        {telefono && (
          <span className="ml-2 text-xs text-muted-foreground">{telefono}</span>
        )}
      </span>
      {detalle && (
        <span className="shrink-0 text-xs text-muted-foreground">{detalle}</span>
      )}
    </button>
  );
}
