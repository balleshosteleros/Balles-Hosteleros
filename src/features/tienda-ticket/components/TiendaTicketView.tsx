"use client";

/**
 * Tienda de productos de tipo Ticket.
 *
 * Interfaz independiente del motor de reservas: aquí el cliente SOLO compra.
 * La reserva la hace después, cuando quiera, con el código que recibe.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Ticket } from "lucide-react";
import { comprarTicketAction } from "@/features/tienda-ticket/actions/comprar-ticket";

export interface ProductoTienda {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  iva: number;
  modoPrecio: "por_persona" | "por_reserva";
  /** Comensales que cubre cada unidad. 1 = por persona; 2 = paquete para dos. */
  personasPorUnidad: number;
  cobroModo: "revolut" | "gratis";
  stockModo: "ilimitado" | "limitado";
  stockTotal: number | null;
  stockConsumido: number;
}

interface Props {
  empresaSlug: string;
  empresaNombre: string;
  logoUrl: string | null;
  color: string | null;
  colorTexto: string | null;
  productos: ProductoTienda[];
  /**
   * Incrustada en la web del restaurante: sin cabecera propia ni márgenes de
   * página, porque la web ya pone su título y su fondo. Se lee como una
   * sección más, no como un recuadro pegado encima.
   */
  embedded?: boolean;
}

/** 49 → "49,00 €" (coma decimal, como en toda la aplicación). */
function euros(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function precioConIva(p: ProductoTienda): number {
  // El precio del producto YA incluye el IVA: es lo que paga el cliente.
  return Number(p.precio.toFixed(2));
}

/** Cuánta gente puede venir. Una experiencia se compra de dos en dos. */
const PERSONAS_OPCIONES = [2, 4, 6, 8, 10, 12] as const;

function disponibles(p: ProductoTienda): number | null {
  if (p.stockModo === "ilimitado" || p.stockTotal == null) return null;
  return Math.max(0, p.stockTotal - p.stockConsumido);
}

export function TiendaTicketView({
  empresaSlug, empresaNombre, logoUrl, color, colorTexto, productos,
  embedded = false,
}: Props) {
  const acento = color ?? "#18181b";
  const sobreAcento = colorTexto ?? "#ffffff";

  const [productoId, setProductoId] = useState<string | null>(
    productos.length === 1 ? productos[0].id : null,
  );
  // Arranca en 2 porque lo normal es reservar para dos; con paquetes la unidad
  // ya son dos personas, así que el valor de partida es 1 (ver efecto abajo).
  const [unidades, setUnidades] = useState(2);
  /**
   * El formulario de tarjeta se monta DENTRO de esta pantalla, igual que en
   * las políticas de reserva. La página alojada de Revolut traía su "Pagar
   * X €", los botones de Revolut Pay y su publicidad, y sacaba al cliente de
   * la web del restaurante en mitad de la compra.
   */
  const contenedorTarjeta = useRef<HTMLDivElement | null>(null);
  const campoRef = useRef<{
    submit: (meta?: Record<string, unknown>) => void;
    destroy: () => void;
  } | null>(null);
  const [campoListo, setCampoListo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigoGratis, setCodigoGratis] = useState<string | null>(null);

  const producto = useMemo(
    () => productos.find((p) => p.id === productoId) ?? null,
    [productos, productoId],
  );

  const porPersona = producto?.modoPrecio === "por_persona";
  // El desplegable pide PERSONAS, sin más: los "paquetes" obligaban al cliente
  // a traducir "1 paquete = 2 personas" para saber cuánta gente venía y cuánto
  // pagaba. Ahora elige 2, 4, 6… y el precio se calcula sobre esa gente.
  const comensales = porPersona ? unidades : 1;
  const total = producto ? precioConIva(producto) * comensales : 0;

  // Al cambiar de producto se vuelve a la compra típica: dos personas.
  useEffect(() => {
    setUnidades(2);
  }, [productoId]);

  const valido =
    !!producto &&
    nombre.trim().length > 0 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) &&
    unidades >= 1;

  async function comprar() {
    if (!valido || !producto) return;
    setEnviando(true);
    setError(null);

    const r = await comprarTicketAction({
      empresaSlug,
      productoId: producto.id,
      unidades,
      nombre: nombre.trim(),
      email: email.trim(),
      telefono: telefono.trim() || null,
    });

    if (!r.ok) {
      setError(r.error);
      setEnviando(false);
      return;
    }

    if (r.modo === "pago") {
      try {
        const { default: RevolutCheckout } = await import("@revolut/checkout");
        const instancia = await RevolutCheckout(
          r.tokenPago,
          r.entorno === "pruebas" ? "sandbox" : "prod",
        );
        const destino = contenedorTarjeta.current;
        if (!destino) {
          setError("No pudimos abrir el formulario. Recarga la página.");
          setEnviando(false);
          return;
        }
        campoRef.current = instancia.createCardField({
          target: destino,
          locale: "es",
          hidePostcodeField: true,
          email: email.trim(),
          onSuccess() {
            // Pagado: se le lleva a su código y sus instrucciones.
            window.location.href = `/ticket/${empresaSlug}/gracias?compra=${r.compraId}`;
          },
          onValidation() {
            setError(null);
          },
          onError(err: unknown) {
            setError(
              err instanceof Error
                ? `No se pudo validar la tarjeta: ${err.message}`
                : "No se pudo validar la tarjeta. Revisa los datos.",
            );
            setEnviando(false);
          },
        });
        setCampoListo(true);
      } catch {
        setError("No pudimos abrir el formulario de tarjeta. Inténtalo de nuevo.");
      }
      setEnviando(false);
      return;
    }

    setCodigoGratis(r.codigo);
    setEnviando(false);
  }

  useEffect(() => {
    return () => {
      campoRef.current?.destroy();
      campoRef.current = null;
    };
  }, []);

  // ── Producto gratuito: el código se enseña al momento ──────────────
  if (codigoGratis) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: acento, color: sobreAcento }}
        >
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-zinc-900">Todo listo</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Te hemos enviado el código a {email.trim()}.
        </p>

        <div className="my-6 rounded-xl border-2 border-zinc-900 p-5">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Tu código</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-zinc-900">
            {codigoGratis}
          </p>
          <p className="mt-2 text-xs text-zinc-500">Válido para un solo uso</p>
        </div>

        <a
          href={`/reservar/${empresaSlug}?ticket=${encodeURIComponent(codigoGratis)}`}
          className="inline-block rounded-lg px-6 py-3 text-sm font-semibold"
          style={{ background: acento, color: sobreAcento }}
        >
          Reservar mesa
        </a>
      </div>
    );
  }

  if (productos.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Ticket className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
        <h1 className="text-lg font-semibold text-zinc-900">No hay productos a la venta</h1>
        <p className="mt-1 text-sm text-zinc-600">Vuelve a intentarlo más adelante.</p>
      </div>
    );
  }

  return (
    <div className={embedded ? "mx-auto max-w-md" : "mx-auto max-w-md px-4 py-8"}>
      {!embedded && (
        <header className="mb-6 text-center">
          {logoUrl
            ? <img src={logoUrl} alt={empresaNombre} className="mx-auto mb-3 h-12 object-contain" />
            : <h2 className="mb-1 text-lg font-semibold text-zinc-900">{empresaNombre}</h2>}
          <p className="text-sm text-zinc-600">
            Compra ahora y reserva tu mesa cuando quieras.
          </p>
        </header>
      )}

      {/* ── Producto ──────────────────────────────────────────── */}
      <div className="space-y-2">
        {productos.map((p) => {
          const restante = disponibles(p);
          const agotado = restante === 0;
          const sel = productoId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={agotado}
              onClick={() => setProductoId(sel ? null : p.id)}
              aria-pressed={sel}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                sel ? "ring-2" : "hover:bg-zinc-50"
              } ${agotado ? "cursor-not-allowed opacity-50" : ""}`}
              style={sel
                ? { borderColor: acento, boxShadow: `0 0 0 2px ${acento}` }
                : { borderColor: "#e4e4e7" }}
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                style={sel
                  ? { background: acento, borderColor: acento, color: sobreAcento }
                  : { borderColor: "#a1a1aa" }}
              >
                {sel && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-900">{p.nombre}</span>
                  <span className="text-sm font-semibold" style={{ color: acento }}>
                    {p.cobroModo === "gratis" ? "Gratis" : euros(precioConIva(p))}
                    {p.cobroModo !== "gratis" && (
                      <span className="ml-1 text-[10px] font-normal text-zinc-500">
                        {p.modoPrecio === "por_persona" ? "/persona" : "/reserva"}
                      </span>
                    )}
                  </span>
                </span>
                {p.descripcion && (
                  <span className="mt-0.5 block text-xs text-zinc-600">{p.descripcion}</span>
                )}
                {restante != null && restante > 0 && restante <= 10 && (
                  <span className="mt-1 block text-[10px] font-medium text-amber-700">
                    Quedan {restante}
                  </span>
                )}
                {agotado && (
                  <span className="mt-1 block text-[10px] font-medium text-red-700">Agotado</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Personas y datos ──────────────────────────────────── */}
      {producto && (
        <div className="mt-6 space-y-4">
          {porPersona && (
            <div className="space-y-1.5">
              <Label htmlFor="uds" className="text-zinc-700">
                Personas
              </Label>
              {/* Desplegable de pares en vez de un número libre: una
                  experiencia se compra para dos, cuatro, seis… Escribir "7" a
                  mano llevaba a un carrito que la sala no puede sentar. */}
              <select
                id="uds"
                value={unidades}
                onChange={(e) => setUnidades(Number(e.target.value))}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              >
                {PERSONAS_OPCIONES.map((n) => (
                  <option key={n} value={n}>
                    {n} personas
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="nom" className="text-zinc-700">
              Nombre <span className="text-red-600">*</span>
            </Label>
            <Input id="nom" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mail" className="text-zinc-700">
              Email <span className="text-red-600">*</span>
            </Label>
            <Input
              id="mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-[11px] text-zinc-500">Aquí te enviamos el código.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tel" className="text-zinc-700">Teléfono</Label>
            <Input id="tel" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>

          {/* ── Total ──────────────────────────────────────────── */}
          {producto.cobroModo !== "gratis" && (
            <div className="rounded-xl border p-4" style={{ borderColor: "#e4e4e7" }}>
              <div className="flex items-center justify-between text-sm text-zinc-600">
                <span>
                  {!porPersona
                    ? producto.nombre
                    : `${unidades} personas × ${euros(precioConIva(producto))}`}
                </span>
                <span className="text-base font-semibold text-zinc-900">{euros(total)}</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">IVA incluido</p>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {/* Campos de tarjeta de Revolut, dentro de nuestra pantalla. Vacío
              hasta que el cliente pulsa el botón de arriba. */}
          <div className={campoListo ? "rounded-xl border border-zinc-200 p-3" : "hidden"} ref={contenedorTarjeta} />

          {campoListo ? (
            <Button
              onClick={() => {
                setEnviando(true);
                setError(null);
                campoRef.current?.submit({ name: nombre.trim(), email: email.trim() });
              }}
              disabled={enviando}
              className="h-11 w-full text-sm font-semibold"
              style={{ background: acento, color: sobreAcento }}
            >
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar pago de {euros(total)}
            </Button>
          ) : (
            <Button
              onClick={comprar}
              disabled={!valido || enviando}
              className="h-11 w-full text-sm font-semibold"
              style={{ background: acento, color: sobreAcento }}
            >
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {producto.cobroModo === "gratis" ? "Conseguir código" : `Pagar ${euros(total)}`}
            </Button>
          )}

          <p className="text-center text-[11px] text-zinc-500">
            {producto.cobroModo === "gratis"
              ? "Recibirás tu código por correo."
              : "Pago seguro. Recibirás tu código por correo al completar el pago."}
          </p>
        </div>
      )}
    </div>
  );
}
