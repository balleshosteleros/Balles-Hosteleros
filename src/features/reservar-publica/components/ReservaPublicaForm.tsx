"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarCheck, Users, Mail, Phone, Calendar, Clock, Ticket, Info } from "lucide-react";
import { crearReservaPublicaAction } from "@/features/reservar-publica/actions/crear-reserva-publica";
import { comprobarClientePublicoAction } from "@/features/reservar-publica/actions/comprobar-cliente-publico";
import { validarCuponPublicoAction } from "@/features/reservar-publica/actions/validar-cupon-publico-action";
import { CuponInputReserva } from "@/features/sala/cupones/components/CuponInputReserva";
import { TicketSelector, type ProductoTicketPublico } from "@/features/reservar-publica/components/TicketSelector";
import { toast } from "sonner";

interface AvisoDatosOriginales {
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
}

interface MatchCliente {
  nombre: string;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
  matchPor: "email" | "telefono";
}

interface Props {
  empresaSlug: string;
  empresaNombre: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  colorTexto: string | null;
  origen: string | null;
  productosTicket?: ProductoTicketPublico[];
  ticketOnly?: boolean;
  /** Si es true, oculta el header con logo (modo iframe / embed). */
  embedded?: boolean;
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
  productosTicket = [],
  ticketOnly = false,
  embedded = false,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [hora, setHora] = useState("21:00");
  const [personas, setPersonas] = useState(2);
  const [codigo, setCodigo] = useState("");
  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [cuponValido, setCuponValido] = useState<boolean | null>(null);
  const [ticketProductoId, setTicketProductoId] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  const [exito, setExito] = useState(false);
  const [avisoDatos, setAvisoDatos] = useState<AvisoDatosOriginales | null>(null);
  const [match, setMatch] = useState<MatchCliente | null>(null);
  const [cuponAplicado, setCuponAplicado] = useState<{ codigo: string; tituloCliente: string } | null>(null);

  const accent = isHexColor(colorPrimario) ? colorPrimario : "#0a0a0a";
  const onAccent = isHexColor(colorTexto) ? colorTexto : "#ffffff";

  const ticketObligatorio = ticketOnly && productosTicket.length > 0;
  const ticketValido = !ticketObligatorio || Boolean(ticketProductoId);
  const turnoPorHora = useMemo<"COMIDA" | "CENA" | null>(() => {
    if (!hora) return null;
    const h = Number(hora.slice(0, 2));
    if (Number.isNaN(h)) return null;
    if (h < 17) return "COMIDA";
    return "CENA";
  }, [hora]);
  const valido =
    nombre.trim().length > 0 &&
    telefono.trim().length >= 5 &&
    personas > 0 &&
    fecha &&
    hora &&
    ticketValido &&
    cuponValido !== false;

  const styleVars = useMemo(
    () => ({ ["--brand" as string]: accent, ["--brand-fg" as string]: onAccent }) as React.CSSProperties,
    [accent, onAccent],
  );

  async function enviarReserva() {
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
      codigo: codigo.trim() ? codigo.trim().toUpperCase().replace(/\s+/g, "") : null,
      ticketProductoId: ticketProductoId ?? null,
      ticketOnly: ticketOnly && productosTicket.length > 0,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    if (r.clienteExistente && r.camposDistintos.length > 0) {
      setAvisoDatos(r.datosCliente);
    } else {
      setAvisoDatos(null);
    }
    setCuponAplicado(r.cuponAplicado);
    setExito(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
    startTransition(async () => {
      // 1) Comprobar si ya hay ficha con ese email o teléfono.
      const check = await comprobarClientePublicoAction({
        empresaSlug,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
      });
      if (check.ok && check.match) {
        const m = check.match;
        const formNombre = `${nombre.trim()} ${apellidos.trim()}`.trim().toLowerCase();
        const dbNombre = `${m.nombre} ${m.apellidos ?? ""}`.trim().toLowerCase();
        // Si el nombre no coincide, mostrar modal de confirmación.
        if (formNombre !== dbNombre) {
          setMatch(m);
          return;
        }
      }
      // 2) Sin match (o nombre idéntico): enviar directamente.
      await enviarReserva();
    });
  }

  function continuarConDatosGuardados() {
    setMatch(null);
    startTransition(async () => {
      await enviarReserva();
    });
  }

  // Enlace dedicado a ticket pero TODOS los productos están agotados/ocultos.
  // No tiene sentido permitir reserva libre desde aquí.
  if (ticketOnly && productosTicket.length === 0) {
    return (
      <main
        className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-12 bg-gradient-to-b from-zinc-50 to-zinc-100"
        style={styleVars}
      >
        <div className="max-w-md w-full bg-white sm:rounded-2xl sm:shadow-xl sm:border sm:border-zinc-100 p-8 sm:p-10 text-center space-y-5">
          {logoUrl ? (
            <div className="mx-auto w-24 h-24 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={empresaNombre} className="max-w-full max-h-full object-contain" />
            </div>
          ) : null}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Evento agotado</h1>
            <p className="text-zinc-600">
              Ya no quedan plazas disponibles para esta promoción. Contacta con
              el restaurante para más información.
            </p>
          </div>
          <div className="pt-4 border-t border-zinc-100">
            <p className="text-sm text-zinc-500">Gracias por tu interés en</p>
            <p className="text-lg font-semibold mt-1">{empresaNombre}</p>
          </div>
        </div>
      </main>
    );
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
          {cuponAplicado && (
            <div className="text-left rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-700 font-medium">Cupón aplicado</p>
              <p className="mt-1 font-mono text-lg font-bold text-amber-900">{cuponAplicado.codigo}</p>
              <p className="text-sm text-amber-900">{cuponAplicado.tituloCliente}</p>
            </div>
          )}
          {avisoDatos ? (
            <div className="text-left rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-amber-700 shrink-0" />
                <p className="text-sm text-amber-900">
                  Detectamos que ya tienes una ficha con nosotros. Tu reserva se ha vinculado a ella y hemos
                  mantenido los datos originales:
                </p>
              </div>
              <ul className="text-sm text-amber-900 pl-6 list-disc space-y-0.5">
                <li>
                  Nombre: <strong>{avisoDatos.nombre}{avisoDatos.apellidos ? ` ${avisoDatos.apellidos}` : ""}</strong>
                </li>
                {avisoDatos.email ? (
                  <li>
                    Email: <strong>{avisoDatos.email}</strong>
                  </li>
                ) : null}
                {avisoDatos.telefono ? (
                  <li>
                    Teléfono: <strong>{avisoDatos.telefono}</strong>
                  </li>
                ) : null}
              </ul>
              <p className="text-xs text-amber-800">
                Si necesitas actualizar tus datos, díselo al restaurante al confirmar.
              </p>
            </div>
          ) : null}
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
        {/* HERO con logo — oculto en embed para que el iframe quede limpio. */}
        {!embedded && (
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
        )}

        {/* FORM CARD — full-bleed en móvil, card en sm+ */}
        <form
          onSubmit={onSubmit}
          className="bg-white sm:rounded-2xl sm:shadow-xl sm:border sm:border-zinc-100 px-5 sm:px-7 pt-2 pb-6 sm:pt-7 sm:pb-7 space-y-5"
        >
          {productosTicket.length > 0 && (
            <TicketSelector
              productos={productosTicket}
              selectedId={ticketProductoId}
              onChange={(id) => {
                setTicketProductoId(id);
                // Cupón y ticket son tipos incompatibles: si el cliente elige
                // ticket, limpiamos cualquier cupón previo del estado.
                if (id) {
                  setCodigo("");
                  setMostrarCodigo(false);
                  setCuponValido(null);
                }
              }}
              required={ticketObligatorio}
              accent={accent}
              onAccent={onAccent}
            />
          )}

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

          {/* Cupón y ticket son tipos de reserva incompatibles: si el cliente
              ha elegido un producto-ticket, no mostramos la opción de cupón. */}
          {!ticketProductoId && (
            <div className="pt-1">
              {mostrarCodigo ? (
                <CuponInputReserva
                  value={codigo}
                  onChange={setCodigo}
                  validar={(c) => validarCuponPublicoAction({
                    empresaSlug,
                    codigo: c,
                    fecha,
                    turno: turnoPorHora,
                  })}
                  contextoSerial={`${fecha}|${turnoPorHora}|${personas}`}
                  onResult={(r) => setCuponValido(r === null ? null : r.ok)}
                  label="Código de cupón"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarCodigo(true)}
                  className="text-sm text-zinc-500 hover:text-zinc-700 underline underline-offset-4 inline-flex items-center gap-1.5"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  ¿Tienes un código promocional?
                </button>
              )}
            </div>
          )}

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

      <Dialog open={!!match} onOpenChange={(o) => !o && setMatch(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-amber-600" />
              Ya estás en nuestra base
            </DialogTitle>
          </DialogHeader>
          {match && (
            <div className="space-y-3 text-sm">
              <p className="text-zinc-700">
                Este {match.matchPor === "email" ? "email" : "teléfono"} pertenece a:
              </p>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-0.5 text-zinc-900">
                <p className="font-semibold">
                  {match.nombre}
                  {match.apellidos ? ` ${match.apellidos}` : ""}
                </p>
                {match.email && <p className="text-xs text-zinc-600">{match.email}</p>}
                {match.telefono && <p className="text-xs text-zinc-600">{match.telefono}</p>}
              </div>
              <p className="text-xs text-zinc-600">
                No se pueden repetir email ni teléfono. Reserva con estos datos o cambia los del
                formulario.
              </p>
            </div>
          )}
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setMatch(null)}
              disabled={enviando}
            >
              Cambiar datos
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              style={{ background: accent, color: onAccent }}
              onClick={continuarConDatosGuardados}
              disabled={enviando}
            >
              {enviando ? "Enviando..." : "Reservar con estos datos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
