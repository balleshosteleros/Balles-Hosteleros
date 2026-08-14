"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, User, BookUser, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buscarDestinatarios,
  type Destinatario,
} from "../actions/buscar-destinatarios";
import { direccionesInvalidas } from "../lib/direcciones";

/**
 * Campo "Para" del compositor: autocompleta con los contactos y empleados ya
 * guardados en el software, y avisa EN EL MOMENTO si la dirección está mal
 * escrita, en vez de dejar que Gmail devuelva un error críptico al enviar.
 */

/** Trozo que el usuario está escribiendo ahora (tras la última coma). */
function fragmentoActual(valor: string): string {
  const partes = valor.split(/[,;]/);
  return (partes[partes.length - 1] ?? "").trim();
}

export function CampoDestinatario({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (v: string) => void;
}) {
  const [sugerencias, setSugerencias] = useState<Destinatario[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [tocado, setTocado] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  const fragmento = fragmentoActual(valor);
  // Solo se avisa cuando el campo ya se ha abandonado: marcar en rojo mientras
  // se teclea la primera letra sería ruido.
  const malas = tocado ? direccionesInvalidas(valor) : [];

  // Busca mientras se escribe, con una pausa para no consultar en cada tecla.
  useEffect(() => {
    if (fragmento.length < 2) {
      setSugerencias([]);
      return;
    }
    let vigente = true;
    const t = setTimeout(() => {
      void buscarDestinatarios(fragmento).then((r) => {
        if (!vigente) return;
        setSugerencias(r.data);
        if (r.data.length > 0) setAbierto(true);
      });
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [fragmento]);

  // Cerrar el desplegable al pulsar fuera.
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  /** Sustituye el fragmento en curso por el correo elegido. */
  function elegir(d: Destinatario) {
    const partes = valor.split(/[,;]/);
    partes[partes.length - 1] = ` ${d.email}`;
    onChange(partes.join(",").replace(/^\s*,\s*/, "").trim());
    setSugerencias([]);
    setAbierto(false);
  }

  return (
    <div ref={contenedor} className="relative">
      <Label className="text-[11px]">Para</Label>
      <Input
        // `type="text"`, no `email`: con varios destinatarios separados por coma
        // el validador nativo del navegador marcaría el campo como inválido.
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTocado(true)}
        onFocus={() => sugerencias.length > 0 && setAbierto(true)}
        placeholder="Escribe un nombre o correo"
        aria-invalid={malas.length > 0}
        className={`mt-1 ${malas.length > 0 ? "border-destructive focus-visible:ring-destructive" : ""}`}
      />

      {malas.length > 0 ? (
        <p className="mt-1 flex items-start gap-1 text-[11px] text-destructive">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" />
          <span>
            &quot;{malas[0]}&quot; no es una dirección válida. Comprueba que el dominio
            esté completo (por ejemplo, <span className="font-mono">gmail.com</span>).
          </span>
        </p>
      ) : null}

      {abierto && sugerencias.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {sugerencias.map((d) => (
            <li key={`${d.origen}-${d.email}`}>
              <button
                type="button"
                onClick={() => elegir(d)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
              >
                {d.origen === "Empleado" ? (
                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : d.origen === "Gmail" ? (
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <BookUser className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{d.nombre}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {d.email}
                    {d.detalle ? ` · ${d.detalle}` : ""}
                  </span>
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {d.origen}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
