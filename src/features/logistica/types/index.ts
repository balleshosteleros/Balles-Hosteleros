export type {
  ProductoTipo,
  ProductoEstado,
  ProveedorEstado,
  AlbaranEstado,
  ProductoRow,
  StockRow,
  ProveedorRow,
  IngredienteProveedorRow,
  EscandalloRow,
  StockTemporadaRow,
  StockTemporadaReglaRow,
  AlbaranRow,
  AlbaranLineaRow,
  NecesidadCompraRow,
} from "./db";

export type {
  ProveedorImport,
  ProductoImport,
  EscandalloImport,
  ImportResult,
  ImportError,
} from "./import";

export type {
  AgoraVentaRaw,
  AgoraVentaValidada,
  AgoraBatchResult,
  AgoraRegistroError,
  AgoraSyncStatus,
  AgoraSyncLogEntry,
} from "./agora";

export {
  agoraVentaRawSchema,
  agoraVentaValidadaSchema,
  validarLoteAgora,
} from "./agora";
