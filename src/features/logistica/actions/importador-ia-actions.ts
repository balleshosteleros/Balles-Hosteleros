"use server";

import { SchemaType, type Schema } from "@google/generative-ai";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import {
  UNIDADES_PRODUCTO,
  IVA_OPCIONES,
  CONSERVACION_OPCIONES,
  type TipoProducto,
} from "@/features/logistica/data/productos";
import {
  listUnidadesMedida,
  listIvas,
  listConservaciones,
} from "@/features/logistica/actions/catalogos-estandar-actions";
import type {
  AnalisisIAResultado,
  FilaSugerida,
  PayloadExtraido,
} from "@/features/logistica/types/importador-ia";

// Fallback estático si la BD aún no tiene los catálogos sembrados.
const UNIDADES_FALLBACK = UNIDADES_PRODUCTO.map((u) => u.value);
const ESTADOS_VALIDOS = ["Activo", "Inactivo"] as const;
const IVAS_FALLBACK = [...IVA_OPCIONES];
const CONSERVACIONES_FALLBACK = [...CONSERVACION_OPCIONES];

/** Límite defensivo: si el modelo intenta devolver más de esto, cortamos. */
const MAX_FILAS_POR_ANALISIS = 200;

/**
 * Construye el responseSchema dinámicamente con los catálogos actuales de la
 * empresa. Cada llamada al action reconstruye los enums frescos para que la
 * IA solo pueda devolver valores que existen hoy en BD.
 */
function buildResponseSchema(catalogos: {
  unidades: string[];
  ivas: string[];
  conservaciones: string[];
}): Schema {
  return {
  type: SchemaType.OBJECT,
  properties: {
    filas: {
      type: SchemaType.ARRAY,
      description:
        "Lista de productos detectados en el documento. Una fila por producto. " +
        "Si una columna del archivo no se puede mapear a ningún campo canónico, ignórala.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          valores: {
            type: SchemaType.OBJECT,
            description: "Valores canónicos extraídos. Usa null si el dato no aparece.",
            properties: {
              nombre: { type: SchemaType.STRING, nullable: true },
              categoria: { type: SchemaType.STRING, nullable: true },
              estado: {
                type: SchemaType.STRING,
                nullable: true,
                enum: [...ESTADOS_VALIDOS],
                format: "enum",
                description: "Solo 'Activo' o 'Inactivo'. Por defecto 'Activo'.",
              },
              proveedor: {
                type: SchemaType.STRING,
                nullable: true,
                description:
                  "Nombre del proveedor. Debe coincidir EXACTAMENTE con uno de los proveedores " +
                  "ya dados de alta en la empresa (te los paso en el prompt). Si no coincide " +
                  "con ninguno o no aparece en el documento, devuelve null. NO inventes proveedores.",
              },
              precioCompra: {
                type: SchemaType.STRING,
                nullable: true,
                description: "Precio de compra unitario como string (acepta '12,50 €/kg').",
              },
              precioVenta: { type: SchemaType.STRING, nullable: true },
              coste: { type: SchemaType.STRING, nullable: true },
              iva: {
                type: SchemaType.STRING,
                nullable: true,
                enum: catalogos.ivas,
                format: "enum",
                description: "Solo uno del enum. Null si no consta en el documento.",
              },
              unidad: {
                type: SchemaType.STRING,
                nullable: true,
                enum: catalogos.unidades,
                format: "enum",
                description:
                  "OBLIGATORIO uno de los valores del enum. Si la unidad real del documento " +
                  "no coincide con ninguno (ej. 'litro' → 'L', 'gramos' → 'kg', 'unidad'/'pieza' → 'ud'), " +
                  "normalízala. Si no puedes normalizarla con seguridad, devuelve null.",
              },
              formato: { type: SchemaType.STRING, nullable: true },
              observaciones: { type: SchemaType.STRING, nullable: true },
              conservacion: {
                type: SchemaType.STRING,
                nullable: true,
                enum: catalogos.conservaciones,
                format: "enum",
                description: "Solo uno del enum. Null si no se infiere del documento.",
              },
            },
          },
          confianza: {
            type: SchemaType.OBJECT,
            description: "Confianza 0-1 por campo. Solo incluye los que hayas rellenado.",
            properties: {
              nombre: { type: SchemaType.NUMBER, nullable: true },
              categoria: { type: SchemaType.NUMBER, nullable: true },
              estado: { type: SchemaType.NUMBER, nullable: true },
              proveedor: { type: SchemaType.NUMBER, nullable: true },
              precioCompra: { type: SchemaType.NUMBER, nullable: true },
              precioVenta: { type: SchemaType.NUMBER, nullable: true },
              coste: { type: SchemaType.NUMBER, nullable: true },
              iva: { type: SchemaType.NUMBER, nullable: true },
              unidad: { type: SchemaType.NUMBER, nullable: true },
              formato: { type: SchemaType.NUMBER, nullable: true },
              observaciones: { type: SchemaType.NUMBER, nullable: true },
              conservacion: { type: SchemaType.NUMBER, nullable: true },
            },
          },
        },
        required: ["valores"],
      },
    },
    resumen: {
      type: SchemaType.STRING,
      nullable: true,
      description:
        "Aviso global breve para el usuario: cosas raras detectadas, mezclas, " +
        "hojas múltiples, calidad baja del documento, etc. Máx 200 chars.",
    },
  },
  required: ["filas"],
  };
}

function instruccionSegunTipo(tipo: TipoProducto): string {
  switch (tipo) {
    case "compra":
      return [
        "Tipo objetivo: PRODUCTO DE COMPRA (materia prima que el restaurante compra a proveedores).",
        "Prioriza extraer: nombre, categoría (familia/grupo), proveedor, precioCompra, unidad, iva.",
        "Si ves un albarán o factura, cada línea = un producto.",
      ].join(" ");
    case "venta":
      return [
        "Tipo objetivo: PRODUCTO DE VENTA (lo que se sirve al cliente: platos, bebidas, menús).",
        "Prioriza extraer: nombre (tal cual aparece en la carta), categoría, precioVenta, coste si lo ves.",
        "Si detectas un MENÚ DEL DÍA o menú degustación, usa categoría='MENU' para distinguirlo de un plato suelto.",
        "Si la imagen es una carta/menú impreso, ignora frases decorativas y extrae solo los platos con precio.",
      ].join(" ");
    case "elaboracion":
      return [
        "Tipo objetivo: ELABORACIÓN (preparación intermedia de cocina: salsas, mises en place, sub-recetas).",
        "Prioriza extraer: nombre de la elaboración, categoría, coste estimado por porción, unidad de medida.",
      ].join(" ");
  }
}

function buildInstruccionBase(catalogos: {
  unidades: string[];
  ivas: string[];
  conservaciones: string[];
}): string {
  return `
Eres un extractor de datos especializado en escandallos y fichas de producto de un restaurante en España.

Tu tarea: leer el documento adjunto (Excel, CSV, PDF, foto de carta o albarán) y devolver una lista
estructurada de productos en formato JSON, siguiendo el schema indicado.

Reglas:
- Devuelve UN objeto por producto detectado.
- Si una celda no aparece o no se puede inferir con razonable seguridad, ponla a null. NO inventes.
- Para precios: respeta el formato original (p.ej. '12,50 €/kg' o '8.90'). No conviertas moneda.
- Para nombres y categoría: capitaliza la primera letra de cada palabra (Title Case en español).
- Para precios: respeta el formato original; cualquier variante es válida (cualquier moneda, número o texto).
- Para 'unidad': SOLO se permiten estos valores del catálogo de la empresa: ${catalogos.unidades.join(", ")}.
  Normaliza variantes comunes ("litro" → "L", "kilo"/"kilos"/"gramos" → "kg", "unidad"/"piezas"/"botellas" → "ud").
  Si no puedes mapearla con seguridad al catálogo, devuelve null (NO inventes una nueva unidad).
- Para 'iva': SOLO ${catalogos.ivas.join(", ")}. Si en el documento aparece "general" → "21%", "reducido" → "10%", "superreducido" → "4%". Si no consta, null.
- Para 'estado': SOLO 'Activo' o 'Inactivo'. Default 'Activo'.
- Para 'conservacion': SOLO ${catalogos.conservaciones.join(", ")}. Solo si el documento lo indica explícitamente.
- Para 'proveedor': SOLO valores de la lista que te paso en el prompt (proveedores ya dados de alta).
  No inventes proveedores nuevos: si no coincide con ninguno, devuelve null.
- Confianza: usa 1.0 si el valor viene literal del documento; 0.7-0.9 si lo has normalizado;
  0.4-0.6 si lo has inferido por contexto; <0.4 marca null en su lugar.
- Si detectas algo raro (varias monedas mezcladas, duplicados, hojas múltiples, calidad baja
  de foto), añádelo al campo 'resumen'.
- Idioma: español.
`.trim();
}

export interface AnalizarIAInput {
  payload: PayloadExtraido;
  tipo: TipoProducto;
  /** Proveedores ya dados de alta en la empresa. La IA solo puede usar estos. */
  proveedoresValidos?: string[];
  /** Categorías ya creadas para este tipo de producto. La IA solo puede usar estas. */
  categoriasValidas?: string[];
}

export async function analizarImportacionIA(
  input: AnalizarIAInput,
): Promise<{ error?: string; resultado?: AnalisisIAResultado }> {
  try {
    const {
      payload,
      tipo,
      proveedoresValidos = [],
      categoriasValidas = [],
    } = input;

    // Cargar catálogos vivos de la empresa. Si la BD aún no tiene catálogos
    // (empresa recién creada antes de que el trigger termine, o BD caída),
    // caemos a las constantes estáticas — la UI no se queda muda.
    const [uRes, ivaRes, conRes] = await Promise.all([
      listUnidadesMedida(),
      listIvas(),
      listConservaciones(),
    ]);
    const unidadesValidas = uRes.ok && uRes.data.length > 0
      ? uRes.data.map((u) => u.codigo)
      : [...UNIDADES_FALLBACK];
    const ivasValidos = ivaRes.ok && ivaRes.data.length > 0
      ? ivaRes.data.map((i) => i.codigo)
      : [...IVAS_FALLBACK];
    const conservacionesValidas = conRes.ok && conRes.data.length > 0
      ? conRes.data.map((c) => c.nombre)
      : [...CONSERVACIONES_FALLBACK];

    const catalogosDinamicos = {
      unidades: unidadesValidas,
      ivas: ivasValidos,
      conservaciones: conservacionesValidas,
    };

    const instruccionTipo = instruccionSegunTipo(tipo);
    const bloqueProveedores =
      proveedoresValidos.length > 0
        ? `Proveedores válidos (usa SOLO uno de estos para el campo 'proveedor'; si no encaja, null):\n${JSON.stringify(proveedoresValidos)}`
        : "No hay proveedores dados de alta en la empresa. Devuelve siempre proveedor=null.";
    const bloqueCategorias =
      categoriasValidas.length > 0
        ? `Categorías válidas para tipo='${tipo}' (usa SOLO una de estas; si la categoría real del documento no encaja con ninguna, devuelve null y NO inventes):\n${JSON.stringify(categoriasValidas)}`
        : `No hay categorías creadas para tipo='${tipo}'. Devuelve siempre categoria=null — el usuario debe crearlas antes de importar.`;

    let prompt: string;
    const attachments: Array<{ mimeType: string; base64: string }> = [];

    if (payload.kind === "tabla") {
      const muestra = payload.filas.slice(0, 200);
      prompt = [
        instruccionTipo,
        "",
        bloqueCategorias,
        "",
        bloqueProveedores,
        "",
        `Documento: ${payload.nombreArchivo}`,
        `Cabeceras detectadas en el archivo: ${JSON.stringify(payload.cabeceras)}`,
        "",
        "Filas (JSON):",
        JSON.stringify(muestra, null, 2),
        "",
        "Mapea estas filas a productos canónicos. Si la cabecera del archivo es ambigua,",
        "decide la mejor correspondencia y baja la confianza del campo afectado.",
      ].join("\n");
    } else {
      prompt = [
        instruccionTipo,
        "",
        bloqueCategorias,
        "",
        bloqueProveedores,
        "",
        `Documento adjunto: ${payload.nombreArchivo} (${payload.mimeType})`,
        "",
        "Lee el documento completo (OCR si es imagen) y extrae todos los productos.",
      ].join("\n");
      attachments.push({ mimeType: payload.mimeType, base64: payload.base64 });
    }

    const res = await geminiJSON<{
      filas?: Array<{
        valores?: Record<string, string | null>;
        confianza?: Record<string, number | null>;
      }>;
      resumen?: string | null;
    }>(prompt, {
      systemInstruction: buildInstruccionBase(catalogosDinamicos),
      responseSchema: buildResponseSchema(catalogosDinamicos),
      temperature: 0.2,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    const filasIA = Array.isArray(res.data.filas) ? res.data.filas : [];
    if (filasIA.length === 0) {
      return {
        error:
          "La IA no encontró productos en el documento. " +
          "Comprueba que es una lista de productos, un albarán o una carta legible.",
      };
    }

    const filas: FilaSugerida[] = filasIA
      .slice(0, MAX_FILAS_POR_ANALISIS)
      .map((f, idx) => {
        const valores = sanearValores(
          f.valores ?? {},
          proveedoresValidos,
          categoriasValidas,
          catalogosDinamicos,
        );
        return {
          tempId: `ia-${Date.now()}-${idx}`,
          valores,
          confianza: limpiarConfianza(f.confianza),
        };
      })
      .filter((f) => {
        // Descarta filas claramente vacías (sin nombre y sin precio).
        const tieneNombre = (f.valores.nombre ?? "").trim().length > 0;
        return tieneNombre;
      });

    if (filas.length === 0) {
      return {
        error:
          "La IA devolvió filas sin nombre de producto. Revisa que el documento contenga " +
          "una lista identificable de productos.",
      };
    }

    return {
      resultado: {
        filas,
        resumen: res.data.resumen ?? null,
        tokensInput: res.tokensInput,
        tokensOutput: res.tokensOutput,
        modelo: res.modelo,
      },
    };
  } catch (err) {
    if (err instanceof GeminiKeyMissingError) {
      return {
        error:
          "Falta configurar GEMINI_API_KEY en el servidor. Avisa al administrador.",
      };
    }
    return {
      error: err instanceof Error ? err.message : "Error desconocido al analizar.",
    };
  }
}

function limpiarConfianza(
  c?: Record<string, number | null>,
): FilaSugerida["confianza"] {
  if (!c) return {};
  const out: NonNullable<FilaSugerida["confianza"]> = {};
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === "number" && v >= 0 && v <= 1) {
      out[k as keyof typeof out] = v;
    }
  }
  return out;
}

/**
 * Defensa en profundidad: aunque el responseSchema de Gemini fuerza los enums,
 * algunos modelos los ignoran si el documento es ambiguo. Aquí descartamos
 * cualquier valor fuera del catálogo correspondiente y lo dejamos null para
 * que la UI obligue al usuario a elegir uno válido del select.
 *
 * Proveedor se compara case-insensitive contra la lista de proveedores
 * dados de alta en la empresa.
 */
function sanearValores(
  v: Record<string, string | null>,
  proveedoresValidos: string[],
  categoriasValidas: string[],
  catalogosDinamicos: { unidades: string[]; ivas: string[]; conservaciones: string[] },
): FilaSugerida["valores"] {
  const out: FilaSugerida["valores"] = { ...v };

  out.unidad = filtrarEnum(v.unidad, catalogosDinamicos.unidades);
  out.iva = filtrarEnum(v.iva, catalogosDinamicos.ivas);
  out.estado = filtrarEnum(v.estado, ESTADOS_VALIDOS);
  out.conservacion = filtrarEnum(v.conservacion, catalogosDinamicos.conservaciones);

  // Proveedor: match insensible a mayúsculas contra la lista de la empresa.
  out.proveedor = filtrarCatalogoDinamico(v.proveedor, proveedoresValidos);

  // Categoría: match insensible a mayúsculas contra el catálogo de la empresa.
  out.categoria = filtrarCatalogoDinamico(v.categoria, categoriasValidas);

  return out;
}

/** Match case-insensitive contra un catálogo dinámico de la empresa. */
function filtrarCatalogoDinamico(
  raw: string | null | undefined,
  catalogo: string[],
): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const upper = v.toUpperCase();
  const hit = catalogo.find((c) => c.toUpperCase() === upper);
  return hit ?? null;
}

function filtrarEnum(
  raw: string | null | undefined,
  catalogo: readonly string[],
): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  return (catalogo as readonly string[]).includes(v) ? v : null;
}
