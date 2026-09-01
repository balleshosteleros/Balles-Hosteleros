"use client";

import { useEffect, useState } from "react";
import { ChevronDown, History } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import {
  listReservaActividad,
  type ReservaActividad,
} from "@/features/sala/actions/reserva-historial-actions";
import {
  ESTADO_RESERVA_LABELS,
  formatearDuracionReserva,
  type EstadoReserva,
} from "@/features/sala/data/reservas";

/** Cómo se llama cada campo en sala, no en la base de datos. */
const CAMPO_LABEL: Record<string, string> = {
  estado: "Estado",
  mesa: "Mesa",
  zona: "Zona",
  personas: "Comensales",
  fecha: "Fecha",
  hora: "Hora",
  turno: "Turno",
  duracion_minutos: "Tiempo de mesa",
  notas: "Comentarios",
  bloqueada: "Bloqueada",
  vinculacion: "Vinculación de cliente",
};

/**
 * El valor tal y como se lee en pantalla. Los estados y el tiempo de mesa se
 * guardan en crudo (`NO_RECONFIRMADA`, `90`) y así no se entienden.
 */
function valorLegible(campo: string, valor: string | null): string {
  if (valor === null || valor === "") return "vacío";
  switch (campo) {
    case "estado":
      return ESTADO_RESERVA_LABELS[valor as EstadoReserva] ?? valor;
    case "turno":
      return valor === "CENA" ? "Cena" : "Comida";
    case "duracion_minutos": {
      const n = Number(valor);
      return Number.isFinite(n) ? formatearDuracionReserva(n) : valor;
    }
    case "hora":
      return valor.slice(0, 5);
    case "bloqueada":
      return valor === "true" ? "Sí" : "No";
    default:
      return valor;
  }
}

/** Códigos de mesa de un valor de historial ("M1+M2" → ["M1","M2"]). */
function mesasDeValor(valor: string | null): string[] {
  return (valor ?? "")
    .split("+")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Qué mesas entraron y cuáles salieron en un cambio de mesa.
 *
 * Una reserva que pasa de "M1" a "M1+M2" en el historial se lee como un
 * cambio de texto, y en sala la pregunta es siempre otra: qué mesa se ha
 * añadido y cuál se ha quitado. Devuelve null cuando el cambio no se explica
 * mejor así (un desplazamiento limpio de una mesa a otra, sin nada en común),
 * y entonces se pinta el tachado normal.
 */
function cambioDeMesas(
  anterior: string | null,
  nuevo: string | null,
): { anadidas: string[]; quitadas: string[] } | null {
  const antes = mesasDeValor(anterior);
  const despues = mesasDeValor(nuevo);
  const anadidas = despues.filter((m) => !antes.includes(m));
  const quitadas = antes.filter((m) => !despues.includes(m));
  // Sin nada en común es una mudanza, no una unión: "M1 → M4" se entiende
  // mejor tal cual que como "quitada M1, añadida M4".
  const comunes = antes.filter((m) => despues.includes(m));
  if (comunes.length === 0) return null;
  if (anadidas.length === 0 && quitadas.length === 0) return null;
  return { anadidas, quitadas };
}

/** Quién lo hizo. Si no hay persona, de dónde vino el cambio. */
function autor(a: ReservaActividad): string {
  if (a.usuarioNombre) return a.usuarioNombre;
  switch (a.origen) {
    case "AUTOMATICO":
      return "Proceso automático";
    case "PORTAL_PUBLICO":
      return "El cliente, desde la web";
    case "GOOGLE_RWG":
      return "Reserva desde Google";
    default:
      return "Sin registrar";
  }
}

/**
 * Actividad de ESTA reserva: cada cambio de estado, de mesa, de hora o de
 * comensales, con quién lo hizo y cuándo. Al abrir otra reserva del mismo
 * cliente se ve la actividad de esa otra reserva, no la de esta.
 *
 * Los cambios de los DATOS DEL CLIENTE (email, teléfono, nombre) no salen aquí:
 * no le pasan a la reserva, le pasan a la persona, y van en `ActividadCliente`.
 *
 * Solo se lee: es un registro histórico y no se puede modificar.
 */
export function ActividadReserva({ reservaId }: { reservaId: string }) {
  const { empresaActual } = useEmpresa();
  // Igual que en Comunicaciones: se guarda de qué reserva son los datos que
  // hay en mano, para deducir "cargando" sin resetear estado en cada cambio.
  const [cargado, setCargado] = useState<{
    reservaId: string;
    filas: ReservaActividad[];
  } | null>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vigente = true;
    listReservaActividad(reservaId).then((res) => {
      if (!vigente) return;
      setCargado({ reservaId, filas: res.data });
    });
    return () => {
      vigente = false;
    };
  }, [reservaId]);

  const cargando = cargado?.reservaId !== reservaId;
  const filas = cargando ? [] : (cargado?.filas ?? []);
  const tz = empresaActual?.zonaHoraria;

  return (
    <Collapsible open={abierto} onOpenChange={setAbierto} className="space-y-2">
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <History className="h-3.5 w-3.5 shrink-0" />
        <span>Actividad de la reserva</span>
        {!cargando && filas.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {filas.length}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 shrink-0 transition-transform",
            abierto && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-2">
        {cargando ? (
          <p className="text-xs text-muted-foreground">Cargando…</p>
        ) : filas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no se ha cambiado nada de esta reserva.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filas.map((a) => (
              <li
                key={a.id}
                className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-medium text-foreground">
                    {CAMPO_LABEL[a.campo] ?? a.campo}
                  </span>
                  <span className="text-muted-foreground">
                    {tz ? formatFechaHoraEnZona(a.createdAt, tz) : "—"}
                  </span>
                </div>
                {/* La vinculación no es un cambio de valor sino una nota de lo
                    que decidió el restaurante: se lee entera, sin tachado. */}
                {a.campo === "vinculacion" ? (
                  <div className="mt-0.5 text-foreground">{a.valorNuevo}</div>
                ) : (
                  (() => {
                    // Añadir o quitar mesas a una reserva se cuenta con esas
                    // palabras; el resto de campos, con el tachado de siempre.
                    const mesas =
                      a.campo === "mesa"
                        ? cambioDeMesas(a.valorAnterior, a.valorNuevo)
                        : null;
                    if (!mesas) {
                      return (
                        <div className="mt-0.5 text-muted-foreground">
                          <span className="line-through">
                            {valorLegible(a.campo, a.valorAnterior)}
                          </span>
                          {" → "}
                          <span className="font-medium text-foreground">
                            {valorLegible(a.campo, a.valorNuevo)}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-0.5 space-y-0.5 text-muted-foreground">
                        {mesas.anadidas.length > 0 && (
                          <div>
                            Se {mesas.anadidas.length === 1 ? "añadió" : "añadieron"}{" "}
                            {mesas.anadidas.length === 1 ? "la mesa" : "las mesas"}{" "}
                            <span className="font-medium text-foreground">
                              {mesas.anadidas.join(", ")}
                            </span>
                          </div>
                        )}
                        {mesas.quitadas.length > 0 && (
                          <div>
                            Se {mesas.quitadas.length === 1 ? "quitó" : "quitaron"}{" "}
                            {mesas.quitadas.length === 1 ? "la mesa" : "las mesas"}{" "}
                            <span className="font-medium text-foreground">
                              {mesas.quitadas.join(", ")}
                            </span>
                          </div>
                        )}
                        <div className="text-[11px]">
                          {valorLegible(a.campo, a.valorAnterior)} →{" "}
                          <span className="font-medium text-foreground">
                            {valorLegible(a.campo, a.valorNuevo)}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                )}
                <div className="mt-0.5 text-muted-foreground">{autor(a)}</div>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
