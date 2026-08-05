/**
 * DETECTOR DE INCIDENCIAS de albaranes (PRP-074).
 *
 * El sistema PREVÉ lo que se va a encontrar al escanear una factura y, por cada
 * anomalía, genera una PROPUESTA ya rellenada. El humano acepta o corrige; nunca
 * se le pregunta al desarrollador y nunca acaba en un documento suelto.
 *
 * Módulo PURO: recibe lo leído por el OCR + el catálogo, y devuelve incidencias.
 * Sin red, sin BD, sin `server-only` — testeable en aislamiento.
 *
 * Catálogo CERRADO de 12 tipos. Añadir uno es un cambio consciente aquí, nunca un
 * caso suelto en un `.md`.
 */

import type {
  CabeceraOcrAlbaran,
  LineaOcrAlbaran,
} from "./ocr-albaran";
import {
  identificarProveedor,
  type DiscrepanciaFiscal,
  type FiscalDocumento,
  type ProveedorFiscal,
  type ResultadoIdentificacion,
} from "./identidad-fiscal";

// ---------------------------------------------------------------------------
// Catálogo cerrado
// ---------------------------------------------------------------------------

export const TIPOS_INCIDENCIA = [
  // Grupo 1 — integridad del documento
  "documento_incompleto",
  "total_descuadrado",
  "documento_ilegible",
  // Grupo 2 — identidad
  "duplicado_exacto",
  "duplicado_negocio",
  "proveedor_desconocido",
  "datos_fiscales_discrepantes",
  // Grupo 3 — líneas
  "producto_no_encontrado",
  "producto_ambiguo",
  "linea_de_servicio",
  "linea_sin_importe",
  "formato_sin_equivalencia",
  "precio_anomalo",
  "iva_incoherente",
] as const;

export type TipoIncidencia = (typeof TIPOS_INCIDENCIA)[number];
export type SeveridadIncidencia = "bloqueante" | "alta" | "media";

/** Una acción ofrecida al usuario. La primera de la lista es la propuesta por defecto. */
export interface AccionIncidencia {
  clave: string;
  etiqueta: string;
  /** Es la propuesta del sistema (se pre-selecciona y entra en "Aceptar todas"). */
  propuesta?: boolean;
  /** Al elegirla hay que pedir un motivo escrito. */
  pideMotivo?: boolean;
  /** Datos ya rellenados que la acción aplicará (alta de producto, equivalencia...). */
  payload?: Record<string, unknown>;
}

export interface Incidencia {
  tipo: TipoIncidencia;
  severidad: SeveridadIncidencia;
  /** id de la línea afectada; null si la incidencia es del documento entero. */
  lineaId: string | null;
  /** Titular corto, en lenguaje del restaurante. */
  titulo: string;
  /** El porqué: qué ha visto el sistema y en qué se basa. */
  explicacion: string;
  acciones: AccionIncidencia[];
  /** Lo detectado en crudo, para auditoría. */
  detalle: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Entradas del detector
// ---------------------------------------------------------------------------

/** Producto del catálogo NUESTRO, con los alias que usa cada proveedor. */
export interface ProductoCatalogo {
  id: string;
  /** El nombre que elegimos NOSOTROS. */
  nombre: string;
  /** Alias legacy de un solo valor (`productos.nombre_proveedor`). */
  nombreProveedor: string | null;
  categoria: string | null;
  iva: string | null;
  /** Unidad base del producto (ud, kg, l). */
  medida: string | null;
  formato: string | null;
  controlaStock: boolean;
}

/** Alias de producto × proveedor: "así llama ESTE proveedor a ESTE producto nuestro". */
export interface AliasProveedor {
  productoId: string;
  proveedorId: string;
  aliasNormalizado: string;
  /** Referencia del artículo en el catálogo del proveedor, si la conocemos. */
  referencia: string | null;
}

/** Formato de compra con su equivalencia a la unidad base. */
export interface FormatoCompra {
  id: string;
  nombre: string;
  /** Cuántas unidades base contiene (caja de 24 → 24). Null = sin definir. */
  equivalencia: number | null;
  unidadId: string | null;
}

/** Último precio conocido de un producto para un proveedor. */
export interface PrecioHistorico {
  productoId: string;
  precio: number;
  iva: string | null;
  fecha: string;
}

export interface EntradaDeteccion {
  cabecera: CabeceraOcrAlbaran;
  lineas: LineaOcrAlbaran[];
  proveedores: ProveedorFiscal[];
  productos: ProductoCatalogo[];
  aliases: AliasProveedor[];
  formatos: FormatoCompra[];
  precios: PrecioHistorico[];
  /** Duplicados ya detectados aguas arriba (SHA y negocio) — se integran a la mesa. */
  duplicadoExactoDe?: { id: string; numero: string } | null;
  duplicadoNegocioDe?: { id: string; numero: string } | null;
  config?: Partial<ConfigDeteccion>;
}

export interface ConfigDeteccion {
  /** Margen para dar por cuadrado el total (€). */
  toleranciaTotal: number;
  /** Desviación de precio que dispara aviso (0.35 = 35 %). */
  umbralDesviacionPrecio: number;
  /** Por debajo de esta confianza, la línea se marca para revisar. */
  umbralConfianzaLinea: number;
  /** Parecido mínimo para proponer un producto. */
  umbralPropuestaProducto: number;
  /** Parecido a partir del cual se liga sin preguntar. */
  umbralAutoProducto: number;
}

export const CONFIG_DETECCION: ConfigDeteccion = {
  toleranciaTotal: 0.05,
  umbralDesviacionPrecio: 0.35,
  umbralConfianzaLinea: 0.7,
  umbralPropuestaProducto: 0.55,
  umbralAutoProducto: 0.92,
};

/**
 * Palabras que delatan un gasto/servicio. Espejo de la lista del OCR: aquí actúan
 * como red de seguridad por si el modelo no marcó `esServicio`.
 */
/**
 * Conceptos que SIEMPRE son gasto, vengan como vengan escritos.
 * Ojo: no vale con buscar la palabra suelta — "Alhambra Reserva 0,30 retornable"
 * es cerveza, no un cargo de envase. Por eso se exige que el gasto sea el concepto
 * PRINCIPAL de la línea (la abre, o es prácticamente todo su texto).
 */
const PISTAS_SERVICIO = [
  "porte", "portes", "transporte", "desplazamiento", "punto verde",
  "gestion de residuos", "recargo financiero", "gastos de gestion",
  "gastos de envio", "embalaje", "suplemento", "cargo",
  "envase retornable", "casco retornable", "deposito envase",
];

function pareceServicio(nombre: string): boolean {
  const n = normalizar(nombre);
  if (!n) return false;
  return PISTAS_SERVICIO.some(
    (p) =>
      // El texto ES el concepto ("cargo", "portes")...
      n === p ||
      // ...o empieza por él ("portes y embalaje", "cargo 1,50")...
      n.startsWith(`${p} `) ||
      // ...o el concepto es multi-palabra y aparece completo ("envase retornable").
      (p.includes(" ") && n.includes(p)),
  );
}

/** Unidades que CONTIENEN otras: sin equivalencia, el stock entraría mal. */
const UNIDADES_CONTENEDORAS = [
  "caja", "cajas", "cja", "cj", "pack", "packs", "bandeja", "bandejas",
  "saco", "sacos", "garrafa", "garrafas", "bidon", "bidón", "fardo",
  "fardos", "lote", "lotes", "palet", "palets", "estuche", "docena",
];

export interface ResultadoDeteccion {
  incidencias: Incidencia[];
  /** Identificación del proveedor, para que la UI la muestre aunque no haya incidencia. */
  identificacion: ResultadoIdentificacion;
  /** Vínculos resueltos solos (alias exacto): línea → producto nuestro. */
  vinculosAutomaticos: Array<{ lineaId: string; productoId: string; motivo: string }>;
  /** ¿Se puede confirmar? False si hay alguna bloqueante. */
  puedeConfirmar: boolean;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const normalizar = (s: string | null | undefined): string =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function similitud(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return 1 - dp[n] / Math.max(m, n);
}

const eur = (n: number): string =>
  `${n.toFixed(2).replace(".", ",")} €`;

/**
 * Deduce cuántas unidades trae un envase a partir del propio texto de la línea.
 * "PAN BRIOCHE 85g x 54u" → 54 · "CAJA 24" → 24 · "(6u)" → 6
 */
export function deducirEquivalenciaDelTexto(texto: string): number | null {
  const t = texto.toLowerCase();
  const patrones = [
    /x\s*(\d{1,4})\s*(?:u|ud|uds|unid)/,   // 85g x 54u
    /(\d{1,4})\s*(?:u|ud|uds|unid)\b/,      // 24 uds
    /\bde\s+(\d{1,4})\b/,                    // caja de 24
    /\((\d{1,4})\s*(?:u|ud|uds)?\)/,        // (6u)
  ];
  for (const p of patrones) {
    const m = p.exec(t);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 1 && n <= 2000) return n;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

export function detectarIncidencias(entrada: EntradaDeteccion): ResultadoDeteccion {
  const cfg = { ...CONFIG_DETECCION, ...(entrada.config ?? {}) };
  const { cabecera, lineas } = entrada;
  const incidencias: Incidencia[] = [];
  const vinculosAutomaticos: ResultadoDeteccion["vinculosAutomaticos"] = [];

  // === GRUPO 2 · Identidad ===================================================

  if (entrada.duplicadoExactoDe) {
    incidencias.push({
      tipo: "duplicado_exacto",
      severidad: "bloqueante",
      lineaId: null,
      titulo: "Esta misma foto ya se subió",
      explicacion: `El archivo es idéntico al del albarán ${entrada.duplicadoExactoDe.numero}. Subirlo otra vez duplicaría el stock.`,
      acciones: [
        { clave: "descartar", etiqueta: "Descartar esta subida", propuesta: true },
        { clave: "ver_existente", etiqueta: `Ver ${entrada.duplicadoExactoDe.numero}` },
      ],
      detalle: { albaranId: entrada.duplicadoExactoDe.id },
    });
  }

  if (entrada.duplicadoNegocioDe) {
    incidencias.push({
      tipo: "duplicado_negocio",
      severidad: "alta",
      lineaId: null,
      titulo: "Parece el mismo albarán que ya tenemos",
      explicacion: `Coincide el proveedor y el número con ${entrada.duplicadoNegocioDe.numero}. Si de verdad es otro documento, dilo y queda registrado quién lo autorizó.`,
      acciones: [
        { clave: "es_otro", etiqueta: "Es otro documento distinto", pideMotivo: true },
        { clave: "descartar", etiqueta: "Descartar esta subida", propuesta: true },
      ],
      detalle: { albaranId: entrada.duplicadoNegocioDe.id },
    });
  }

  const docFiscal: FiscalDocumento = {
    cifNif: cabecera.fiscal.cifNif,
    razonSocial: cabecera.fiscal.razonSocial,
    nombreDetectado: cabecera.proveedor,
    codigoPostal: cabecera.fiscal.codigoPostal,
    ciudad: cabecera.fiscal.ciudad,
    provincia: cabecera.fiscal.provincia,
  };
  const identificacion = identificarProveedor(docFiscal, entrada.proveedores);

  if (!identificacion.proveedor) {
    const sugeridos = entrada.proveedores
      .map((p) => ({
        p,
        score: similitud(
          normalizar(cabecera.proveedor ?? cabecera.fiscal.razonSocial),
          normalizar(p.nombreComercial),
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter((x) => x.score > 0.4);

    incidencias.push({
      tipo: "proveedor_desconocido",
      severidad: "bloqueante",
      lineaId: null,
      titulo: `No reconozco al proveedor "${cabecera.proveedor ?? "(sin nombre)"}"`,
      explicacion: cabecera.fiscal.cifNif
        ? `El CIF ${cabecera.fiscal.cifNif} no está en ninguna ficha. O es un proveedor nuevo, o su ficha no tiene el CIF grabado.`
        : "El documento no trae CIF legible y el nombre no casa con ninguna ficha.",
      acciones: [
        {
          clave: "crear_proveedor",
          etiqueta: `Crear proveedor "${cabecera.proveedor ?? cabecera.fiscal.razonSocial ?? "nuevo"}"`,
          propuesta: sugeridos.length === 0,
          payload: {
            nombreComercial: cabecera.proveedor ?? cabecera.fiscal.razonSocial,
            razonSocial: cabecera.fiscal.razonSocial,
            cifNif: cabecera.fiscal.cifNif,
            direccion: cabecera.fiscal.direccion,
            codigoPostal: cabecera.fiscal.codigoPostal,
            ciudad: cabecera.fiscal.ciudad,
            provincia: cabecera.fiscal.provincia,
          },
        },
        ...sugeridos.map((s, i) => ({
          clave: `es_${s.p.id}`,
          etiqueta: `Es ${s.p.nombreComercial}`,
          propuesta: i === 0,
          payload: { proveedorId: s.p.id, grabarCif: cabecera.fiscal.cifNif },
        })),
      ],
      detalle: {
        nombreLeido: cabecera.proveedor,
        cifLeido: cabecera.fiscal.cifNif,
        cifInvalido: identificacion.cifDocumentoInvalido,
      },
    });
  }

  if (identificacion.cifDocumentoInvalido) {
    incidencias.push({
      tipo: "datos_fiscales_discrepantes",
      severidad: "alta",
      lineaId: null,
      titulo: `El CIF leído no es válido: ${cabecera.fiscal.cifNif}`,
      explicacion:
        "El dígito de control no cuadra, así que probablemente esté mal leído en la foto. Compruébalo contra el papel antes de grabarlo en la ficha.",
      acciones: [
        { clave: "corregir_cif", etiqueta: "Escribir el CIF correcto", propuesta: true },
        { clave: "ignorar_cif", etiqueta: "Seguir sin grabar el CIF" },
      ],
      detalle: { cifLeido: cabecera.fiscal.cifNif },
    });
  }

  // Discrepancias reales entre el papel y la ficha grabada
  const relevantes = identificacion.discrepancias.filter((d) => d.veredicto !== "ignorable");
  if (identificacion.proveedor && relevantes.length > 0) {
    for (const d of relevantes) {
      incidencias.push(incidenciaDiscrepancia(d, identificacion.proveedor.nombreComercial));
    }
  }

  if (identificacion.conflictoIdentidad && identificacion.proveedor) {
    incidencias.push({
      tipo: "datos_fiscales_discrepantes",
      severidad: "bloqueante",
      lineaId: null,
      titulo: "El CIF y el nombre se contradicen",
      explicacion:
        `El documento parece de "${cabecera.proveedor ?? "?"}" pero su CIF apunta a otra ficha ` +
        `("${identificacion.proveedor.nombreComercial}"). Antes de registrar nada hay que aclarar de quién es este albarán.`,
      acciones: [
        { clave: "revisar", etiqueta: "Elegir el proveedor a mano", propuesta: true },
        { clave: "crear_proveedor", etiqueta: "Es un proveedor nuevo" },
      ],
      detalle: {
        cifLeido: cabecera.fiscal.cifNif,
        fichaCandidata: identificacion.proveedor.nombreComercial,
      },
    });
  }

  // === GRUPO 1 · Integridad del documento ====================================

  if (cabecera.continuaEnOtraPagina) {
    const dePaginas =
      cabecera.paginaActual && cabecera.paginasTotales
        ? ` (es la página ${cabecera.paginaActual} de ${cabecera.paginasTotales})`
        : "";
    incidencias.push({
      tipo: "documento_incompleto",
      severidad: "bloqueante",
      lineaId: null,
      titulo: "Este albarán continúa en otra página",
      explicacion:
        (cabecera.sumaYSigue !== null
          ? `El documento corta en "SUMA Y SIGUE: ${eur(cabecera.sumaYSigue)}"${dePaginas}. `
          : `El documento no llega al total final${dePaginas}. `) +
        "Si lo cargamos así, faltarán líneas y el gasto quedará corto.",
      acciones: [
        { clave: "anadir_pagina", etiqueta: "Añadir la foto que falta", propuesta: true },
        {
          clave: "cargar_parcial",
          etiqueta: "Cargar solo esta parte y marcarlo como incompleto",
          pideMotivo: true,
          payload: { documentoParcial: true, paginasEsperadas: cabecera.paginasTotales },
        },
        { clave: "descartar", etiqueta: "Descartar" },
      ],
      detalle: {
        sumaYSigue: cabecera.sumaYSigue,
        paginaActual: cabecera.paginaActual,
        paginasTotales: cabecera.paginasTotales,
      },
    });
  }

  // Cuadre del total: las de servicio SÍ suman (por eso ahora se leen).
  const sumaLineas = lineas.reduce((acc, l) => {
    const importe = l.importe ?? (l.precioUnitario ?? 0) * l.cantidad;
    return acc + importe;
  }, 0);

  if (cabecera.total !== null && !cabecera.continuaEnOtraPagina) {
    // Las líneas se imprimen SIN IVA, pero el total del pie casi siempre lo lleva.
    // Antes de gritar "descuadre" hay que saber contra qué comparar.
    const cuotaDesglose = cabecera.desgloseIva.reduce((a, d) => a + (d.cuota ?? 0), 0);

    // Si no hay desglose, se estima la cuota aplicando el IVA de cada línea.
    const cuotaEstimada =
      cuotaDesglose > 0
        ? cuotaDesglose
        : lineas.reduce((acc, l) => {
            const importe = l.importe ?? (l.precioUnitario ?? 0) * l.cantidad;
            const tipo = Number(l.iva);
            return acc + (Number.isFinite(tipo) ? (importe * tipo) / 100 : 0);
          }, 0);

    const difSinIva = Math.abs(cabecera.total - sumaLineas);
    const difConIva = Math.abs(cabecera.total - (sumaLineas + cuotaEstimada));

    // El total cuadra si casa con la base O con la base + IVA. Manda el más cercano.
    const cuadra = Math.min(difSinIva, difConIva) <= cfg.toleranciaTotal;

    if (!cuadra) {
      const diferencia = difSinIva <= difConIva
        ? cabecera.total - sumaLineas
        : cabecera.total - (sumaLineas + cuotaEstimada);
      const soloServicios = lineas.filter((l) => l.esServicio);
      const sumaServicios = soloServicios.reduce(
        (a, l) => a + (l.importe ?? (l.precioUnitario ?? 0) * l.cantidad),
        0,
      );

      incidencias.push({
        tipo: "total_descuadrado",
        severidad: "bloqueante",
        lineaId: null,
        titulo: `Las líneas no suman el total del papel (${
          diferencia > 0 ? "faltan" : "sobran"
        } ${eur(Math.abs(diferencia))})`,
        explicacion:
          `Las líneas suman ${eur(sumaLineas)} sin IVA` +
          (cuotaEstimada > 0 ? ` (${eur(sumaLineas + cuotaEstimada)} con IVA)` : "") +
          ` y el documento dice ${eur(cabecera.total)}. ` +
          (sumaServicios > 0
            ? `Hay ${soloServicios.length} línea(s) de gastos por ${eur(sumaServicios)} ya incluidas. `
            : "") +
          "Puede faltar una línea, o haber un descuento de pie que no se ha leído.",
        acciones: [
          { clave: "revisar_lineas", etiqueta: "Revisar las líneas", propuesta: true },
          { clave: "aceptar_diferencia", etiqueta: "Aceptar la diferencia", pideMotivo: true },
        ],
        detalle: {
          totalPapel: cabecera.total,
          sumaLineas,
          cuotaEstimada,
          diferencia,
          cuotaDesglose,
        },
      });
    }
  }

  // Cuadre del desglose de IVA: por tipo, no agregado.
  for (const tramo of cabecera.desgloseIva) {
    const baseLineas = lineas
      .filter((l) => Number(l.iva) === tramo.tipo)
      .reduce((a, l) => a + (l.importe ?? (l.precioUnitario ?? 0) * l.cantidad), 0);

    // Solo se contrasta si alguna línea declara ese tipo; si ninguna lo trae,
    // el IVA por línea no venía impreso y manda el desglose del pie.
    if (baseLineas === 0 || tramo.baseImponible === null) continue;

    if (Math.abs(tramo.baseImponible - baseLineas) > cfg.toleranciaTotal) {
      incidencias.push({
        tipo: "iva_incoherente",
        severidad: "alta",
        lineaId: null,
        titulo: `El IVA del ${tramo.tipo}% no cuadra`,
        explicacion:
          `El pie del documento dice que hay ${eur(tramo.baseImponible)} al ${tramo.tipo}%, ` +
          `pero las líneas marcadas con ese IVA suman ${eur(baseLineas)}. ` +
          "Alguna línea tiene el tipo de IVA mal asignado.",
        acciones: [
          {
            clave: "usar_desglose",
            etiqueta: `Repartir según el pie del documento`,
            propuesta: true,
            payload: { tipo: tramo.tipo, base: tramo.baseImponible },
          },
          { clave: "revisar_lineas", etiqueta: "Revisar el IVA línea a línea" },
        ],
        detalle: { tipo: tramo.tipo, basePie: tramo.baseImponible, baseLineas },
      });
    }
  }

  const ilegibles = lineas.filter((l) => l.confianza < cfg.umbralConfianzaLinea);
  if (ilegibles.length > lineas.length * 0.2 && ilegibles.length > 0) {
    incidencias.push({
      tipo: "documento_ilegible",
      severidad: "alta",
      lineaId: null,
      titulo: "La foto no se lee bien",
      explicacion: `${ilegibles.length} de ${lineas.length} líneas están borrosas o cortadas. Con más luz y el papel plano se lee mucho mejor.`,
      acciones: [
        { clave: "repetir_foto", etiqueta: "Volver a fotografiar", propuesta: true },
        { clave: "continuar", etiqueta: "Continuar y revisar a mano" },
      ],
      detalle: { ilegibles: ilegibles.length, total: lineas.length },
    });
  }

  // === GRUPO 3 · Líneas ======================================================

  const proveedorId = identificacion.proveedor?.id ?? null;
  const aliasDelProveedor = proveedorId
    ? entrada.aliases.filter((a) => a.proveedorId === proveedorId)
    : [];
  const productoPorId = new Map(entrada.productos.map((p) => [p.id, p]));
  const ultimoPrecio = new Map(entrada.precios.map((p) => [p.productoId, p]));

  for (const linea of lineas) {
    const textoNorm = normalizar(linea.nombre);

    // --- Vínculo por alias: la memoria del sistema ---
    // Referencia del proveedor primero (es un código, no un nombre: no falla).
    let vinculado: { productoId: string; motivo: string } | null = null;

    if (linea.referenciaProveedor) {
      const porRef = aliasDelProveedor.find(
        (a) => a.referencia && normalizar(a.referencia) === normalizar(linea.referenciaProveedor),
      );
      if (porRef) {
        vinculado = {
          productoId: porRef.productoId,
          motivo: `referencia ${linea.referenciaProveedor} de este proveedor`,
        };
      }
    }
    if (!vinculado) {
      const porAlias = aliasDelProveedor.find((a) => a.aliasNormalizado === textoNorm);
      if (porAlias) {
        vinculado = { productoId: porAlias.productoId, motivo: "ya lo vinculaste antes" };
      }
    }

    if (vinculado) {
      vinculosAutomaticos.push({ lineaId: linea.id, ...vinculado });
      // Aun vinculado, el precio y el formato pueden dar guerra: se siguen revisando.
      revisarPrecioYFormato(linea, vinculado.productoId);
      continue;
    }

    // --- Línea de servicio: gasto, no mercancía ---
    // El OCR ya la marca, pero el detector no se fía: si el modelo falla y una
    // línea de portes entra como mercancía, acabaría creando un producto fantasma
    // en el almacén. Doble red.
    if (linea.esServicio || pareceServicio(linea.nombre)) {
      const yaExiste = entrada.productos.find(
        (p) => !p.controlaStock && similitud(normalizar(p.nombre), textoNorm) >= 0.75,
      );
      const nombreProveedor = identificacion.proveedor?.nombreComercial ?? "proveedor";
      incidencias.push({
        tipo: "linea_de_servicio",
        severidad: "media",
        lineaId: linea.id,
        titulo: `"${linea.nombre}" es un gasto, no mercancía`,
        explicacion:
          "Portes, envases retornables y desplazamientos no son productos que entren en el almacén, " +
          "pero sí son gasto y deben cuadrar el total del albarán. Se dan de alta como producto de compra " +
          "SIN control de stock: el gasto se ve en contabilidad y el inventario no se ensucia.",
        acciones: [
          yaExiste
            ? {
                clave: "vincular",
                etiqueta: `Vincular a "${yaExiste.nombre}"`,
                propuesta: true,
                payload: { productoId: yaExiste.id },
              }
            : {
                clave: "crear_gasto",
                etiqueta: `Crear "${tituloGasto(linea.nombre, nombreProveedor)}" sin control de stock`,
                propuesta: true,
                payload: {
                  nombre: tituloGasto(linea.nombre, nombreProveedor),
                  controlaStock: false,
                  iva: linea.iva ?? "21",
                  precio: linea.precioUnitario,
                  categoria: "Gastos",
                },
              },
          { clave: "buscar", etiqueta: "Buscar otro producto" },
          { clave: "dejar_fuera", etiqueta: "Dejar fuera del total", pideMotivo: true },
        ],
        detalle: { nombre: linea.nombre, importe: linea.importe },
      });
      continue;
    }

    // --- Línea sin importe: probablemente regalo ---
    if ((linea.precioUnitario === null || linea.precioUnitario === 0) && linea.importe === null) {
      incidencias.push({
        tipo: "linea_sin_importe",
        severidad: "media",
        lineaId: linea.id,
        titulo: `"${linea.nombre}" viene sin precio`,
        explicacion:
          "El papel trae la cantidad pero no el importe. Lo habitual es que sea una unidad de regalo " +
          "o promoción: entra en el almacén pero no se registra precio de compra (si lo registráramos a 0, " +
          "hundiría el precio medio del producto).",
        acciones: [
          {
            clave: "es_regalo",
            etiqueta: "Es un regalo: entra en stock, sin registrar precio",
            propuesta: true,
            payload: { registrarPrecio: false, cantidadStock: linea.cantidad },
          },
          { clave: "poner_precio", etiqueta: "Escribir el precio a mano" },
          { clave: "es_error", etiqueta: "Es un error de impresión: no cargarla", pideMotivo: true },
        ],
        detalle: { nombre: linea.nombre, cantidad: linea.cantidad },
      });
      // No hacemos `continue`: sigue necesitando producto y formato.
    }

    // --- Emparejado contra el catálogo NUESTRO ---
    const puntuados = entrada.productos
      .map((p) => ({
        p,
        score: Math.max(
          similitud(textoNorm, normalizar(p.nombre)),
          similitud(textoNorm, normalizar(p.nombreProveedor)),
        ),
      }))
      .sort((a, b) => b.score - a.score);

    const mejor = puntuados[0];

    // El formato y el precio se revisan contra el producto MÁS PROBABLE, aunque la
    // línea aún no esté vinculada del todo: una caja sin equivalencia mete mal el
    // stock igual de mal esté el producto confirmado o pendiente de confirmar.
    if (mejor && mejor.score >= cfg.umbralPropuestaProducto) {
      revisarPrecioYFormato(linea, mejor.p.id);
    } else {
      // Sin producto candidato no hay unidad base contra la que comparar, pero una
      // unidad contenedora sigue siendo un problema de stock que hay que resolver.
      revisarFormatoSinProducto(linea);
    }

    if (!mejor || mejor.score < cfg.umbralPropuestaProducto) {
      incidencias.push({
        tipo: "producto_no_encontrado",
        severidad: "media",
        lineaId: linea.id,
        titulo: `"${linea.nombre}" no está en nuestro catálogo`,
        explicacion:
          `Este proveedor lo llama "${linea.nombre}". Si lo creas, se guarda con NUESTRO nombre y ` +
          "se memoriza el suyo, así que la próxima vez lo reconoceré solo.",
        acciones: [
          {
            clave: "crear",
            etiqueta: `Crear "${linea.nombre}"`,
            propuesta: true,
            payload: {
              nombre: linea.nombre,
              aliasProveedor: linea.nombre,
              referenciaProveedor: linea.referenciaProveedor,
              iva: linea.iva,
              precio: linea.precioUnitario,
              unidad: linea.unidad,
              formato: linea.formato,
              controlaStock: true,
            },
          },
          { clave: "buscar", etiqueta: "Buscarlo en todo el catálogo" },
          { clave: "ignorar", etiqueta: "Ignorar esta línea", pideMotivo: true },
        ],
        detalle: { nombre: linea.nombre, referencia: linea.referenciaProveedor },
      });
      continue;
    }

    if (mejor.score >= cfg.umbralAutoProducto) {
      vinculosAutomaticos.push({
        lineaId: linea.id,
        productoId: mejor.p.id,
        motivo: `el nombre coincide (${Math.round(mejor.score * 100)} %)`,
      });
      continue;
    }

    // Zona ambigua: hay candidatos pero ninguno seguro.
    const candidatos = puntuados
      .filter((x) => x.score >= cfg.umbralPropuestaProducto)
      .slice(0, 5);

    incidencias.push({
      tipo: "producto_ambiguo",
      severidad: "media",
      lineaId: linea.id,
      titulo: `¿"${linea.nombre}" es "${mejor.p.nombre}"?`,
      explicacion:
        `El proveedor lo llama "${linea.nombre}" y lo más parecido que tenemos es "${mejor.p.nombre}" ` +
        `(${Math.round(mejor.score * 100)} % de parecido). Confírmalo y no volveré a preguntarlo para este proveedor.`,
      acciones: [
        ...candidatos.map((c, i) => ({
          clave: `vincular_${c.p.id}`,
          etiqueta: `Es "${c.p.nombre}"`,
          propuesta: i === 0,
          payload: {
            productoId: c.p.id,
            memorizarAlias: linea.nombre,
            referenciaProveedor: linea.referenciaProveedor,
            porque: `${Math.round(c.score * 100)} % de parecido`,
          },
        })),
        { clave: "buscar", etiqueta: "Buscarlo en todo el catálogo" },
        { clave: "crear", etiqueta: `Crear "${linea.nombre}" como producto nuevo` },
        { clave: "ignorar", etiqueta: "Ignorar esta línea", pideMotivo: true },
      ],
      detalle: {
        nombre: linea.nombre,
        candidatos: candidatos.map((c) => ({ id: c.p.id, nombre: c.p.nombre, score: c.score })),
      },
    });
  }

  const puedeConfirmar = !incidencias.some((i) => i.severidad === "bloqueante");

  return { incidencias, identificacion, vinculosAutomaticos, puedeConfirmar };

  // --- helpers con captura de contexto ---

  /**
   * Formato/equivalencia de una línea cuyo producto aún no conocemos.
   * Solo puede juzgar por la unidad: si es contenedora, el stock entraría mal.
   */
  function revisarFormatoSinProducto(linea: LineaOcrAlbaran) {
    const unidadNorm = normalizar(linea.unidad);
    if (!UNIDADES_CONTENEDORAS.includes(unidadNorm)) return;
    emitirFormato(linea, null);
  }

  /** Emite la incidencia de equivalencia. `producto` null = aún sin identificar. */
  function emitirFormato(linea: LineaOcrAlbaran, producto: ProductoCatalogo | null) {
    const unidadNorm = normalizar(linea.unidad);
    const esContenedora = UNIDADES_CONTENEDORAS.includes(unidadNorm);
    const nombreFormato = normalizar(linea.formato ?? linea.unidad);
    const formatoConocido = entrada.formatos.find(
      (f) => normalizar(f.nombre) === nombreFormato && f.equivalencia !== null,
    );
    if (formatoConocido) return;

    const deducida =
      deducirEquivalenciaDelTexto(linea.nombre) ??
      deducirEquivalenciaDelTexto(linea.formato ?? "");
    const envase = linea.unidad || linea.formato || "envase";
    const dueño = producto ? ` de ${producto.nombre}` : "";

    incidencias.push({
      tipo: "formato_sin_equivalencia",
      severidad: esContenedora ? "bloqueante" : "media",
      lineaId: linea.id,
      titulo: deducida
        ? `¿Una "${envase}"${dueño} son ${deducida} unidades?`
        : `No sé cuántas unidades trae una "${envase}"`,
      explicacion: esContenedora
        ? `El proveedor sirve ${linea.cantidad} "${linea.unidad}". Sin saber cuántas unidades trae cada una, ` +
          `entrarían ${linea.cantidad} al almacén en vez de las que de verdad hay.` +
          (deducida ? ` Por el nombre de la línea deduzco que son ${deducida}.` : "")
        : `La línea viene en "${linea.unidad}" y el producto se mide en "${producto?.medida ?? "ud"}".`,
      acciones: [
        ...(deducida
          ? [
              {
                clave: "aceptar_equivalencia",
                etiqueta: `Sí, ${deducida} unidades`,
                propuesta: true,
                payload: {
                  formato: linea.formato ?? linea.unidad,
                  equivalencia: deducida,
                  cantidadStock: linea.cantidad * deducida,
                },
              },
            ]
          : []),
        {
          clave: "escribir_equivalencia",
          etiqueta: "Escribir cuántas unidades trae",
          propuesta: !deducida,
        },
        { clave: "una_a_una", etiqueta: "Es 1 unidad por envase", payload: { equivalencia: 1 } },
      ],
      detalle: {
        unidad: linea.unidad,
        formato: linea.formato,
        medidaProducto: producto?.medida ?? null,
        equivalenciaDeducida: deducida,
      },
    });
  }

  /** Revisa formato y precio de una línea contra un producto concreto. */
  function revisarPrecioYFormato(linea: LineaOcrAlbaran, productoId: string) {
    const producto = productoPorId.get(productoId);
    if (!producto) return;

    const unidadNorm = normalizar(linea.unidad);
    const esContenedora = UNIDADES_CONTENEDORAS.includes(unidadNorm);

    // Contenedora, o unidad que no cuadra con la base del producto.
    if (esContenedora || (unidadNorm && unidadNorm !== normalizar(producto.medida))) {
      emitirFormato(linea, producto);
    }

    // Precio
    const previo = ultimoPrecio.get(productoId);
    if (previo && linea.precioUnitario !== null && previo.precio > 0) {
      const variacion = (linea.precioUnitario - previo.precio) / previo.precio;
      if (Math.abs(variacion) >= cfg.umbralDesviacionPrecio) {
        const sube = variacion > 0;
        incidencias.push({
          tipo: "precio_anomalo",
          severidad: "alta",
          lineaId: linea.id,
          titulo: `${producto.nombre} ${sube ? "sube" : "baja"} un ${Math.abs(Math.round(variacion * 100))} %`,
          explicacion:
            `Estaba a ${eur(previo.precio)} (${previo.fecha}) y ahora viene a ${eur(linea.precioUnitario)}. ` +
            (esContenedora
              ? "Ojo: puede que el precio del papel sea por caja y el nuestro por unidad."
              : "Puede ser una subida real del proveedor o un error de lectura."),
          acciones: [
            {
              clave: "aceptar_precio",
              etiqueta: "Es correcto, registrar el precio nuevo",
              propuesta: true,
              payload: { precio: linea.precioUnitario },
            },
            { clave: "corregir_precio", etiqueta: "Corregir el precio" },
            { clave: "no_registrar", etiqueta: "No registrar este precio", pideMotivo: true },
          ],
          detalle: {
            precioAnterior: previo.precio,
            precioNuevo: linea.precioUnitario,
            variacion,
            fechaAnterior: previo.fecha,
          },
        });
      }
    }

    // IVA de la línea contra el del producto
    if (linea.iva && producto.iva) {
      const ivaLinea = Number(linea.iva);
      const ivaProducto = Number(String(producto.iva).replace("%", ""));
      if (Number.isFinite(ivaLinea) && Number.isFinite(ivaProducto) && ivaLinea !== ivaProducto) {
        incidencias.push({
          tipo: "iva_incoherente",
          severidad: "media",
          lineaId: linea.id,
          titulo: `${producto.nombre} viene al ${ivaLinea} % y lo tenemos al ${ivaProducto} %`,
          explicacion:
            "El tipo de IVA del albarán no coincide con el de la ficha del producto. " +
            "Uno de los dos está mal, y afecta a lo que se declara.",
          acciones: [
            {
              clave: "usar_albaran",
              etiqueta: `Usar el del albarán (${ivaLinea} %) y corregir la ficha`,
              propuesta: true,
              payload: { iva: String(ivaLinea), actualizarProducto: true },
            },
            {
              clave: "usar_ficha",
              etiqueta: `Mantener el de la ficha (${ivaProducto} %)`,
              payload: { iva: String(ivaProducto) },
            },
          ],
          detalle: { ivaLinea, ivaProducto, producto: producto.nombre },
        });
      }
    }
  }
}

function incidenciaDiscrepancia(d: DiscrepanciaFiscal, nombreProveedor: string): Incidencia {
  const rellenar = d.veredicto === "rellenar_hueco";
  const actualizar = d.veredicto === "actualizar_ficha";

  return {
    tipo: "datos_fiscales_discrepantes",
    severidad: d.campo === "cifNif" ? "alta" : "media",
    lineaId: null,
    titulo: rellenar
      ? `Nos falta ${d.etiqueta.toLowerCase()} de ${nombreProveedor}`
      : `${d.etiqueta} de ${nombreProveedor}: el papel dice otra cosa`,
    explicacion: d.explicacion,
    acciones: [
      {
        clave: "grabar",
        etiqueta: rellenar
          ? `Grabar "${d.enDocumento}" en la ficha`
          : `Actualizar la ficha a "${d.enDocumento}"`,
        propuesta: rellenar || actualizar,
        payload: { campo: d.campo, valor: d.enDocumento },
      },
      {
        clave: "mantener",
        etiqueta: `Dejar como está${d.enFicha ? ` ("${d.enFicha}")` : ""}`,
        propuesta: !rellenar && !actualizar,
      },
    ],
    detalle: { campo: d.campo, enFicha: d.enFicha, enDocumento: d.enDocumento },
  };
}

/** "cargo" de GARCIMAR → "Portes GARCIMAR"; deja el nombre reconocible. */
function tituloGasto(nombreLinea: string, proveedor: string): string {
  const n = nombreLinea.toLowerCase();
  const base =
    n.includes("porte") || n.includes("transporte") || n.includes("cargo")
      ? "Portes"
      : n.includes("desplaz")
        ? "Desplazamiento"
        : n.includes("envase") || n.includes("casco")
          ? "Envase retornable"
          : n.includes("punto verde")
            ? "Punto verde"
            : nombreLinea.trim();
  return `${base} ${proveedor}`.trim();
}
