"use client";

import * as React from "react";
import { toast } from "sonner";
import { POSTicketProvider, usePOSTicket } from "../hooks/usePOSTicket";
import type { ProductoPOS } from "../types";
import { TicketEnVivo } from "./TicketEnVivo";
import { CategoriaTabs } from "./CategoriaTabs";
import { ProductoGrid } from "./ProductoGrid";
import { Numpad } from "./Numpad";
import { AccionesLaterales } from "./AccionesLaterales";
import { ModalMesas } from "./ModalMesas";
import { ModalDescuento } from "./ModalDescuento";
import { ModalDividir } from "./ModalDividir";
import { ModalCobro } from "./ModalCobro";
import { HistorialTickets } from "./HistorialTickets";
import { htmlComanda, htmlTicketVenta, imprimirHTML } from "../services/impresion";
import type { SubTicket, PagoMedio } from "../types";
import { cobrarTicketCompleto } from "../actions/cobrar-ticket-completo";
import { persistirEnvioACocina } from "../actions/persistir-envio-cocina";

interface Props {
  productos: ProductoPOS[];
}

export function POSShell({ productos }: Props) {
  return (
    <POSTicketProvider>
      <POSShellInner productos={productos} />
    </POSTicketProvider>
  );
}

function POSShellInner({ productos }: Props) {
  const [categoriaActiva, setCategoriaActiva] = React.useState<string | null>(null);
  const [mesasOpen, setMesasOpen] = React.useState(false);
  const [mesasModo, setMesasModo] = React.useState<"seleccionar" | "cambiar">("seleccionar");
  const [descuentoOpen, setDescuentoOpen] = React.useState(false);
  const [dividirOpen, setDividirOpen] = React.useState(false);
  const [subtickets, setSubtickets] = React.useState<SubTicket[] | null>(null);
  const [cobroOpen, setCobroOpen] = React.useState(false);
  const [cobrando, setCobrando] = React.useState(false);
  const [historialOpen, setHistorialOpen] = React.useState(false);
  const { state, dispatch, totales } = usePOSTicket();

  const pendiente = () => toast.info("Disponible en la próxima fase.");

  const enviarCocina = async () => {
    const pendientes = state.lineas.filter((l) => !l.enviadaAt);
    if (pendientes.length === 0) {
      toast.info("No hay líneas nuevas para enviar.");
      return;
    }

    // ─── 1. Persistir en BD (crea ticket si no existe + líneas con enviada_at) ───
    const res = await persistirEnvioACocina({
      ticketId: state.ticketIdServer,
      mesaId: state.mesaId,
      comensales: state.comensales,
      lineasNuevas: pendientes.map((l) => ({
        localId: l.id,
        productoId: l.productoId,
        nombre: l.nombre,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        ivaPct: l.ivaPct,
        descuentoPct: l.descuentoPct,
        destino: l.destino,
        notaCocina: l.notaCocina,
      })),
    });
    if (!res.ok) {
      toast.error(`No se pudo enviar a cocina: ${res.error}`);
      return;
    }

    // ─── 2. Imprimir comandas (opcional: convive con el KDS) ───
    const header = {
      mesa: state.mesaId ? `Mesa seleccionada` : "Barra",
      comensales: state.comensales,
    };
    const htmlCocina = htmlComanda("COCINA", pendientes, header);
    const htmlBarra = htmlComanda("BARRA", pendientes, header);
    if (htmlCocina) imprimirHTML(htmlCocina);
    if (htmlBarra) imprimirHTML(htmlBarra);

    // ─── 3. Sincronizar estado local con IDs reales del servidor ───
    dispatch({
      type: "syncConServer",
      ticketIdServer: res.ticketId,
      enviadaAt: res.enviadaAt,
      lineaIdMap: res.lineaIdMap,
    });
    toast.success(`${pendientes.length} línea(s) enviadas (ticket ${res.numero}).`);
  };

  const confirmarCobro = async (pagos: { medio: PagoMedio; importe: number; referencia?: string }[]) => {
    if (state.lineas.length === 0) return;
    setCobrando(true);
    try {
      // Si ya hay ticket en BD (envío a cocina previo), enviamos sólo líneas
      // que aún no se han persistido (las que no tienen enviadaAt).
      const lineasPersistir = state.ticketIdServer
        ? state.lineas.filter((l) => !l.enviadaAt)
        : state.lineas;

      const res = await cobrarTicketCompleto({
        mesaId: state.mesaId,
        comensales: state.comensales,
        ticketIdExistente: state.ticketIdServer,
        lineas: lineasPersistir.map((l) => ({
          productoId: l.productoId,
          nombre: l.nombre,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          ivaPct: l.ivaPct,
          descuentoPct: l.descuentoPct,
          destino: l.destino,
          notaCocina: l.notaCocina,
        })),
        descuento: state.descuento,
        pagos,
      });
      if (!res.ok) {
        toast.error(`Error al cobrar: ${res.error}`);
        return;
      }
      // Imprimir ticket final
      imprimirHTML(
        htmlTicketVenta(state.lineas, totales, {
          empresa: "Balles Hosteleros",
          mesa: state.mesaId ? "Mesa" : "Barra",
          comensales: state.comensales,
          numero: res.numero,
        })
      );
      toast.success(`Ticket ${res.numero} cobrado.`);
      dispatch({ type: "reset" });
      setSubtickets(null);
    } finally {
      setCobrando(false);
    }
  };

  const imprimirTicket = () => {
    if (state.lineas.length === 0) return;
    imprimirHTML(
      htmlTicketVenta(state.lineas, totales, {
        empresa: "Balles Hosteleros",
        mesa: state.mesaId ? "Mesa" : "Barra",
        comensales: state.comensales,
      })
    );
  };
  const abrirMesas = () => {
    setMesasModo("seleccionar");
    setMesasOpen(true);
  };
  const cambiarMesa = () => {
    if (!state.mesaId) {
      toast.info("No hay mesa seleccionada.");
      return;
    }
    setMesasModo("cambiar");
    setMesasOpen(true);
  };

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-[320px_1fr_170px] gap-2 bg-slate-50 p-2">
      {/* Columna izquierda: ticket en vivo + numpad */}
      <div className="flex flex-col gap-2 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <TicketEnVivo />
        </div>
        <Numpad />
      </div>

      {/* Columna central: categorías + grid */}
      <div className="flex flex-col gap-2 overflow-hidden">
        <CategoriaTabs
          productos={productos}
          categoriaActiva={categoriaActiva}
          onChange={setCategoriaActiva}
        />
        <div className="flex-1 overflow-hidden rounded-md border bg-white p-2 shadow-sm">
          <ProductoGrid productos={productos} categoriaActiva={categoriaActiva} />
        </div>
        <div className="flex justify-between rounded-md border bg-white px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          <span>{productos.length} productos · {state.lineas.length} líneas</span>
          <span className="tabular-nums font-semibold text-foreground">
            Total: {totales.total.toFixed(2)} €
          </span>
        </div>
      </div>

      {/* Columna derecha: acciones */}
      <div className="overflow-y-auto">
        <AccionesLaterales
          onAbrirMesa={abrirMesas}
          onEnviarCocina={enviarCocina}
          onDescuento={() => setDescuentoOpen(true)}
          onDividir={() => setDividirOpen(true)}
          onCobrar={() => setCobroOpen(true)}
          onHistorial={() => setHistorialOpen(true)}
          onImprimir={imprimirTicket}
          onCambiarMesa={cambiarMesa}
          onCerrarSesion={pendiente}
        />
      </div>

      <ModalMesas
        open={mesasOpen}
        onOpenChange={setMesasOpen}
        titulo={mesasModo === "cambiar" ? "Cambiar a mesa libre" : "Seleccionar mesa"}
        filtroEstado={mesasModo === "cambiar" ? "LIBRE" : undefined}
        onSelect={(mesa) => {
          dispatch({ type: "setMesa", mesaId: mesa.id, comensales: mesa.capacidad });
          toast.success(`Mesa ${mesa.codigo || mesa.numero} seleccionada (${mesa.zona}).`);
        }}
      />
      <ModalDescuento open={descuentoOpen} onOpenChange={setDescuentoOpen} />
      <ModalDividir
        open={dividirOpen}
        onOpenChange={setDividirOpen}
        onConfirmar={(subs) => {
          setSubtickets(subs);
          toast.success(`${subs.length} subtickets generados.`);
        }}
      />
      <ModalCobro
        open={cobroOpen}
        onOpenChange={(v) => !cobrando && setCobroOpen(v)}
        total={totales.total}
        onConfirmar={confirmarCobro}
      />
      <HistorialTickets open={historialOpen} onOpenChange={setHistorialOpen} />
      {subtickets && subtickets.length > 0 && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-primary/90 px-2 py-1 text-xs text-primary-foreground shadow">
          {subtickets.length} subtickets en espera
        </div>
      )}
    </div>
  );
}
