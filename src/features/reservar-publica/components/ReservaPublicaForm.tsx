"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import type { TicketPublico } from "@/features/reservar-publica/actions/validar-ticket-publico";
import { TicketCodigoInput } from "@/features/reservar-publica/components/TicketCodigoInput";
import {
  fechaPermitidaPorTicket,
  horaPermitidaPorTicket,
  zonaPermitidaPorTicket,
} from "@/features/sala/lib/validar-ticket-canje";
import {
  validarTelefono,
  validarEmail,
  validarNombre,
} from "@/shared/lib/validar-contacto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarCheck, Users, Mail, Phone, Calendar, Clock, Ticket, Info, MapPin } from "lucide-react";
import { crearReservaPublicaAction } from "@/features/reservar-publica/actions/crear-reserva-publica";
import { validarCuponPublicoAction } from "@/features/reservar-publica/actions/validar-cupon-publico-action";
import { CuponInputReserva } from "@/features/sala/cupones/components/CuponInputReserva";
import type { ProductoTicketPublico } from "@/features/reservar-publica/components/TicketSelector";
import { SelectorDisponibilidad } from "@/features/reservar-publica/components/SelectorDisponibilidad";
import {
  listarGruposZonasPublica,
  type GrupoZonaPublico,
} from "@/features/reservar-publica/actions/listar-grupos-zonas-publica";
import { listarMaxPersonasPublicaAction } from "@/features/reservar-publica/actions/listar-max-personas-publica";

/** Prefijos habituales de la clientela. España primero por ser el caso normal. */
import {
  PREFIJOS_TELEFONO,
  PREFIJO_POR_DEFECTO,
  componerTelefono,
} from "@/features/sala/data/prefijos-telefono";
import { turnoDeHora } from "@/features/sala/lib/dia-negocio";
import type { CamposObligatoriosPublico } from "@/features/reservar-publica/actions/listar-disponibilidad-publica";
import {
  RESERVA_NOMBRE_MAX_CHARS,
  RESERVA_APELLIDOS_MAX_CHARS,
  MAX_COMENSALES_SIN_REGLA,
} from "@/features/sala/data/reservas";
import { toast } from "sonner";

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
  /** Código de Ticket que llega en el enlace del correo de compra. */
  ticketCodigoInicial?: string | null;
  /**
   * Zona horaria (IANA) del restaurante, resuelta en servidor. El navegador del
   * cliente puede estar en cualquier parte del mundo: sin esto, "hoy" sería el
   * suyo y no el del local, y el calendario dejaría elegir un día ya pasado allí.
   */
  zonaHoraria: string;
}

/** Fecha de HOY (YYYY-MM-DD) en el restaurante, no en el navegador del cliente. */
function hoyEnZona(tz: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
  ticketCodigoInicial = null,
  zonaHoraria,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  // Se calcula una sola vez: es la misma zona en servidor y en cliente, así que
  // el valor coincide y no rompe la hidratación.
  const hoyLocal = useMemo(() => hoyEnZona(zonaHoraria), [zonaHoraria]);
  const [fecha, setFecha] = useState(hoyLocal);
  // Sin hora por defecto: la elige el cliente entre las que están realmente
  // abiertas (antes se fijaba "21:00" a ciegas y podía no existir ese pase).
  const [hora, setHora] = useState("");
  const [personas, setPersonas] = useState(2);
  // Tope del desplegable de personas: lo fija la empresa en Configuración →
  // Límites. Hasta que responde el servidor se usa el fallback, para que el
  // selector nunca aparezca vacío.
  const [maxPersonas, setMaxPersonas] = useState(MAX_COMENSALES_SIN_REGLA);
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
  // Canje de un Ticket comprado antes: el código y el ticket ya validado.
  const [ticketCodigo, setTicketCodigo] = useState(ticketCodigoInicial ?? "");
  const [ticketCanje, setTicketCanje] = useState<TicketPublico | null>(null);
  const [enviando, startTransition] = useTransition();
  const [exito, setExito] = useState(false);
  const [cuponAplicado, setCuponAplicado] = useState<{ codigo: string; tituloCliente: string } | null>(null);
  // Consentimiento RGPD: la reserva recoge nombre, teléfono y correo. Arranca
  // SIN marcar — un consentimiento premarcado no es válido (art. 4.11 RGPD).
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  // Consentimiento comercial: separado del de privacidad y tambien sin marcar
  // por defecto. Es opcional — no reservar por no querer publicidad seria
  // consentimiento forzado.
  const [aceptaMarketing, setAceptaMarketing] = useState(false);
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [telefonoPrefijo, setTelefonoPrefijo] = useState(PREFIJO_POR_DEFECTO);
  // Campos que esta empresa exige además de los fijos. Arranca con el default
  // del catálogo (email y teléfono) para que el asterisco no parpadee mientras
  // llega la respuesta del servidor, que es quien manda.
  const [obligatorios, setObligatorios] = useState<CamposObligatoriosPublico>({
    email: true,
    fechaNacimiento: true,
    telefono: true,
  });

  const accent = isHexColor(colorPrimario) ? colorPrimario : "#0a0a0a";
  const onAccent = isHexColor(colorTexto) ? colorTexto : "#ffffff";

  const ticketObligatorio = ticketOnly && productosTicket.length > 0;
  // Con un código canjeado el ticket ya está cubierto: no hace falta comprar.
  const ticketValido =
    !ticketObligatorio || Boolean(ticketProductoId) || Boolean(ticketCanje);
  // Si escribió un código, tiene que ser válido para poder reservar: un código
  // a medias o rechazado no puede colarse como reserva normal.
  /**
   * Teléfono con su prefijo, como se va a guardar.
   *
   * La validación exige el prefijo dentro del número —así ninguno se queda
   * huérfano y acaba dado por español—, pero en pantalla el prefijo vive en su
   * propio desplegable. Sin juntarlos aquí, el formulario decía "falta el
   * prefijo del país" con el +34 ya elegido, y no había forma de continuar.
   */
  const telefonoCompleto = componerTelefono(telefonoPrefijo, telefono);

  const canjeConforme = ticketCodigo.trim().length === 0 || ticketCanje !== null;
  /**
   * La fecha elegida NO vale para el ticket que trae el cliente.
   *
   * El campo de fecha del navegador no deja bloquear días sueltos, así que se
   * avisa en cuanto elige. El problema es la FECHA, no el código: su código es
   * bueno, y decírselo al revés le hacía pensar que había comprado mal.
   */
  const fechaFueraDelTicket =
    ticketCanje !== null &&
    fecha.length > 0 &&
    !fechaPermitidaPorTicket(ticketCanje.condiciones, fecha);

  // Comensales que se ofrecen. Un ticket vendido por paquetes (la Cena
  // Experiencia va de 2 en 2) solo admite múltiplos de su tamaño: ofrecer 3 en
  // un producto para parejas deja una plaza sin pagar y una mesa descuadrada.
  const pasoPersonas = ticketCanje?.porPersona
    ? Math.max(1, ticketCanje.personasPorUnidad)
    : 1;
  const opcionesPersonas = useMemo(() => {
    const out: number[] = [];
    for (let n = pasoPersonas; n <= maxPersonas; n += pasoPersonas) out.push(n);
    // Con un tope menor que el paquete, al menos se ofrece el paquete entero:
    // un desplegable vacío bloquearía la reserva sin explicar por qué.
    return out.length > 0 ? out : [pasoPersonas];
  }, [pasoPersonas, maxPersonas]);
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
    validarTelefono(telefonoCompleto, obligatorios.telefono).ok &&
    validarEmail(email, obligatorios.email).ok &&
    (!obligatorios.fechaNacimiento || fechaNacimiento.trim().length > 0) &&
    validarNombre(nombre).ok &&
    personas > 0 &&
    fecha &&
    hora &&
    (!zonaExigida || grupoZonaId.length > 0) &&
    ticketValido &&
    canjeConforme &&
    !fechaFueraDelTicket &&
    aceptaPrivacidad &&
    cuponValido !== false;

  /**
   * Qué falta por rellenar, en palabras.
   *
   * Un botón gris sin explicación deja al cliente mirando la pantalla sin
   * saber qué le falta —y abandonando la reserva—. Se nombra solo lo primero
   * que falte, para no soltarle una lista.
   */
  const queFalta = ((): string | null => {
    if (valido) return null;
    if (!nombre.trim()) return "Escribe tu nombre.";
    const vNombre = validarNombre(nombre);
    if (!vNombre.ok) return vNombre.error;
    if (!apellidos.trim()) return "Escribe tus apellidos.";
    if (!fecha) return "Elige el día.";
    if (!hora) return "Elige la hora.";
    // El teléfono es la única vía para avisar de un cambio de mesa o una
    // incidencia: uno inventado deja la reserva incontactable.
    const vTel = validarTelefono(telefonoCompleto, obligatorios.telefono);
    if (!vTel.ok) return vTel.error;
    const vEmail = validarEmail(email, obligatorios.email);
    if (!vEmail.ok) return vEmail.error;
    if (obligatorios.fechaNacimiento && !fechaNacimiento.trim())
      return "Escribe tu fecha de nacimiento.";
    if (zonaExigida && !grupoZonaId) return "Elige la zona.";
    if (!ticketValido) return "Elige uno de los productos disponibles.";
    if (fechaFueraDelTicket) return "Tu experiencia no se puede usar ese día. Elige otra fecha.";
    if (!canjeConforme) return "El código que has escrito no es válido. Bórralo o corrígelo.";
    if (cuponValido === false) return "El código promocional no es válido.";
    if (!aceptaPrivacidad) return "Marca la casilla de la política de privacidad.";
    return null;
  })();

  // Filtros que impone el ticket. Se calculan aquí y se reparten a los
  // selectores: la regla vive en un solo sitio (validar-ticket-canje) y la usan
  // igual el formulario y el servidor.
  const filtroHoraTicket = useMemo(() => {
    if (!ticketCanje) return undefined;
    const cond = ticketCanje.condiciones;
    return (h: string) => horaPermitidaPorTicket(cond, h);
  }, [ticketCanje]);

  const zonasVisibles = useMemo(() => {
    if (!ticketCanje) return gruposZonas;
    const cond = ticketCanje.condiciones;
    return gruposZonas.filter((g) => zonaPermitidaPorTicket(cond, g.id));
  }, [gruposZonas, ticketCanje]);

  // Si el ticket restringe zonas: la elegida deja de valer se limpia, y cuando
  // solo queda una posible se selecciona sola (no hay nada que decidir).
  useEffect(() => {
    if (!ticketCanje) return;
    if (grupoZonaId && !zonasVisibles.some((g) => g.id === grupoZonaId)) {
      setGrupoZonaId("");
      return;
    }
    if (!grupoZonaId && zonasVisibles.length === 1) {
      setGrupoZonaId(zonasVisibles[0].id);
    }
  }, [ticketCanje, zonasVisibles, grupoZonaId]);

  // El ticket manda sobre los comensales cuando el precio es por persona: si
  // pagó por 2, la reserva es para 2. Evita que entren 4 pagando 2.
  useEffect(() => {
    if (ticketCanje?.porPersona) setPersonas(ticketCanje.unidades);
  }, [ticketCanje]);

  // Tope de personas: se pide una sola vez al abrir el portal. Si el máximo
  // configurado es menor que lo que el cliente ya tenía elegido, se recorta:
  // el desplegable no debe quedarse mostrando un valor que ya no ofrece.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const max = await listarMaxPersonasPublicaAction({ empresaSlug });
      if (cancelado) return;
      setMaxPersonas(max);
      setPersonas((n) => Math.min(n, max));
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaSlug]);

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
      // Entero, con el prefijo dentro: es un solo campo.
      telefono: componerTelefono(telefonoPrefijo, telefono) || null,
      email: email.trim() || null,
      fecha,
      hora,
      personas,
      grupoZonaId: grupoZonaId || null,
      fechaNacimiento: fechaNacimiento || null,
      aceptaMarketing,
      codigo: codigo.trim() ? codigo.trim().toUpperCase().replace(/\s+/g, "") : null,
      ticketProductoId: ticketProductoId ?? null,
      ticketCodigo: ticketCanje ? ticketCanje.codigo : null,
      ticketOnly: ticketOnly && productosTicket.length > 0,
    });
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    // Si la reserva exige tarjeta, no se le da por cerrada: se lleva al cliente
    // a ponerla (PRP-082). La reserva ya existe, así que la mesa no se pierde
    // mientras paga.
    if (r.tarjetaPendiente?.token) {
      // Fuera del marco: este formulario se incrusta en la web del
      // restaurante, y la pasarela de pago NO se deja abrir dentro de un
      // iframe ajeno (es su defensa contra el robo de tarjetas). Si se
      // navegara aquí dentro, el cliente acabaría viendo "checkout.revolut.com
      // ha rechazado la conexión" y perdería la reserva.
      const destino = `/reserva/tarjeta/${r.tarjetaPendiente.token}`;
      if (window.self !== window.top && window.top) {
        window.top.location.href = `${window.location.origin}${destino}`;
      } else {
        window.location.href = destino;
      }
      return;
    }
    setCuponAplicado(r.cuponAplicado);
    setExito(true);
  }

  // La web NUNCA comprueba ni dice si ese email o teléfono ya tiene ficha.
  //
  // Antes se avisaba en pantalla con los datos del titular ("este teléfono
  // pertenece a María López, maria@…"), y eso convertía el formulario en una
  // forma de averiguar los datos de cualquier cliente probando teléfonos
  // ajenos. Ahora la reserva entra directa: si engancha con una ficha existente
  // y los datos no coinciden, queda marcada para que lo revise el restaurante,
  // y quien reserva recibe el aviso en SU correo de confirmación.
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) return;
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
          {/* Aquí NO se venden Tickets ni se pide su código: la web es solo
              para reservar mesa. Los Tickets se compran en su propia tienda, y
              quien ya tenga uno lo canjea desde el enlace de su correo, que
              trae el código puesto (`ticketCodigoInicial`). Meter aquí la venta
              y el canje llenaba el formulario de campos que el 99% de quien
              entra a reservar no necesita. */}

          {/* Canje de un Ticket ya comprado. Solo se pinta cuando el cliente
              llega desde el enlace de su correo (`?ticket=CODIGO`): quien entra
              a reservar sin haber comprado nada no ve este campo.

              Sin esto, el código del correo no se validaba nunca: `ticketCanje`
              se quedaba en null, el número de comensales no se fijaba y la
              reserva salía como si no hubiera pagado. */}
          {ticketCodigoInicial ? (
            <TicketCodigoInput
              empresaSlug={empresaSlug}
              value={ticketCodigo}
              onChange={setTicketCodigo}
              onResult={setTicketCanje}
              contextoSerial={`${fecha}|${hora}|${grupoZonaId}`}
              fecha={fecha}
              hora={hora}
              grupoZonaId={grupoZonaId || null}
              accent={accent}
            />
          ) : null}

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
              {/* Desplegable, no stepper: el cliente ve de un vistazo hasta
                  cuántos admite el restaurante. El tope sale de Configuración
                  → Límites (tamaño máximo por reserva, mesa o combinación de
                  mesas), así que nunca se ofrece un número que se rechazaría. */}
              <select
                value={personas}
                onChange={(e) => setPersonas(Number(e.target.value))}
                aria-label="Personas"
                // Con un ticket por persona el número lo fija lo que pagó: si
                // pudiera subirlo, entrarían más comensales de los abonados.
                disabled={ticketCanje?.porPersona === true}
                className="mt-1.5 h-11 w-full min-w-0 max-w-full appearance-none rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500"
              >
                {opcionesPersonas.map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "persona" : "personas"}
                  </option>
                ))}
              </select>
              {ticketCanje?.porPersona ? (
                <p className="mt-1.5 text-xs text-zinc-500">
                  Tu ticket cubre {ticketCanje.unidades}{" "}
                  {ticketCanje.unidades === 1 ? "persona" : "personas"}.
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-zinc-500">
                  Para grupos de más de {maxPersonas}{" "}
                  {maxPersonas === 1 ? "persona" : "personas"}, llámanos y lo
                  organizamos contigo.
                </p>
              )}
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
                min={hoyLocal}
                required
                className="mt-1.5 h-11 w-full min-w-0 max-w-full appearance-none rounded-xl border-zinc-200 bg-white px-3 text-sm"
              />
              {fechaFueraDelTicket && (
                <p className="mt-1.5 text-xs text-amber-700">
                  Tu experiencia no se puede usar ese día. Prueba con otra fecha.
                </p>
              )}
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
                horaPermitida={filtroHoraTicket}
              />
            </div>

          {/* Zonas. Solo si la empresa ha activado "exigir zona": si está
                apagado, el cliente no elige y no se le muestra nada. Hace falta
                ademas fecha/hora/personas para saber cuál está llena. */}
            {zonaExigida && zonasVisibles.length > 0 && (
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
                  {/* Sin iconos: al cliente le basta el nombre de la zona y,
                      si ya no le queda sitio a esa hora, la marca "(Zona
                      completa)" en gris del propio option deshabilitado. */}
                  {zonasVisibles.map((g) => (
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
          </div>

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
                {PREFIJOS_TELEFONO.map((p) => (
                  <option key={p.prefijo} value={p.prefijo} title={p.label}>
                    {p.flag} {p.prefijo}
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
              Fecha de nacimiento{obligatorios.fechaNacimiento ? " *" : ""}
            </Label>
            <Input
              id="nacimiento"
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              required={obligatorios.fechaNacimiento}
              max={hoyLocal}
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

          {queFalta && (
            <p className="text-center text-xs text-amber-700 mt-2">{queFalta}</p>
          )}
        </form>

        <footer className="text-center mt-6 text-xs text-zinc-400">
          <p>Confirmación inmediata · {empresaNombre}</p>
        </footer>
      </div>

    </main>
  );
}
