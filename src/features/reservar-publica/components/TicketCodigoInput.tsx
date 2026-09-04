"use client";

/**
 * Campo donde el cliente introduce el código del Ticket que compró.
 *
 * Valida contra el servidor mientras escribe y, cuando el código es bueno,
 * enseña qué compró y con qué condiciones puede usarlo. El objetivo es que se
 * entere ANTES de elegir día: es mejor leer "solo cenas" que elegir una comida
 * y que se la rechacen.
 */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Ticket, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  validarTicketPublicoAction,
  type TicketPublico,
} from "@/features/reservar-publica/actions/validar-ticket-publico";

const CODIGO_REGEX = /^[A-Z0-9]{6}$/;

interface Props {
  empresaSlug: string;
  value: string;
  onChange: (v: string) => void;
  /** El padre recibe el ticket válido, o null cuando deja de serlo. */
  onResult: (t: TicketPublico | null) => void;
  /** Cambia al cambiar fecha/hora/zona: obliga a revalidar las condiciones. */
  contextoSerial?: string;
  fecha?: string | null;
  hora?: string | null;
  grupoZonaId?: string | null;
  disabled?: boolean;
  accent: string;
}

type EstadoUI =
  | { kind: "idle" }
  | { kind: "validando" }
  | { kind: "ok"; ticket: TicketPublico }
  | { kind: "error"; mensaje: string };

function euros(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/**
 * Motivos que NO invalidan el código: es bueno, pero el día, la hora o la zona
 * elegidos no entran en su experiencia. Se avisan donde se comete el error, no
 * en el campo del código.
 */
const MOTIVOS_DE_CONTEXTO = [
  "DIA_NO_PERMITIDO",
  "FECHA_EXCLUIDA",
  "TURNO_NO_PERMITIDO",
  "HORA_NO_PERMITIDA",
  "ZONA_NO_PERMITIDA",
] as const as readonly string[];

export function TicketCodigoInput({
  empresaSlug, value, onChange, onResult, contextoSerial,
  fecha, hora, grupoZonaId, disabled = false, accent,
}: Props) {
  const [estado, setEstado] = useState<EstadoUI>({ kind: "idle" });

  // Guarda el callback en una referencia para que el efecto no se reejecute
  // cada vez que el padre se vuelve a pintar.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // El contexto (fecha, hora, zona) se lee de una referencia, NO de las
  // dependencias del efecto: la hora se rellena sola cuando cargan los horarios
  // y, si dependiera de ella, cada cambio cancelaría la validación en curso y
  // el campo se quedaría girando para siempre sin llegar a validar nunca.
  const ctxRef = useRef({ fecha, hora, grupoZonaId });
  ctxRef.current = { fecha, hora, grupoZonaId };

  useEffect(() => {
    const norm = value.trim().toUpperCase();
    if (!norm) {
      setEstado({ kind: "idle" });
      onResultRef.current(null);
      return;
    }
    // Mientras no tenga los 6 caracteres no se le dice que está mal: aún está
    // escribiendo, y un error rojo a la segunda letra es desagradable.
    if (!CODIGO_REGEX.test(norm)) {
      setEstado({ kind: "idle" });
      onResultRef.current(null);
      return;
    }

    let cancelado = false;
    setEstado({ kind: "validando" });

    const t = setTimeout(async () => {
      const ctx = ctxRef.current;
      const r = await validarTicketPublicoAction({
        empresaSlug,
        codigo: norm,
        fecha: ctx.fecha ?? null,
        hora: ctx.hora ?? null,
        grupoZonaId: ctx.grupoZonaId ?? null,
      });
      if (cancelado) return;

      if (r.ok) {
        setEstado({ kind: "ok", ticket: r.ticket });
        onResultRef.current(r.ticket);
      } else if (MOTIVOS_DE_CONTEXTO.includes(r.motivo) && r.ticket) {
        // El código es BUENO: lo que no encaja es el día, la hora o la zona
        // que ha elegido. Se le avisa donde cometió el error —bajo la fecha o
        // el selector— y aquí no se le marca nada, que si no lee "código no
        // válido" y cree que compró mal.
        //
        // El ticket se mantiene, además, para que sus condiciones sigan
        // filtrando horas y zonas mientras corrige.
        setEstado({ kind: "ok", ticket: r.ticket });
        onResultRef.current(r.ticket);
      } else {
        setEstado({ kind: "error", mensaje: r.mensaje });
        onResultRef.current(null);
      }
    }, 300);

    return () => { cancelado = true; clearTimeout(t); };
    // `contextoSerial` lo controla el padre: cambia cuando el cliente ELIGE otra
    // fecha u hora, no cuando el formulario las rellena solo al cargar.
  }, [value, empresaSlug, contextoSerial]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Ticket className="h-4 w-4 text-zinc-500" />
        <Label htmlFor="ticket-codigo" className="text-zinc-700">
          Código de tu ticket
        </Label>
      </div>

      <div className="relative">
        <Input
          id="ticket-codigo"
          value={value}
          disabled={disabled}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="AB3K9P"
          onChange={(e) =>
            onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
          }
          className="pr-10 font-mono tracking-[0.3em] uppercase"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {estado.kind === "validando" && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
          {estado.kind === "ok" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          {estado.kind === "error" && <XCircle className="h-4 w-4 text-red-600" />}
        </span>
      </div>

      {estado.kind === "error" && (
        <p className="text-xs text-red-700">{estado.mensaje}</p>
      )}

      {estado.kind === "ok" && (
        <div
          className="rounded-xl border p-3"
          style={{ borderColor: accent, background: `${accent}0d` }}
        >
          <p className="text-sm font-medium text-zinc-900">{estado.ticket.producto}</p>
          <p className="mt-0.5 text-xs text-zinc-600">
            {estado.ticket.porPersona
              ? `${estado.ticket.unidades} ${estado.ticket.unidades === 1 ? "persona" : "personas"} · ${euros(estado.ticket.importeTotal)} pagados`
              : `${euros(estado.ticket.importeTotal)} pagados`}
          </p>

          {estado.ticket.resumen.length > 0 && (
            <ul className="mt-2 space-y-0.5 border-t pt-2 text-[11px] text-zinc-600">
              {estado.ticket.resumen.map((linea) => (
                <li key={linea}>· {linea}</li>
              ))}
            </ul>
          )}

          {estado.ticket.porPersona && (
            <p className="mt-2 text-[11px] text-zinc-500">
              La reserva se hará para {estado.ticket.unidades}{" "}
              {estado.ticket.unidades === 1 ? "persona" : "personas"}, que es lo que pagaste.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
