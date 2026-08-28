"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarCheck, Users, Mail, Phone, Calendar, Clock, Ticket, Info, MapPin } from "lucide-react";
import { crearReservaPublicaAction } from "@/features/reservar-publica/actions/crear-reserva-publica";
import { comprobarClientePublicoAction } from "@/features/reservar-publica/actions/comprobar-cliente-publico";
import { validarCuponPublicoAction } from "@/features/reservar-publica/actions/validar-cupon-publico-action";
import { CuponInputReserva } from "@/features/sala/cupones/components/CuponInputReserva";
import { TicketSelector, type ProductoTicketPublico } from "@/features/reservar-publica/components/TicketSelector";
import { SelectorDisponibilidad } from "@/features/reservar-publica/components/SelectorDisponibilidad";
import {
  listarGruposZonasPublica,
  type GrupoZonaPublico,
} from "@/features/reservar-publica/actions/listar-grupos-zonas-publica";

/** Prefijos habituales de la clientela. España primero por ser el caso normal. */
const PREFIJOS = [
  { code: "+34", flag: "🇪🇸" },
  { code: "+351", flag: "🇵🇹" },
  { code: "+33", flag: "🇫🇷" },
  { code: "+44", flag: "🇬🇧" },
  { code: "+49", flag: "🇩🇪" },
  { code: "+39", flag: "🇮🇹" },
  { code: "+1", flag: "🇺🇸" },
  { code: "+52", flag: "🇲🇽" },
  { code: "+54", flag: "🇦🇷" },
  { code: "+31", flag: "🇳🇱" },
  { code: "+41", flag: "🇨🇭" },
  { code: "+212", flag: "🇲🇦" },
] as const;
import { turnoDeHora } from "@/features/sala/lib/dia-negocio";
import type { CamposObligatoriosPublico } from "@/features/reservar-publica/actions/listar-disponibilidad-publica";
import {
  RESERVA_NOMBRE_MAX_CHARS,
  RESERVA_APELLIDOS_MAX_CHARS,
} from "@/features/sala/data/reservas";
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

/** "2026-08-20" → "jueves, 20 de agosto". Fecha civil: sin zona horaria. */
function formatearFechaLarga(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(y, (m ?? 1) - 1, d);
  return fecha.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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
  // Sin hora por defecto: la elige el cliente entre las que están realmente
  // abiertas (antes se fijaba "21:00" a ciegas y podía no existir ese pase).
  const [hora, setHora] = useState("");
  const [personas, setPersonas] = useState(2);
  // Zona elegida por el cliente. Es un GRUPO de zonas ("Sala", "Terraza"), no
  // una zona interna: el cliente no conoce nuestros nombres de sala.
  const [grupoZonaId, setGrupoZonaId] = useState<string>("");
  const [gruposZonas, setGruposZonas] = useState<GrupoZonaPublico[]>([]);
  const [zonaExigida, setZonaExigida] = useState(false);
  const [cargandoZonas, setCargandoZonas] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [cuponValido, setCuponValido] = useState<boolean | null>(null);
  const [ticketProductoId, setTicketProductoId] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  const [exito, setExito] = useState(false);
  const [avisoDatos, setAvisoDatos] = useState<AvisoDatosOriginales | null>(null);
  const [match, setMatch] = useState<MatchCliente | null>(null);
  const [cuponAplicado, setCuponAplicado] = useState<{ codigo: string; tituloCliente: string } | null>(null);
  // Consentimiento RGPD: la reserva recoge nombre, teléfono y correo. Arranca
  // SIN marcar — un consentimiento premarcado no es válido (art. 4.11 RGPD).
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  // Consentimiento comercial: separado del de privacidad y tambien sin marcar
  // por defecto. Es opcional — no reservar por no querer publicidad seria
  // consentimiento forzado.
  const [aceptaMarketing, setAceptaMarketing] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [telefonoPrefijo, setTelefonoPrefijo] = useState("+34");
  // Campos que esta empresa exige además de los fijos. Arranca con el default
  // del catálogo (email y teléfono) para que el asterisco no parpadee mientras
  // llega la respuesta del servidor, que es quien manda.
  const [obligatorios, setObligatorios] = useState<CamposObligatoriosPublico>({
    email: true,
    telefono: true,
  });

  const accent = isHexColor(colorPrimario) ? colorPrimario : "#0a0a0a";
  const onAccent = isHexColor(colorTexto) ? colorTexto : "#ffffff";

  const ticketObligatorio = ticketOnly && productosTicket.length > 0;
  const ticketValido = !ticketObligatorio || Boolean(ticketProductoId);
  // Mismo criterio que el servidor: la madrugada es cena, no comida.
  const turnoPorHora = useMemo<"COMIDA" | "CENA" | null>(
    () => (hora ? turnoDeHora(hora) : null),
    [hora],
  );
  // Nombre, apellidos, fecha, hora y comensales son siempre obligatorios; el
  // email y el teléfono, solo si la empresa los exige.
  const valido =
    nombre.trim().length > 0 &&
    apellidos.trim().length > 0 &&
    (!obligatorios.telefono || telefono.trim().length >= 5) &&
    (!obligatorios.email || email.trim().length > 0) &&
    personas > 0 &&
    fecha &&
    hora &&
    (!zonaExigida || grupoZonaId.length > 0) &&
    ticketValido &&
    aceptaPrivacidad &&
    cuponValido !== false;

  // Zonas disponibles: dependen de fecha, hora y personas, así que se
  // recalculan cada vez que el cliente cambia algo de eso. Una zona sin hueco
  // para ESE grupo se muestra en gris y no se puede elegir.
  useEffect(() => {
    if (!fecha || !hora || personas <= 0) {
      setGruposZonas([]);
      return;
    }
    let cancelado = false;
    setCargandoZonas(true);
    (async () => {
      const r = await listarGruposZonasPublica({ empresaSlug, fecha, hora, personas });
      if (cancelado) return;
      setZonaExigida(r.exigido);
      // Si la empresa no exige zona, el cliente no elige: ni se muestran ni se
      // arrastra una selección previa al enviar.
      if (!r.exigido) {
        setGruposZonas([]);
        setGrupoZonaId("");
        setCargandoZonas(false);
        return;
      }
      setGruposZonas(r.grupos);
      // Si la zona elegida se ha llenado mientras tanto, se deselecciona para
      // que el cliente no envíe una reserva que vamos a rechazar.
      setGrupoZonaId((prev) => {
        if (!prev) return prev;
        const sigue = r.grupos.find((g) => g.id === prev);
        return sigue && sigue.disponible ? prev : "";
      });
      setCargandoZonas(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaSlug, fecha, hora, personas]);

  const styleVars = useMemo(
    () => ({ ["--brand" as string]: accent, ["--brand-fg" as string]: onAccent }) as React.CSSProperties,
    [accent, onAccent],
  );

  async function enviarReserva() {
    const r = await crearReservaPublicaAction({
      empresaSlug,
      origen,
      nombre: nombre.trim(),
      apellidos: apellidos.trim(),
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      fecha,
      hora,
      personas,
      grupoZonaId: grupoZonaId || null,
      fechaNacimiento: fechaNacimiento || null,
      telefonoPrefijo: telefono.trim() ? telefonoPrefijo : null,
      aceptaMarketing,
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
            <h1 className="text-2xl font-bold tracking-tight">¡Reserva confirmada!</h1>
            <p className="text-zinc-600">Tu mesa está reservada. Te esperamos.</p>
          </div>
          {/* Resumen de lo reservado: la mesa ya está asignada, así que
              podemos afirmar día, hora y comensales sin condicionales. */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Día</dt>
                <dd className="font-semibold text-zinc-900">{formatearFechaLarga(fecha)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Hora</dt>
                <dd className="font-semibold text-zinc-900 tabular-nums">{hora}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Comensales</dt>
                <dd className="font-semibold text-zinc-900">
                  {personas} {personas === 1 ? "persona" : "personas"}
                </dd>
              </div>
            </dl>
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
      // Incrustado en una web: sin fondo propio ni alto de pantalla, para que se
      // lea como una sección más y no como un recuadro pegado encima.
      className={
        embedded
          ? "bg-transparent"
          : "min-h-[100dvh] bg-white sm:bg-gradient-to-b sm:from-zinc-50 sm:to-zinc-100 sm:py-8 sm:px-6"
      }
      style={styleVars}
    >
      <div
        className={
          embedded
            ? "mx-auto w-full max-w-3xl"
            : "max-w-md mx-auto pb-[max(env(safe-area-inset-bottom),1.5rem)]"
        }
      >
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

          {/* Bloque "qué reservas": comensales → fecha → hora. Agrupado en un
              panel para separarlo visualmente de los datos de contacto.
              Las personas van primero porque la disponibilidad depende de
              cuánta gente viene. */}
          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 space-y-4">
            <div>
              <Label className="text-zinc-700 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Personas *
              </Label>
              <div className="flex items-center gap-2 mt-1.5 rounded-xl border border-zinc-200 bg-white p-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 sm:h-9 sm:w-9 rounded-lg hover:bg-zinc-100 text-xl"
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
                  className="h-11 w-11 sm:h-9 sm:w-9 rounded-lg hover:bg-zinc-100 text-xl"
                  onClick={() => setPersonas((n) => Math.min(50, n + 1))}
                  aria-label="Sumar persona"
                >
                  <span className="leading-none">+</span>
                </Button>
              </div>
            </div>

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
                className="mt-1.5 h-11 w-full min-w-0 max-w-full appearance-none rounded-xl border-zinc-200 bg-white px-3 text-sm"
              />
            </div>

            {/* Horas REALES del restaurante para esa fecha y comensales.
                Sustituye al iframe de CoverManager: el cliente elige un pase
                abierto en vez de escribir una hora que luego rechazaríamos. */}
            <div>
              <Label className="text-zinc-700 flex items-center gap-1.5 mb-1.5">
                <Clock className="h-3.5 w-3.5" />
                Hora *
              </Label>
              <SelectorDisponibilidad
                empresaSlug={empresaSlug}
                fecha={fecha}
                personas={personas}
                horaSeleccionada={hora}
                onSelect={setHora}
                accent={accent}
                onObligatoriosChange={setObligatorios}
              />
            </div>
          </div>

          {/* Zonas. Solo si la empresa ha activado "exigir zona": si está
              apagado, el cliente no elige y no se le muestra nada. Hace falta
              ademas fecha/hora/personas para saber cuál está llena. */}
          {zonaExigida && gruposZonas.length > 0 && (
            <div>
              <Label htmlFor="zona" className="text-zinc-700 flex items-center gap-1.5 mb-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Zonas *
              </Label>
              <select
                id="zona"
                value={grupoZonaId}
                onChange={(e) => setGrupoZonaId(e.target.value)}
                disabled={cargandoZonas}
                className="w-full h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              >
                <option value="">
                  {cargandoZonas ? "Comprobando disponibilidad…" : "Seleccione la zona"}
                </option>
                {gruposZonas.map((g) => (
                  <option key={g.id} value={g.id} disabled={!g.disponible}>
                    {g.nombre}
                    {g.disponible ? "" : " (Zona completa)"}
                  </option>
                ))}
              </select>
              {!cargandoZonas && gruposZonas.every((g) => !g.disponible) && (
                <p className="mt-1.5 text-xs text-red-600">
                  No queda sitio para {personas}{" "}
                  {personas === 1 ? "persona" : "personas"} a esa hora. Prueba con otra hora.
                </p>
              )}
            </div>
          )}

          {/* Datos de contacto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nombre" className="text-zinc-700">Nombre *</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                maxLength={RESERVA_NOMBRE_MAX_CHARS}
                autoComplete="given-name"
                className="mt-1.5 h-12 sm:h-11 rounded-xl border-zinc-200 text-base sm:text-sm"
              />
            </div>
            <div>
              <Label htmlFor="apellidos" className="text-zinc-700">Apellidos *</Label>
              <Input
                id="apellidos"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                required
                maxLength={RESERVA_APELLIDOS_MAX_CHARS}
                autoComplete="family-name"
                className="mt-1.5 h-12 sm:h-11 rounded-xl border-zinc-200 text-base sm:text-sm"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="telefono" className="text-zinc-700 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Teléfono{obligatorios.telefono ? " *" : ""}
            </Label>
            {/* Prefijo aparte: un numero extranjero sin el suyo queda
                inservible para llamar o mandar un SMS. */}
            <div className="mt-1.5 flex gap-2">
              <select
                value={telefonoPrefijo}
                onChange={(e) => setTelefonoPrefijo(e.target.value)}
                disabled={enviando}
                aria-label="Prefijo del país"
                className="h-12 sm:h-11 w-28 shrink-0 rounded-xl border border-zinc-200 bg-white px-2 text-base sm:text-sm"
              >
                {PREFIJOS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.flag} {p.code}
                  </option>
                ))}
              </select>
              <Input
                id="telefono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required={obligatorios.telefono}
                placeholder="612 345 678"
                className="h-12 sm:h-11 rounded-xl border-zinc-200 text-base sm:text-sm"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="nacimiento" className="text-zinc-700 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Fecha de nacimiento
            </Label>
            <Input
              id="nacimiento"
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="mt-1.5 h-11 w-full min-w-0 appearance-none rounded-xl border-zinc-200 px-3 text-sm"
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-zinc-700 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Email{obligatorios.email ? " *" : ""}
            </Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={obligatorios.email}
              placeholder="carlos@gmail.com"
              className="mt-1.5 h-12 sm:h-11 rounded-xl border-zinc-200 text-base sm:text-sm"
            />
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

          <label className="flex items-start gap-2 pt-1 text-xs leading-snug text-zinc-500">
            <input
              type="checkbox"
              checked={aceptaPrivacidad}
              onChange={(e) => setAceptaPrivacidad(e.target.checked)}
              disabled={enviando}
              className="mt-0.5 shrink-0"
            />
            <span>
              He leído y acepto la{" "}
              <a
                href="/politica-de-privacidad"
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 hover:text-zinc-700"
              >
                política de privacidad
              </a>
              .
            </span>
          </label>

          {/* Comercial: consentimiento distinto del de privacidad y opcional.
              Exigirlo para reservar lo invalidaria (RGPD art. 7.4). */}
          <label className="flex items-start gap-2 text-xs leading-snug text-zinc-500">
            <input
              type="checkbox"
              checked={aceptaMarketing}
              onChange={(e) => setAceptaMarketing(e.target.checked)}
              disabled={enviando}
              className="mt-0.5 shrink-0"
            />
            <span>
              Quiero enterarme de las novedades.
            </span>
          </label>

          <Button
            type="submit"
            size="lg"
            className="w-full font-semibold text-base h-14 sm:h-12 rounded-xl shadow-md hover:shadow-lg transition-shadow mt-2"
            disabled={!valido || enviando}
            style={{ background: accent, color: onAccent }}
          >
            {enviando ? "Enviando..." : "Reservar mesa"}
          </Button>
        </form>

        <footer className="text-center mt-6 text-xs text-zinc-400">
          <p>Confirmación inmediata · {empresaNombre}</p>
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
