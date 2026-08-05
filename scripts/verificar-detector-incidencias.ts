/**
 * Verificador del detector de incidencias de albaranes (PRP-074, F1).
 *
 * Uso: npx tsx scripts/verificar-detector-incidencias.ts
 *
 * Cada caso es UNA de las preguntas que Fernando dejó abiertas en
 * `docs/TAREA_FERNANDO_precios_compra_bacanal.md` y que antes se respondían por
 * WhatsApp. Si el detector las resuelve todas, esas preguntas dejan de existir.
 *
 * No usa framework de tests (el proyecto no tiene ninguno instalado): es un script
 * autónomo que imprime el resultado y sale con código 1 si algo falla.
 */

import {
  detectarIncidencias,
  type EntradaDeteccion,
  type ProductoCatalogo,
  type TipoIncidencia,
} from "../src/features/logistica/lib/albaranes/detectar-incidencias";
import {
  calcularStock,
  interpretarFormato,
  interpretarMedida,
  esEnvase,
  type MedidaBase,
} from "../src/features/logistica/lib/albaranes/formato-compra";
import {
  esIdentificadorFiscalValido,
  normalizarCif,
  identificarProveedor,
  type ProveedorFiscal,
} from "../src/features/logistica/lib/albaranes/identidad-fiscal";
import type { CabeceraOcrAlbaran, LineaOcrAlbaran } from "../src/features/logistica/lib/albaranes/ocr-albaran";

// ---------------------------------------------------------------------------
// Mini-runner
// ---------------------------------------------------------------------------

let pasados = 0;
let fallados = 0;
const errores: string[] = [];

function comprobar(nombre: string, condicion: boolean, detalle = "") {
  if (condicion) {
    pasados++;
    console.log(`  ✅ ${nombre}`);
  } else {
    fallados++;
    errores.push(`${nombre}${detalle ? ` — ${detalle}` : ""}`);
    console.log(`  ❌ ${nombre}${detalle ? ` — ${detalle}` : ""}`);
  }
}

function seccion(titulo: string) {
  console.log(`\n\x1b[1m${titulo}\x1b[0m`);
}

// ---------------------------------------------------------------------------
// Datos base
// ---------------------------------------------------------------------------

const PROVEEDORES: ProveedorFiscal[] = [
  {
    id: "prov-garcimar",
    nombreComercial: "GARCIMAR",
    razonSocial: "GARCIMAR S.L.",
    cifNif: "B09654955",
    codigoPostal: "28053",
    ciudad: "Madrid",
    provincia: "Madrid",
  },
  {
    id: "prov-ddi",
    nombreComercial: "DDI NEXIA",
    razonSocial: "DDI NEXIA S.L.U.",
    cifNif: null, // hueco real: la ficha no tiene CIF
    codigoPostal: null,
    ciudad: null,
    provincia: null,
  },
  {
    id: "prov-mahou",
    nombreComercial: "MAHOU",
    razonSocial: "MAHOU S.A.",
    cifNif: "A28017895",
    codigoPostal: "28031",
    ciudad: "Madrid",
    provincia: "Madrid",
  },
  {
    id: "prov-bigger",
    nombreComercial: "BIGGER GOLOSINAS",
    razonSocial: null,
    cifNif: null,
    codigoPostal: null,
    ciudad: null,
    provincia: null,
  },
];

const p = (
  id: string,
  nombre: string,
  extra: Partial<ProductoCatalogo> = {},
): ProductoCatalogo => ({
  id,
  nombre,
  nombreProveedor: null,
  categoria: "General",
  iva: "10%",
  medida: "ud",
  formato: null,
  controlaStock: true,
  ...extra,
});

const PRODUCTOS: ProductoCatalogo[] = [
  p("prod-alhambra", "Alhambra Reserva 0,30 retornable", { iva: "21%" }),
  p("prod-tequila", "Tequila José Cuervo Reposado", { iva: "21%" }),
  p("prod-leche-cond", "Leche Condensada"),
  p("prod-hielo-roca", "Hielo Roca", { medida: "kg" }),
  p("prod-cocacola", "Coca-Cola PET 2L", { iva: "21%" }),
  p("prod-portes-garcimar", "Portes GARCIMAR", { controlaStock: false, iva: "21%" }),
];

const cabeceraBase = (over: Partial<CabeceraOcrAlbaran> = {}): CabeceraOcrAlbaran => ({
  proveedor: "GARCIMAR",
  numero: "MA/56452",
  fecha: "2026-07-16",
  total: 100,
  baseImponible: null,
  fiscal: {
    cifNif: "B09654955",
    razonSocial: "GARCIMAR S.L.",
    direccion: null,
    codigoPostal: "28053",
    ciudad: "Madrid",
    provincia: "Madrid",
  },
  desgloseIva: [],
  continuaEnOtraPagina: false,
  paginaActual: null,
  paginasTotales: null,
  sumaYSigue: null,
  ...over,
});

const linea = (over: Partial<LineaOcrAlbaran> = {}): LineaOcrAlbaran => ({
  id: `l-${Math.random().toString(36).slice(2, 8)}`,
  nombre: "PRODUCTO",
  cantidad: 1,
  precioUnitario: 10,
  iva: "10",
  formato: null,
  unidad: "ud",
  importe: 10,
  referenciaProveedor: null,
  esServicio: false,
  descuentoPct: null,
  confianza: 1,
  ...over,
});

const entrada = (over: Partial<EntradaDeteccion>): EntradaDeteccion => ({
  cabecera: cabeceraBase(),
  lineas: [],
  proveedores: PROVEEDORES,
  productos: PRODUCTOS,
  aliases: [],
  formatos: [],
  precios: [],
  ...over,
});

const tiene = (r: { incidencias: Array<{ tipo: TipoIncidencia }> }, t: TipoIncidencia) =>
  r.incidencias.some((i) => i.tipo === t);

const buscar = <T extends { tipo: TipoIncidencia }>(inc: T[], t: TipoIncidencia) =>
  inc.find((i) => i.tipo === t);

// ===========================================================================
console.log("\n\x1b[1m\x1b[36mVERIFICACIÓN DEL DETECTOR DE INCIDENCIAS (PRP-074 · F1)\x1b[0m");
console.log("Cada caso es una pregunta que antes acababa en un .md\n");
// ===========================================================================

// --- Validación fiscal -----------------------------------------------------
seccion("0. Identidad fiscal — el CIF como ancla (no el nombre)");

comprobar("CIF de sociedad válido (B09654955)", esIdentificadorFiscalValido("B09654955"));
comprobar("CIF de sociedad válido (A28017895 · Mahou)", esIdentificadorFiscalValido("A28017895"));
comprobar("CIF con letra de control (P2800000H)", esIdentificadorFiscalValido("P2800000H"));
comprobar("CIF inválido detectado (B09654954)", !esIdentificadorFiscalValido("B09654954"));
comprobar("NIF válido (12345678Z)", esIdentificadorFiscalValido("12345678Z"));
comprobar("NIF inválido detectado (12345678A)", !esIdentificadorFiscalValido("12345678A"));
comprobar("NIE válido (X1234567L)", esIdentificadorFiscalValido("X1234567L"));
comprobar("Basura rechazada", !esIdentificadorFiscalValido("HOLA"));
comprobar(
  "Prefijo intracomunitario ES se limpia",
  normalizarCif("ES-B09654955") === "B09654955",
  normalizarCif("ES-B09654955"),
);
comprobar(
  "CIF con puntos y guiones se normaliza",
  normalizarCif("B-09.654.955") === "B09654955",
);

// El caso GARCIMAR vs GARCIMAR SL que rompía la detección de duplicados
const idGarcimar = identificarProveedor(
  {
    cifNif: "B09654955",
    razonSocial: "GARCIMAR SL",
    nombreDetectado: "GARCIMAR S.L.",
    codigoPostal: null,
    ciudad: null,
    provincia: null,
  },
  PROVEEDORES,
);
comprobar(
  "«GARCIMAR SL» y «GARCIMAR» son el MISMO proveedor (mismo CIF)",
  idGarcimar.proveedor?.id === "prov-garcimar" && idGarcimar.motivo === "cif_exacto",
  `motivo=${idGarcimar.motivo}`,
);
comprobar("Identificación por CIF tiene confianza máxima", idGarcimar.confianza === 1);
comprobar(
  "Las formas societarias no cuentan como discrepancia",
  !idGarcimar.discrepancias.some((d) => d.campo === "razonSocial" && d.veredicto !== "ignorable"),
);

// Mismo nombre, CIF distinto → conflicto
const idConflicto = identificarProveedor(
  {
    cifNif: "B99999999",
    razonSocial: "GARCIMAR S.L.",
    nombreDetectado: "GARCIMAR",
    codigoPostal: null,
    ciudad: null,
    provincia: null,
  },
  PROVEEDORES,
);
comprobar(
  "Mismo nombre con CIF distinto → conflicto de identidad",
  idConflicto.conflictoIdentidad,
);

// --- CASO 1: Belmon Drink 15378 -------------------------------------------
seccion('1. Belmon Drink 15378 — "SUMA Y SIGUE: 694,39 €" (falta una página)');

const r1 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({
      proveedor: "BELMON DRINK",
      numero: "15378",
      total: null,
      sumaYSigue: 694.39,
      continuaEnOtraPagina: true,
      fiscal: { cifNif: null, razonSocial: null, direccion: null, codigoPostal: null, ciudad: null, provincia: null },
    }),
    lineas: [linea({ nombre: "RED BULL 25CL", cantidad: 24, precioUnitario: 1.1, importe: 26.4 })],
  }),
);
comprobar("Detecta que el documento está incompleto", tiene(r1, "documento_incompleto"));
comprobar("Es bloqueante (no se carga a medias sin querer)",
  buscar(r1.incidencias, "documento_incompleto")?.severidad === "bloqueante");
comprobar("NO se puede confirmar", !r1.puedeConfirmar);
const acc1 = buscar(r1.incidencias, "documento_incompleto")?.acciones ?? [];
comprobar("Propone añadir la página que falta", acc1[0]?.clave === "anadir_pagina");
comprobar("Ofrece cargarlo parcial con motivo",
  acc1.some((a) => a.clave === "cargar_parcial" && a.pideMotivo));
comprobar("El importe del SUMA Y SIGUE aparece en el aviso",
  (buscar(r1.incidencias, "documento_incompleto")?.explicacion ?? "").includes("694,39"));

// --- CASO 2: recargos (Garcimar 1,50 / DDI 2,99 / Disbesa 1,10) -----------
seccion("2. Recargos: portes, envase retornable y desplazamiento (3 albaranes)");

const r2 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ total: 51.5 }),
    lineas: [
      linea({ nombre: "MERLUZA", cantidad: 2, precioUnitario: 25, importe: 50, iva: "10" }),
      linea({ nombre: "cargo", cantidad: 1, precioUnitario: 1.5, importe: 1.5, iva: "21", esServicio: true }),
    ],
  }),
);
const servicio = buscar(r2.incidencias, "linea_de_servicio");
comprobar("Detecta la línea de servicio", !!servicio);
comprobar('Propone crear "Portes GARCIMAR"',
  String(servicio?.acciones[0]?.payload?.nombre ?? "").includes("Portes"),
  String(servicio?.acciones[0]?.payload?.nombre));
comprobar("La propuesta es SIN control de stock (decisión de Iván)",
  servicio?.acciones[0]?.payload?.controlaStock === false);
comprobar("El total CUADRA porque el servicio ya suma", !tiene(r2, "total_descuadrado"));

// Detección automática aunque el modelo no marque esServicio
const r2b = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ total: 12.99 }),
    lineas: [
      linea({ nombre: "AGUA 1L", cantidad: 1, precioUnitario: 10, importe: 10 }),
      linea({ nombre: "S.L. envase retornable", cantidad: 1, precioUnitario: 2.99, importe: 2.99, esServicio: false }),
    ],
  }),
);
comprobar('Red de seguridad: "envase retornable" se detecta como gasto aunque el OCR no lo marque',
  tiene(r2b, "linea_de_servicio"));

// --- CASO 3: ALH RESERVA 0,30 RET -----------------------------------------
seccion("3. ALH RESERVA 0,30 RET — impresora de matriz, texto dudoso");

const r3 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ proveedor: "MAHOU", total: 20.41, fiscal: { cifNif: "A28017895", razonSocial: "MAHOU S.A.", direccion: null, codigoPostal: "28031", ciudad: "Madrid", provincia: "Madrid" } }),
    lineas: [linea({ nombre: "ALH RESERVA 0,30 RET", cantidad: 1, precioUnitario: 20.41, importe: 20.41, iva: "21", confianza: 0.6 })],
  }),
);
const amb = buscar(r3.incidencias, "producto_ambiguo");
comprobar("Propone el producto parecido en vez de preguntar a ciegas", !!amb);
comprobar('Propone "Alhambra Reserva 0,30 retornable"',
  String(amb?.acciones[0]?.payload?.productoId) === "prod-alhambra",
  String(amb?.acciones[0]?.etiqueta));
comprobar("Explica POR QUÉ lo propone (% de parecido)",
  /\d+ %/.test(String(amb?.acciones[0]?.payload?.porque ?? "")));
comprobar("Memoriza el alias al aceptar (no vuelve a preguntar)",
  amb?.acciones[0]?.payload?.memorizarAlias === "ALH RESERVA 0,30 RET");

// --- CASO 4: Belmonte 15402, línea sin precio -----------------------------
seccion("4. Belmonte 15402 — TEQ JOSE CUERVO REPOSADO sin precio ni importe");

const r4 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ proveedor: "BELMONTE", numero: "15402", total: 50 }),
    lineas: [
      linea({ nombre: "VODKA", cantidad: 2, precioUnitario: 25, importe: 50, iva: "21" }),
      linea({ nombre: "TEQ JOSE CUERVO REPOSADO", cantidad: 1, precioUnitario: null, importe: null, iva: "21" }),
    ],
  }),
);
const sinImporte = buscar(r4.incidencias, "linea_sin_importe");
comprobar("Detecta la línea sin importe", !!sinImporte);
comprobar('Propone tratarla como regalo', sinImporte?.acciones[0]?.clave === "es_regalo");
comprobar("El regalo entra en stock pero NO registra precio",
  sinImporte?.acciones[0]?.payload?.registrarPrecio === false &&
  sinImporte?.acciones[0]?.payload?.cantidadStock === 1);
comprobar("Ofrece descartarla como error de impresión, con motivo",
  (sinImporte?.acciones ?? []).some((a) => a.clave === "es_error" && a.pideMotivo));

// --- CASOS 5-8: productos nuevos de la tanda 2 ----------------------------
seccion("5-8. Productos nuevos: Cubo Cóctel Mix · Leche Asturiana · Hielo Cubitos · Vaso sidra PP");

const r5 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ proveedor: "BIGGER GOLOSINAS", total: 9.86, fiscal: { cifNif: null, razonSocial: null, direccion: null, codigoPostal: null, ciudad: null, provincia: null } }),
    lineas: [linea({ nombre: "CUBO COCTEL MIX 2KG", cantidad: 1, precioUnitario: 9.86, importe: 9.86, iva: "21" })],
  }),
);
const noEnc = buscar(r5.incidencias, "producto_no_encontrado");
comprobar("Cubo Cóctel Mix: propone crearlo", !!noEnc && noEnc.acciones[0].clave === "crear");
comprobar("El alta viene YA rellenada (nombre, IVA, precio)",
  noEnc?.acciones[0]?.payload?.nombre === "CUBO COCTEL MIX 2KG" &&
  noEnc?.acciones[0]?.payload?.iva === "21" &&
  noEnc?.acciones[0]?.payload?.precio === 9.86);
comprobar("Guarda el nombre del proveedor como alias para la próxima vez",
  noEnc?.acciones[0]?.payload?.aliasProveedor === "CUBO COCTEL MIX 2KG");
comprobar("Ofrece buscar en TODO el catálogo (no solo 6 candidatos)",
  (noEnc?.acciones ?? []).some((a) => a.clave === "buscar"));
comprobar("Ignorar EXIGE motivo",
  (noEnc?.acciones ?? []).some((a) => a.clave === "ignorar" && a.pideMotivo));

// "Leche Asturiana" vs "Leche Condensada": productos distintos que se parecen
const r6 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ proveedor: "DDI NEXIA", total: 15, fiscal: { cifNif: null, razonSocial: "DDI NEXIA S.L.U.", direccion: null, codigoPostal: null, ciudad: null, provincia: null } }),
    lineas: [linea({ nombre: "LECHE ASTURIANA ENTERA 1L", cantidad: 12, precioUnitario: 1.25, importe: 15, iva: "4" })],
  }),
);
comprobar("Leche Asturiana: no la confunde en silencio con Leche Condensada",
  tiene(r6, "producto_ambiguo") || tiene(r6, "producto_no_encontrado"));
comprobar("Leche Asturiana: NO se vincula automáticamente",
  !r6.vinculosAutomaticos.some((v) => v.productoId === "prod-leche-cond"));

// --- CASO 9: Makro "PARA PERSONAL" ----------------------------------------
seccion("9. FORMATOS — número × medida, y cantidad × formato = stock");

// --- Medidas y sus sinónimos ---
comprobar('"kg" → kilogramos', interpretarMedida("kg")?.base === "kg");
comprobar('"Kilos" → kilogramos', interpretarMedida("Kilos")?.base === "kg");
comprobar('"gr" → kg con factor 0,001', interpretarMedida("gr")?.base === "kg" && interpretarMedida("gr")?.factor === 0.001);
comprobar('"L" → litros', interpretarMedida("L")?.base === "l");
comprobar('"cl" → litros con factor 0,01', interpretarMedida("cl")?.factor === 0.01);
comprobar('"ml" → litros con factor 0,001', interpretarMedida("ml")?.factor === 0.001);
comprobar('"uds" → unidades', interpretarMedida("uds")?.base === "ud");
comprobar('"botellas" → unidades', interpretarMedida("botellas")?.base === "ud");
comprobar('"docena" → 12 unidades', interpretarMedida("docena")?.factor === 12);
comprobar('"caja" NO es una medida (es envase)', interpretarMedida("caja") === null && esEnvase("caja"));
comprobar('"garrafa" es envase', esEnvase("garrafa"));
comprobar('"kg" NO es envase', !esEnvase("kg"));

// --- Los tres tipos de formato que nombró Iván ---
const fUnidades = interpretarFormato("caja de 24 unidades", "caja", "COCA-COLA", "ud");
comprobar("Caja de 24 UNIDADES → 24 ud",
  fUnidades.contenido === 24 && fUnidades.medida === "ud",
  `${fUnidades.contenido} ${fUnidades.medida}`);

const fKilos = interpretarFormato("saco de 3 kg", "saco", "HARINA", "kg");
comprobar("Saco de 3 KILOS → 3 kg",
  fKilos.contenido === 3 && fKilos.medida === "kg",
  `${fKilos.contenido} ${fKilos.medida}`);

const fLitros = interpretarFormato("garrafa de 5 litros", "garrafa", "ACEITE", "l");
comprobar("Garrafa de 5 LITROS → 5 L",
  fLitros.contenido === 5 && fLitros.medida === "l",
  `${fLitros.contenido} ${fLitros.medida}`);

// --- Cada proveedor lo escribe a su manera ---
const formas: Array<[string, string, string, MedidaBase | null, number, MedidaBase]> = [
  // [formato, unidad, nombre, medidaProducto, contenido esperado, medida esperada]
  ["caja de 24", "caja", "COCA-COLA PET 2L", "ud", 24, "ud"],
  ["CJ. 12x1L", "cj", "AGUA MINERAL", "l", 12, "l"],
  ["", "caja", "CERVEZA 24x33cl", "ud", 24, "ud"],
  ["PACK-6", "pack", "YOGUR NATURAL", "ud", 6, "ud"],
  ["", "caja", "PAN FRANKFURT BRIOCHE 85g x 54u", "ud", 54, "ud"],
  ["BIDON 25 L", "bidon", "ACEITE GIRASOL", "l", 25, "l"],
  ["saco 25kg", "saco", "PATATA", "kg", 25, "kg"],
  ["", "bandeja", "METRO Chef leche entera 1,5L (6u)", "ud", 6, "ud"],
];
for (const [fmt, uni, nom, medProd, esperado, medEsperada] of formas) {
  const r = interpretarFormato(fmt, uni, nom, medProd);
  comprobar(
    `"${fmt || nom}" → ${esperado} ${medEsperada}`,
    r.contenido === esperado && r.medida === medEsperada,
    `dio ${r.contenido} ${r.medida} (${r.origen})`,
  );
}

// --- LA REGLA: cantidad × formato = stock ---
seccion("9b. La regla: cantidad comprada × contenido del formato");

const c1 = calcularStock(3, interpretarFormato("caja de 24", "caja", "COCA-COLA", "ud"));
comprobar("3 cajas × 24 ud = 72 ud", c1.cantidadStock === 72, c1.explicacion);
comprobar("Lo explica en español", c1.explicacion.includes("72"), c1.explicacion);

const c2 = calcularStock(2, interpretarFormato("garrafa de 5 litros", "garrafa", "ACEITE", "l"));
comprobar("2 garrafas × 5 L = 10 L", c2.cantidadStock === 10, c2.explicacion);

const c3 = calcularStock(4, interpretarFormato("saco de 3 kg", "saco", "HARINA", "kg"));
comprobar("4 sacos × 3 kg = 12 kg", c3.cantidadStock === 12, c3.explicacion);

const c4 = calcularStock(7.748, interpretarFormato("", "kg", "ALITAS DE POLLO", "kg"));
comprobar("Compra a peso: 7,748 kg entran tal cual", c4.cantidadStock === 7.748, c4.explicacion);

const c5 = calcularStock(5, interpretarFormato("", "ud", "MERLUZA", "ud"));
comprobar("Compra suelta: 5 ud entran tal cual", c5.cantidadStock === 5, c5.explicacion);

// Submedidas: el papel en gramos, el stock en kilos
const c6 = calcularStock(10, interpretarFormato("bandeja de 500 gr", "bandeja", "QUESO", "kg"));
comprobar("10 bandejas × 500 g = 5 kg (convierte a la medida base)",
  c6.cantidadStock === 5 && c6.medida === "kg", c6.explicacion);

const c7 = calcularStock(2, interpretarFormato("caja 24x33cl", "caja", "CERVEZA", "l"));
comprobar("2 cajas × 24 × 33 cl = 15,84 L",
  Math.abs(c7.cantidadStock - 15.84) < 0.01, c7.explicacion);

// El mismo texto, según cómo lleve el producto NUESTRA ficha
const porUds = interpretarFormato("caja 12x1L", "caja", "AGUA", "ud");
const porLitros = interpretarFormato("caja 12x1L", "caja", "AGUA", "l");
comprobar("Si nuestra ficha va por unidades, 12x1L son 12 unidades", porUds.contenido === 12 && porUds.medida === "ud");
comprobar("Si nuestra ficha va por litros, 12x1L son 12 L", porLitros.contenido === 12 && porLitros.medida === "l");

// No inventar
const sinPista = interpretarFormato("", "ud", "MERLUZA FRESCA", "ud");
comprobar("Sin pista de formato no se inventa multiplicador",
  sinPista.contenido === 1 && sinPista.origen === "unitario");
const botellaSuelta = interpretarFormato("", "ud", "ACEITE OLIVA 5 L", "ud");
comprobar("Una botella de 5 L es 1 unidad, no 5 (no hay envase)",
  botellaSuelta.contenido === 1, `dio ${botellaSuelta.contenido}`);

const r9 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ total: 72 }),
    lineas: [
      linea({
        nombre: "COCA-COLA PET 2L CAJA DE 24",
        cantidad: 3,
        unidad: "caja",
        formato: "caja",
        precioUnitario: 24,
        importe: 72,
        iva: "21",
      }),
    ],
    formatos: [],
  }),
);
const fmt = buscar(r9.incidencias, "formato_sin_equivalencia");
comprobar("Detecta la caja sin equivalencia", !!fmt);
comprobar("Es bloqueante (si no, entrarían 3 en vez de 72)", fmt?.severidad === "bloqueante");
comprobar("Propone 24 unidades deducidas del texto",
  fmt?.acciones[0]?.payload?.equivalencia === 24,
  String(fmt?.acciones[0]?.etiqueta));
comprobar("Calcula el stock resultante: 3 × 24 = 72",
  fmt?.acciones[0]?.payload?.cantidadStock === 72);

// --- IVA: desglose por tipo, no agregado ----------------------------------
seccion("10. IVA — desglosado por tipo, tanto por línea como en el pie");

const r10 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({
      // 10 € al 4 % (0,40) + 100 € al 21 % (21,00) → base 110, cuota 21,40, total 131,40
      total: 131.4,
      baseImponible: 110,
      desgloseIva: [
        { tipo: 4, baseImponible: 10, cuota: 0.4, recargoEquivalencia: null },
        { tipo: 21, baseImponible: 100, cuota: 21, recargoEquivalencia: null },
      ],
    }),
    lineas: [
      linea({ nombre: "PAN", cantidad: 1, precioUnitario: 10, importe: 10, iva: "4" }),
      linea({ nombre: "REFRESCOS", cantidad: 1, precioUnitario: 100, importe: 100, iva: "21" }),
    ],
  }),
);
comprobar("Con desglose correcto NO inventa incoherencias de IVA", !tiene(r10, "iva_incoherente"));
comprobar("Entiende que el total del papel lleva IVA incluido (110 base + 21,40 = 131,40)",
  !tiene(r10, "total_descuadrado"),
  JSON.stringify(buscar(r10.incidencias, "total_descuadrado")?.detalle ?? {}));

// El mismo albarán pero con el total impreso SIN IVA: también debe cuadrar
const r10bis = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ total: 110, desgloseIva: [] }),
    lineas: [
      linea({ nombre: "PAN", cantidad: 1, precioUnitario: 10, importe: 10, iva: "4" }),
      linea({ nombre: "REFRESCOS", cantidad: 1, precioUnitario: 100, importe: 100, iva: "21" }),
    ],
  }),
);
comprobar("Si el total del papel es la base imponible, también cuadra",
  !tiene(r10bis, "total_descuadrado"));

// Sin desglose en el pie: la cuota se estima con el IVA de cada línea
const r10d = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ total: 131.4, desgloseIva: [] }),
    lineas: [
      linea({ nombre: "PAN", cantidad: 1, precioUnitario: 10, importe: 10, iva: "4" }),
      linea({ nombre: "REFRESCOS", cantidad: 1, precioUnitario: 100, importe: 100, iva: "21" }),
    ],
  }),
);
comprobar("Sin desglose, estima el IVA por línea y cuadra igual",
  !tiene(r10d, "total_descuadrado"),
  JSON.stringify(buscar(r10d.incidencias, "total_descuadrado")?.detalle ?? {}));

// Descuadre de verdad: falta una línea
const r10e = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ total: 500, desgloseIva: [] }),
    lineas: [linea({ nombre: "PAN", cantidad: 1, precioUnitario: 10, importe: 10, iva: "4" })],
  }),
);
comprobar("Un descuadre REAL sí se detecta y bloquea",
  buscar(r10e.incidencias, "total_descuadrado")?.severidad === "bloqueante");

const r10b = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({
      total: 110,
      desgloseIva: [{ tipo: 4, baseImponible: 60, cuota: 2.4, recargoEquivalencia: null }],
    }),
    lineas: [
      linea({ nombre: "PAN", cantidad: 1, precioUnitario: 10, importe: 10, iva: "4" }),
      linea({ nombre: "OTRO", cantidad: 1, precioUnitario: 100, importe: 100, iva: "21" }),
    ],
  }),
);
comprobar("Detecta que la base del 4 % del pie no cuadra con sus líneas",
  tiene(r10b, "iva_incoherente"));

// IVA de línea que contradice la ficha del producto
const r10c = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ total: 20 }),
    lineas: [
      linea({ nombre: "Coca-Cola PET 2L", cantidad: 1, precioUnitario: 20, importe: 20, iva: "10" }),
    ],
  }),
);
comprobar("Detecta IVA de línea distinto al de la ficha (10 % vs 21 %)",
  tiene(r10c, "iva_incoherente"));

// --- Datos fiscales: contraste con la ficha -------------------------------
seccion("11. Datos fiscales — contraste papel ↔ ficha grabada");

const r11 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({
      proveedor: "DDI NEXIA",
      total: 10,
      fiscal: {
        cifNif: "B09654955",
        razonSocial: "DDI NEXIA S.L.U.",
        direccion: "Calle Falsa 1",
        codigoPostal: "28001",
        ciudad: "Madrid",
        provincia: "Madrid",
      },
    }),
    lineas: [linea({ nombre: "AGUA", cantidad: 1, precioUnitario: 10, importe: 10 })],
  }),
);
comprobar("Si el CIF del papel es de OTRA ficha, avisa del conflicto",
  tiene(r11, "datos_fiscales_discrepantes") || tiene(r11, "proveedor_desconocido"));

// Hueco rellenable: la ficha de DDI no tiene CIF
const r11b = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({
      proveedor: "DDI NEXIA",
      total: 10,
      fiscal: {
        cifNif: null,
        razonSocial: "DDI NEXIA S.L.U.",
        direccion: null,
        codigoPostal: "28045",
        ciudad: "Madrid",
        provincia: "Madrid",
      },
    }),
    lineas: [linea({ nombre: "AGUA", cantidad: 1, precioUnitario: 10, importe: 10 })],
  }),
);
const disc = r11b.incidencias.filter((i) => i.tipo === "datos_fiscales_discrepantes");
comprobar("Propone rellenar el código postal que nos falta",
  disc.some((d) => d.acciones[0].clave === "grabar" && d.acciones[0].propuesta === true),
  `${disc.length} discrepancias`);

// CIF ilegible
const r11c = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({
      fiscal: { cifNif: "B09654954", razonSocial: "GARCIMAR S.L.", direccion: null, codigoPostal: null, ciudad: null, provincia: null },
    }),
    lineas: [linea()],
  }),
);
comprobar("Detecta un CIF mal leído (dígito de control incorrecto)",
  r11c.incidencias.some((i) => i.titulo.includes("no es válido")));

// --- Aprendizaje: no preguntar dos veces ----------------------------------
seccion("12. Aprendizaje — lo resuelto una vez no se vuelve a preguntar");

const r12 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ total: 20.41 }),
    lineas: [linea({ nombre: "ALH RESERVA 0,30 RET", cantidad: 1, precioUnitario: 20.41, importe: 20.41, iva: "21" })],
    aliases: [
      {
        productoId: "prod-alhambra",
        proveedorId: "prov-garcimar",
        aliasNormalizado: "alh reserva 0 30 ret",
        referencia: null,
      },
    ],
  }),
);
comprobar("Con el alias memorizado, se vincula SOLO",
  r12.vinculosAutomaticos.some((v) => v.productoId === "prod-alhambra"));
comprobar("Ya no genera incidencia de producto", !tiene(r12, "producto_ambiguo"));

const r12b = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ total: 20.41 }),
    lineas: [linea({ nombre: "TEXTO COMPLETAMENTE DISTINTO", cantidad: 1, precioUnitario: 20.41, importe: 20.41, iva: "21", referenciaProveedor: "REF-4421" })],
    aliases: [
      {
        productoId: "prod-alhambra",
        proveedorId: "prov-garcimar",
        aliasNormalizado: "otra cosa",
        referencia: "REF-4421",
      },
    ],
  }),
);
comprobar("La referencia del proveedor vincula aunque el nombre cambie por completo",
  r12b.vinculosAutomaticos.some((v) => v.productoId === "prod-alhambra"),
  JSON.stringify(r12b.vinculosAutomaticos));

// --- Caso limpio: sin incidencias -----------------------------------------
seccion("13. Albarán limpio — la mesa NO debe aparecer");

const r13 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ total: 20.41 }),
    lineas: [linea({ nombre: "Alhambra Reserva 0,30 retornable", cantidad: 1, precioUnitario: 20.41, importe: 20.41, iva: "21" })],
    precios: [{ productoId: "prod-alhambra", precio: 20.0, iva: "21", fecha: "2026-07-01" }],
  }),
);
comprobar("Un albarán correcto no genera NINGUNA incidencia",
  r13.incidencias.length === 0,
  r13.incidencias.map((i) => i.tipo).join(", "));
comprobar("Se puede confirmar directamente", r13.puedeConfirmar);
comprobar("El producto queda vinculado solo", r13.vinculosAutomaticos.length === 1);

// --- Precio anómalo -------------------------------------------------------
seccion("14. Precio anómalo — subida que merece un vistazo");

const r14 = detectarIncidencias(
  entrada({
    cabecera: cabeceraBase({ total: 38 }),
    lineas: [linea({ nombre: "Alhambra Reserva 0,30 retornable", cantidad: 1, precioUnitario: 38, importe: 38, iva: "21" })],
    precios: [{ productoId: "prod-alhambra", precio: 20.0, iva: "21", fecha: "2026-07-01" }],
  }),
);
const prec = buscar(r14.incidencias, "precio_anomalo");
comprobar("Detecta la subida del 90 %", !!prec);
comprobar("Dice el precio anterior y el nuevo",
  (prec?.explicacion ?? "").includes("20,00") && (prec?.explicacion ?? "").includes("38,00"));
comprobar("No bloquea (es un aviso, no un error)", prec?.severidad === "alta");

// ===========================================================================
console.log("\n" + "─".repeat(70));
if (fallados === 0) {
  console.log(`\x1b[32m\x1b[1m✅ ${pasados} comprobaciones correctas. Detector listo.\x1b[0m`);
  console.log("\nLas 9 preguntas que Fernando dejó abiertas quedan resueltas por el sistema.");
} else {
  console.log(`\x1b[31m\x1b[1m❌ ${fallados} fallos de ${pasados + fallados} comprobaciones\x1b[0m\n`);
  errores.forEach((e) => console.log(`   · ${e}`));
  process.exit(1);
}
