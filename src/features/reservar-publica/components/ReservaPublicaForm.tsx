"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarCheck, Users, Mail, Phone, Calendar, Clock } from "lucide-react";
import { crearReservaPublicaAction } from "@/features/reservar-publica/actions/crear-reserva-publica";
import { toast } from "sonner";

interface Props {
  empresaSlug: string;
  empresaNombre: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  colorTexto: string | null;
  origen: string | null;
}

function isHexColor(c: string | null | undefined): c is string {
  return !!c && /^#[0-9a-fA-F]{3,8}$/.test(c);
}

export function ReservaPublicaForm({
  empresaSlug,
  empresaNombre,
  logoUrl,
  colorPrimario,
  colorTexto,
  origen,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [hora, setHora] = useState("21:00");
  const [personas, setPersonas] = useState(2);
  const [enviando, startTransition] = useTransition();
  const [exito, setExito] = useState(false);

  const accent = isHexColor(colorPrimario) ? colorPrimario : "#0a0a0a";
  const onAccent = isHexColor(colorTexto) ? colorTexto : "#ffffff";

  const valido = nombre.trim().length > 0 && telefono.trim().length >= 5 && personas > 0 && fecha && hora;

  const styleVars = useMemo(
    () => ({ ["--brand" as string]: accent, ["--brand-fg" as string]: onAccent }) as React.CSSProperties,
    [accent, onAccent],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    startTransition(async () => {
      const r = await crearReservaPublicaAction({
        empresaSlug,
        origen,
        nombre: nombre.trim(),
        apellidos: apellidos.trim() || null,
        telefono: telefono.trim(),
        email: email.trim() || null,
        fecha,
        hora,
        personas,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setExito(true);
    });
  }

  if (exito) {
    return (
      <main
        className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12 bg-gradient-to-b from-zinc-50 to-zinc-100"
        style={styleVars}
      >
        <div className="max-w-md w-full bg-white sm:rounded-2xl sm:shadow-xl sm:border sm:border-zinc-100 p-8 sm:p-10 text-center space-y-5">
          <div
            className="mx-auto h-20 w-20 rounded-full flex items-center justify-center"
            style={{ background: `${accent}15` }}
          >
            <CalendarCheck className="h-10 w-10" style={{ color: accent }} />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">¡Reserva recibida!</h1>
            <p className="text-zinc-600">Te confirmamos en breve por teléfono.</p>
          </div>
          <div className="pt-4 border-t border-zinc-100">
            <p className="text-sm text-zinc-500">Gracias por reservar en</p>
            <p className="text-lg font-semibold mt-1">{empresaNombre}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-[100dvh] bg-white sm:bg-gradient-to-b sm:from-zinc-50 sm:to-zinc-100 sm:py-8 sm:px-6"
      style={styleVars}
    >
      <div className="max-w-md mx-auto pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {/* HERO con logo */}
        <header className="text-center pt-[max(env(safe-area-inset-top),1.5rem)] sm:pt-0 pb-4">
          {logoUrl ? (
            <div className="mx-auto w-32 h-32 sm:w-44 sm:h-44 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={empresaNombre}
                className="max-w-full max-h-full object-contain drop-shadow-sm"
              />
            </div>
          ) : (
            <>
              <div
                className="mx-auto w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl font-black"
                style={{ background: accent, color: onAccent }}
              >
                {empresaNombre.charAt(0).toUpperCase()}
              </div>
              <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
                {empresaNombre}
              </h1>
            </>
          )}
        </header>

        {/* FORM CARD — full-bleed en móvil, card en sm+ */}
        <form
          onSubmit={onSubmit}
          className="bg-white sm:rounded-2xl sm:shadow-xl sm:border sm:border-zinc-100 px-5 sm:px-7 pt-2 pb-6 sm:pt-7 sm:pb-7 space-y-5"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nombre" className="text-zinc-700">Nombre *</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoFocus
                autoComplete="given-name"
                className="mt-1 h-12 sm:h-10 text-base sm:text-sm"
              />
            </div>
            <div>
              <Label htmlFor="apellidos" className="text-zinc-700">Apellidos</Label>
              <Input
                id="apellidos"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                autoComplete="family-name"
                className="mt-1 h-12 sm:h-10 text-base sm:text-sm"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="telefono" className="text-zinc-700 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Teléfono *
            </Label>
            <Input
              id="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
              placeholder="612 345 678"
              className="mt-1 h-12 sm:h-10 text-base sm:text-sm"
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-zinc-700 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="mt-1 h-12 sm:h-10 text-base sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fecha" className="text-zinc-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Fecha *
              </Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                required
                className="mt-1 h-12 sm:h-10 text-base sm:text-sm"
              />
            </div>
            <div>
              <Label htmlFor="hora" className="text-zinc-700 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Hora *
              </Label>
              <Input
                id="hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                required
                className="mt-1 h-12 sm:h-10 text-base sm:text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-zinc-700 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Personas *
            </Label>
            <div className="flex items-center gap-2 mt-1 rounded-lg border bg-zinc-50/50 p-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9 rounded-md hover:bg-white text-xl"
                onClick={() => setPersonas((n) => Math.max(1, n - 1))}
                aria-label="Restar persona"
              >
                <span className="leading-none">−</span>
              </Button>
              <div className="flex-1 flex items-center justify-center gap-2 text-xl font-bold text-zinc-900 tabular-nums">
                {personas}
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  {personas === 1 ? "persona" : "personas"}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9 rounded-md hover:bg-white text-xl"
                onClick={() => setPersonas((n) => Math.min(50, n + 1))}
                aria-label="Sumar persona"
              >
                <span className="leading-none">+</span>
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full font-semibold text-base h-14 sm:h-12 shadow-md hover:shadow-lg transition-shadow mt-2"
            disabled={!valido || enviando}
            style={{ background: accent, color: onAccent }}
          >
            {enviando ? "Enviando..." : "Reservar mesa"}
          </Button>
        </form>

        <footer className="text-center mt-6 text-xs text-zinc-400">
          <p>Reserva sujeta a confirmación · {empresaNombre}</p>
        </footer>
      </div>
    </main>
  );
}
