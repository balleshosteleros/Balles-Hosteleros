import { z } from "zod";
import type { ModuleIO, RowSchema } from "@/shared/io";
import type { ListadoReservaRow } from "@/features/sala/actions/listado-reservas-actions";

/**
 * Exportación del listado analítico de reservas (pantalla Sala).
 *
 * Solo salida: este listado no se importa nunca — las reservas se crean desde
 * Sala o desde el motor de la web, jamás pegando un Excel. Por eso no lleva
 * `upsert` y el menú no ofrece importar.
 *
 * Quien exporta se lleva SIEMPRE las filas que tiene en pantalla tras aplicar
 * sus filtros (la vista se las pasa por `exportRecords`), con todas las
 * columnas: ocultar una columna es un ajuste de lectura, no una forma de
 * quitar datos del informe.
 */
const schema = z.object({}).passthrough() as unknown as RowSchema<ListadoReservaRow>;

export const listadoReservasIO: ModuleIO<ListadoReservaRow> = {
  module: "sala",
  submodule: "listado-reservas",
  label: "Listado de reservas",
  description: "Todas las reservas del periodo con sus datos, filtros aplicados.",
  schema,
  supportedExportFormats: ["xlsx", "csv", "json", "pdf"],
  columns: [
    { key: "tipoFila", label: "Tipo" },
    { key: "cliente", label: "Cliente" },
    { key: "nombre", label: "Nombre" },
    { key: "apellidos", label: "Apellidos" },
    { key: "telefono", label: "Teléfono" },
    { key: "email", label: "Email" },
    { key: "clienteClasificacion", label: "Clasificación" },
    { key: "clienteVisitas", label: "Visitas", type: "number" },
    { key: "clienteUltimaVisita", label: "Última visita", type: "date" },

    { key: "fecha", label: "Fecha", type: "date" },
    { key: "hora", label: "Hora" },
    { key: "turno", label: "Turno" },
    { key: "comensales", label: "Comensales", type: "number" },
    { key: "duracionMinutos", label: "Duración (min)", type: "number" },

    { key: "zona", label: "Zona" },
    { key: "mesa", label: "Mesa" },

    { key: "estado", label: "Estado" },
    { key: "origen", label: "Origen" },
    { key: "etiquetas", label: "Etiquetas", type: "array" },
    { key: "observaciones", label: "Observaciones" },

    { key: "esTicket", label: "Es ticket", type: "boolean" },
    { key: "ticketProducto", label: "Producto ticket" },
    { key: "ticketCodigo", label: "Código ticket" },
    { key: "ticketUnidades", label: "Unidades ticket", type: "number" },
    { key: "ticketImporte", label: "Importe ticket", type: "number" },
    { key: "ticketIva", label: "IVA ticket", type: "number" },
    { key: "ticketEstadoCompra", label: "Estado de la compra" },
    { key: "ticketCanjeHasta", label: "Canjear hasta", type: "date" },
    { key: "ticketPagadoAt", label: "Pagado el" },

    { key: "tipoCategoria", label: "Tipo de reserva" },
    { key: "importePagado", label: "Importe pagado", type: "number" },
    { key: "tarjetaIntroducida", label: "Tarjeta", type: "boolean" },
    { key: "pagoPendiente", label: "Pago pendiente", type: "boolean" },

    { key: "tieneGarantia", label: "Con garantía", type: "boolean" },
    { key: "garantiaEstado", label: "Estado garantía" },
    { key: "garantiaImporte", label: "Importe garantía", type: "number" },
    { key: "garantiaTarjeta", label: "Tarjeta garantía" },
    { key: "garantiaSolicitadaAt", label: "Garantía solicitada" },
    { key: "garantiaRetenidaAt", label: "Garantía retenida" },
    { key: "garantiaCobradaAt", label: "Garantía cobrada" },
    { key: "garantiaCaptureDeadline", label: "Cobrar antes de" },
    { key: "garantiaLimiteAt", label: "Límite garantía" },

    { key: "tieneCancelacion", label: "Con cancelación", type: "boolean" },
    { key: "cancelacionEstado", label: "Estado cancelación" },
    { key: "cancelacionImporte", label: "Importe cancelación", type: "number" },
    { key: "cancelacionTarjeta", label: "Tarjeta cancelación" },
    { key: "cancelacionGuardadaAt", label: "Tarjeta guardada el" },
    { key: "cancelacionCobradaAt", label: "Cancelación cobrada" },
    { key: "cancelacionIntentos", label: "Intentos de cobro", type: "number" },
    { key: "cancelacionUltimoIntentoAt", label: "Último intento" },
    { key: "cancelacionProximoIntentoAt", label: "Próximo intento" },
    { key: "cancelacionError", label: "Motivo del fallo" },

    { key: "cobroSinDecidir", label: "Sin decidir", type: "boolean" },
    { key: "politicaIncumplidaAt", label: "Incumplió el" },
    { key: "cobroMotivo", label: "Motivo del cobro" },
    { key: "cobroPerdonadoAt", label: "Perdonado el" },

    { key: "cupon", label: "Cupón" },
    { key: "cuponTitulo", label: "Nombre del cupón" },

    { key: "createdAt", label: "Creada el" },
    { key: "reconfirmadaAt", label: "Reconfirmada el" },
    { key: "bloqueada", label: "Bloqueada", type: "boolean" },
    { key: "vinculacionEstado", label: "Vinculación" },
    { key: "externalOrigen", label: "Canal externo" },
    { key: "externalId", label: "ID externo" },
    { key: "emailConfirmacionAt", label: "Email confirmación" },
    { key: "emailReconfirmacionAt", label: "Email reconfirmación" },
    { key: "emailRecordatorioAt", label: "Email recordatorio" },
    { key: "emailCancelacionAt", label: "Email cancelación" },
    { key: "emailValoracionAt", label: "Email valoración" },
    { key: "id", label: "ID" },
  ],
  // Nunca se llama: la vista siempre pasa las filas ya filtradas. Está por
  // contrato de `ModuleIO`, y devolver vacío evita exportar por accidente un
  // listado distinto del que el usuario está mirando.
  fetchAll: async () => [],
};
