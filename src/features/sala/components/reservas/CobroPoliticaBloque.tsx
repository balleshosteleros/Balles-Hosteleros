"use client";

/**
 * Estado de la tarjeta de una reserva, junto al "Tipo de reserva" (PRP-082 §5.3).
 *
 * Es el sitio donde el camarero ya mira al abrir una reserva, así que la
 * garantía se ve sin buscarla. Según el estado enseña una cosa u otra, y solo
 * ofrece botones cuando de verdad hay algo que hacer.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, CreditCard, ShieldCheck, AlertTriangle } from "lucide-react";
import {
  cobrarGarantia,
  liberarGarantia,
  cobrarCancelacion,
  renunciarCobroCancelacion,
  perdonarCobro,
} from "@/features/sala/actions/cobro-politicas-actions";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

/** 40 → "40,00 €" (coma decimal). */
function eur(n: number | null | undefined): string {
  return `${Number(n ?? 0).toFixed(2).replace(".", ",")} €`;
}

function fecha(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

export interface DatosCobroPolitica {
  reservaId: string;
  tieneGarantia: boolean;
  garantiaImporte: number | null;
  garantiaEstado: string | null;
  garantiaTarjetaUltimos4: string | null;
  garantiaTarjetaMarca: string | null;
  garantiaCaptureDeadline: string | null;
  garantiaCobradaAt: string | null;
  tieneCancelacion: boolean;
  cancelacionImporte: number | null;
  cancelacionEstado: string | null;
  cancelacionTarjetaUltimos4: string | null;
  cancelacionIntentos: number;
  cancelacionError: string | null;
  cancelacionProximoIntentoAt: string | null;
  cancelacionCobradaAt: string | null;
  cobroPerdonadoAt: string | null;
}

export function CobroPoliticaBloque({
  datos,
  onCambio,
}: {
  datos: DatosCobroPolitica;
  onCambio?: () => void;
}) {
  if (!datos.tieneGarantia && !datos.tieneCancelacion) return null;

  return (
    <div className="space-y-2">
      {datos.tieneGarantia && <Garantia datos={datos} onCambio={onCambio} />}
      {datos.tieneCancelacion && <Cancelacion datos={datos} onCambio={onCambio} />}
    </div>
  );
}

function Garantia({
  datos,
  onCambio,
}: {
  datos: DatosCobroPolitica;
  onCambio?: () => void;
}) {
  const { confirm, dialog } = useConfirmDelete();
  const [ocupado, setOcupado] = useState<"cobrar" | "liberar" | null>(null);
  const importe = eur(datos.garantiaImporte);
  const tarjeta = datos.garantiaTarjetaUltimos4
    ? `${datos.garantiaTarjetaMarca ?? "Tarjeta"} ···· ${datos.garantiaTarjetaUltimos4}`
    : null;

  async function cobrar() {
    // Mover dinero es irreversible desde aquí: se pregunta antes.
    const ok = await confirm({
      title: "Cobrar la garantía",
      description: `Se cobrarán ${importe} al cliente. Desde el software no se puede deshacer: una devolución se hace en Revolut.`,
      confirmLabel: "Cobrar",
    });
    if (!ok) return;
    setOcupado("cobrar");
    const res = await cobrarGarantia(datos.reservaId);
    setOcupado(null);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success(`Cobrados ${importe}`);
      onCambio?.();
    }
  }

  async function liberar() {
    setOcupado("liberar");
    const res = await liberarGarantia(datos.reservaId);
    setOcupado(null);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Garantía liberada");
      onCambio?.();
    }
  }

  const estado = datos.garantiaEstado;

  return (
    <Marco tono="garantia" titulo="Garantía">
      {dialog}
      {estado === "cobrada" ? (
        <Texto>
          Cobrados <b>{importe}</b>
          {datos.garantiaCobradaAt ? ` el ${fecha(datos.garantiaCobradaAt)}` : ""}.
        </Texto>
      ) : estado === "liberada" ? (
        <Texto>Liberada. No se le cobró nada al cliente.</Texto>
      ) : estado === "caducada" ? (
        <Texto>
          La retención caducó: el banco devolvió el dinero. Ya no se puede cobrar.
        </Texto>
      ) : estado === "retenida" ? (
        <>
          <div className="font-semibold text-sm">{importe} retenidos</div>
          {tarjeta && (
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {tarjeta}
              {datos.garantiaCaptureDeadline
                ? ` · hasta el ${fecha(datos.garantiaCaptureDeadline)}`
                : ""}
            </div>
          )}
          <div className="flex gap-1.5 mt-2">
            <Boton onClick={cobrar} cargando={ocupado === "cobrar"} principal>
              Cobrar
            </Boton>
            <Boton onClick={liberar} cargando={ocupado === "liberar"}>
              Liberar
            </Boton>
          </div>
        </>
      ) : (
        // Marcada con garantía pero sin tarjeta: es un alta de Sala.
        <Texto avisa>
          Garantía de {importe} — <b>sin tarjeta</b>. Hay que pedírsela al cliente.
        </Texto>
      )}
    </Marco>
  );
}

function Cancelacion({
  datos,
  onCambio,
}: {
  datos: DatosCobroPolitica;
  onCambio?: () => void;
}) {
  const { confirm, dialog } = useConfirmDelete();
  const [ocupado, setOcupado] = useState<"cobrar" | "renunciar" | "perdonar" | null>(null);
  const importe = eur(datos.cancelacionImporte);

  async function perdonar() {
    // No mueve dinero, así que no lleva confirmación de borrado: es una
    // decisión reversible (se puede cobrar después, mientras la tarjeta valga).
    setOcupado("perdonar");
    const res = await perdonarCobro(datos.reservaId);
    setOcupado(null);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("No se cobrará");
      onCambio?.();
    }
  }

  async function cobrar() {
    // Doble red contra el cobro repetido: si ya se pulsó, no se vuelve a
    // llamar aunque el botón se pinte activo un instante.
    if (ocupado) return;
    const ok = await confirm({
      title: "Cobrar la cancelación",
      description: `Se intentarán cobrar ${importe} de la tarjeta del cliente. Puede fallar si no tiene fondos.`,
      confirmLabel: "Cobrar",
    });
    if (!ok) return;
    setOcupado("cobrar");
    const res = await cobrarCancelacion(datos.reservaId);
    if (!res.ok) {
      // Solo se devuelve el botón cuando se sabe que NO se cobró. Si la
      // respuesta fue "no sabemos si salió", el botón sigue bloqueado: lo
      // resolverá el cuadre contra Revolut, no otra pulsación.
      setOcupado(null);
      toast.error(res.error);
      onCambio?.();
      return;
    }
    // Cobrado: el botón NO se reactiva. `onCambio` recarga la ficha, que ya
    // vendrá con el estado "cobrada" y sin botón que pulsar.
    toast.success(`Cobrados ${importe}`);
    onCambio?.();
  }

  async function renunciar() {
    setOcupado("renunciar");
    const res = await renunciarCobroCancelacion(datos.reservaId);
    setOcupado(null);
    if (!res.ok) toast.error(res.error);
    else {
      toast.success("Se deja de intentar el cobro");
      onCambio?.();
    }
  }

  const estado = datos.cancelacionEstado;
  const tarjeta = datos.cancelacionTarjetaUltimos4
    ? `···· ${datos.cancelacionTarjetaUltimos4}`
    : null;

  return (
    <Marco tono="cancelacion" titulo="Política de cancelación">
      {dialog}
      {estado === "cobrada" ? (
        <Texto>
          Cobrados <b>{importe}</b>
          {datos.cancelacionCobradaAt ? ` el ${fecha(datos.cancelacionCobradaAt)}` : ""}.
        </Texto>
      ) : estado === "fallida" ? (
        <>
          <Texto avisa>
            No se pudo cobrar {importe} · intento {datos.cancelacionIntentos}
            {datos.cancelacionError ? ` · ${datos.cancelacionError}` : ""}
          </Texto>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {datos.cobroPerdonadoAt
              ? "Se dejó de intentar."
              : datos.cancelacionProximoIntentoAt
                ? `Se vuelve a intentar el ${fecha(datos.cancelacionProximoIntentoAt)}.`
                : "No quedan más intentos automáticos."}
          </div>
          {!datos.cobroPerdonadoAt && (
            <div className="flex gap-1.5 mt-2">
              <Boton onClick={cobrar} cargando={ocupado === "cobrar"} principal>
                Intentar ahora
              </Boton>
              <Boton onClick={renunciar} cargando={ocupado === "renunciar"}>
                Dejar de intentar
              </Boton>
            </div>
          )}
        </>
      ) : estado === "guardada" ? (
        <>
          <div className="text-sm">
            Tarjeta guardada · se cobrarán <b>{importe}</b> si no se presenta
          </div>
          {tarjeta && (
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
              {tarjeta}
            </div>
          )}
          <div className="flex gap-1.5 mt-2">
            <Boton onClick={cobrar} cargando={ocupado === "cobrar"} principal>
              Cobrar
            </Boton>
            {!datos.cobroPerdonadoAt && (
              <Boton onClick={perdonar} cargando={ocupado === "perdonar"}>
                No cobrar
              </Boton>
            )}
          </div>
        </>
      ) : (
        <Texto avisa>
          Política de {importe} — <b>sin tarjeta</b>. Hay que pedírsela al cliente.
        </Texto>
      )}
    </Marco>
  );
}

function Marco({
  tono,
  titulo,
  children,
}: {
  tono: "garantia" | "cancelacion";
  titulo: string;
  children: React.ReactNode;
}) {
  const cls =
    tono === "garantia"
      ? "border-sky-500/40 bg-sky-500/5"
      : "border-amber-500/40 bg-amber-500/5";
  const icono =
    tono === "garantia" ? (
      <ShieldCheck className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
    ) : (
      <CreditCard className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
    );
  return (
    <div className={`rounded-md border p-2.5 ${cls}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icono}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {titulo}
        </span>
      </div>
      {children}
    </div>
  );
}

function Texto({ children, avisa }: { children: React.ReactNode; avisa?: boolean }) {
  return (
    <div className={`text-xs leading-relaxed ${avisa ? "text-amber-700 dark:text-amber-400" : ""}`}>
      {avisa && <AlertTriangle className="h-3 w-3 inline mr-1 -mt-0.5" />}
      {children}
    </div>
  );
}

function Boton({
  onClick,
  cargando,
  principal,
  children,
}: {
  onClick: () => void;
  cargando: boolean;
  principal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
        principal
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-input hover:bg-muted"
      }`}
    >
      {cargando && <Loader2 className="h-3 w-3 animate-spin" />}
      {children}
    </button>
  );
}
