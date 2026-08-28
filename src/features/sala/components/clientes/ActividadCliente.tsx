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
  listClienteActividad,
  type ClienteActividad,
} from "@/features/sala/actions/cliente-historial-actions";

/** Cómo se llama cada dato en sala, no en la base de datos. */
const CAMPO_LABEL: Record<string, string> = {
  nombre: "Nombre",
  apellidos: "Apellidos",
  email: "Email",
  telefono: "Teléfono",
};

/**
 * Datos por los que salen los avisos. Cambiarlos tiene consecuencias fuera de
 * la ficha —los correos ya enviados fueron a la dirección vieja—, así que la
 * línea se marca y se explica.
 */
const CAMPOS_AVISO = new Set(["email", "telefono"]);

/** Quién lo hizo. Si no hay persona, de dónde vino el cambio. */
function autor(a: ClienteActividad): string {
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
 * Actividad del CLIENTE: cada cambio de sus datos de contacto, con quién lo
 * hizo y cuándo. Es una sola, la misma se edite desde su ficha o desde
 * cualquiera de sus reservas.
 *
 * No confundir con la actividad de la RESERVA (`ActividadReserva`), que
 * registra lo que le pasa a una reserva concreta —mesa, hora, estado— y cambia
 * al abrir otra reserva del mismo cliente. Aquí no: el cliente es uno.
 *
 * Solo lectura: es un registro histórico y no se puede modificar.
 */
export function ActividadCliente({ clienteId }: { clienteId: string }) {
  const { empresaActual } = useEmpresa();
  // Se guarda de qué cliente son los datos que hay en mano, para deducir
  // "cargando" sin resetear estado en cada cambio.
  const [cargado, setCargado] = useState<{
    clienteId: string;
    filas: ClienteActividad[];
  } | null>(null);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vigente = true;
    listClienteActividad(clienteId).then((res) => {
      if (!vigente) return;
      setCargado({ clienteId, filas: res.data });
    });
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  const cargando = cargado?.clienteId !== clienteId;
  const filas = cargando ? [] : (cargado?.filas ?? []);
  const tz = empresaActual?.zonaHoraria;

  return (
    <Collapsible open={abierto} onOpenChange={setAbierto} className="space-y-2">
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <History className="h-3.5 w-3.5 shrink-0" />
        <span>Actividad del cliente</span>
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
            Todavía no se han cambiado los datos de este cliente.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {filas.map((a) => {
              const avisa = CAMPOS_AVISO.has(a.campo);
              return (
                <li
                  key={a.id}
                  className={cn(
                    "rounded-md border px-2.5 py-2 text-xs",
                    avisa
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-border/60 bg-muted/30",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="font-medium text-foreground">
                      {CAMPO_LABEL[a.campo] ?? a.campo}
                    </span>
                    <span className="text-muted-foreground">
                      {tz ? formatFechaHoraEnZona(a.createdAt, tz) : "—"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-muted-foreground">
                    <span className="line-through break-all">
                      {a.valorAnterior || "vacío"}
                    </span>
                    {" → "}
                    <span className="font-medium text-foreground break-all">
                      {a.valorNuevo || "vacío"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-muted-foreground">{autor(a)}</div>
                  {/* Lo que de verdad importa saber después: hasta esta fecha,
                      los avisos salieron al dato viejo. */}
                  {avisa && (
                    <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
                      {a.campo === "email"
                        ? "Los correos anteriores a esta fecha se enviaron al email antiguo. Los próximos saldrán al nuevo."
                        : "Las llamadas y avisos anteriores a esta fecha fueron al número antiguo."}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
