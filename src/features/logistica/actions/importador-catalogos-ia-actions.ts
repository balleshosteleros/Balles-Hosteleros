"use server";

import { SchemaType, type Schema } from "@google/generative-ai";
import { geminiJSON, GeminiKeyMissingError } from "@/lib/ia/gemini";
import type { TipoProducto } from "@/features/logistica/data/productos";
import type { PayloadExtraido } from "@/features/logistica/types/importador-ia";
import type {
  AnalisisCatalogoResultado,
  FilaCatalogoSugerida,
} from "@/features/logistica/types/importador-catalogo-ia";
import {
  createCategoriaProducto,
} from "@/features/logistica/actions/categorias-producto-actions";
import {
  createCategoriaProveedor,
  listCategoriasProveedor,
} from "@/features/logistica/actions/categorias-proveedor-actions";
import {
  bulkImportProveedores,
  listProveedores,
} from "@/features/logistica/actions/proveedores-actions";
import {
  createUnidadMedida,
  createIva,
  createConservacion,
} from "@/features/logistica/actions/catalogos-estandar-actions";
import type { ProveedorImport } from "@/features/logistica/types/import";

const MAX_FILAS_POR_ANALISIS = 200;

/* ── INSTRUCCIONES BASE COMUNES ─────────────────────────────────── */

const INSTRUCCION_BASE_CATALOGOS = `
Eres un extractor de datos especializado en catálogos de un restaurante en España.

Tu tarea: leer el documento adjunto (Excel, CSV, PDF, foto) y devolver una lista
estructurada de registros en JSON, siguiendo el schema indicado.

Reglas generales:
- Devuelve UN objeto por registro detectado.
- Si una celda no aparece, ponla a null. NO inventes datos.
- Para nombres: capitaliza la primera letra de cada palabra (Title Case).
- Confianza: 1.0 si el valor viene literal, 0.7-0.9 si lo has normalizado,
  0.4-0.6 si lo has inferido, <0.4 marca null.
- Si detectas algo raro, dilo en 'resumen' (max 200 chars).
- Idioma: español.
`.trim();

/* ═══════════════════════════════════════════════════════════════════
   CATEGORÍAS DE PRODUCTO
   ═════════════════════════════════════════════════════════════════ */

const SCHEMA_CATEGORIAS_NOMBRE: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    filas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          valores: {
            type: SchemaType.OBJECT,
            properties: {
              nombre: { type: SchemaType.STRING, nullable: true },
            },
          },
          confianza: {
            type: SchemaType.OBJECT,
            properties: {
              nombre: { type: SchemaType.NUMBER, nullable: true },
            },
          },
        },
        required: ["valores"],
      },
    },
    resumen: { type: SchemaType.STRING, nullable: true },
  },
  required: ["filas"],
};

export async function analizarCategoriasProductoIA(
  payload: PayloadExtraido,
  tipo: TipoProducto,
): Promise<{ error?: string; resultado?: AnalisisCatalogoResultado }> {
  return analizarCatalogoSimple(payload, {
    schema: SCHEMA_CATEGORIAS_NOMBRE,
    contexto: `Estás extrayendo CATEGORÍAS DE PRODUCTO DE ${tipo.toUpperCase()} (familias para agrupar productos en logística). ` +
      `Ejemplos típicos: Carnes, Pescados, Verduras, Bebidas, Lácteos, Conservas, etc. ` +
      `Una sola palabra o frase corta por categoría. No incluyas el producto en sí, solo la categoría/familia.`,
    deduplicarPorKey: "nombre",
  });
}

export async function guardarCategoriasProductoIA(
  rows: Array<Record<string, string | null>>,
  tipo: TipoProducto,
): Promise<{ error?: string; imported?: number }> {
  try {
    let ok = 0;
    const errores: string[] = [];
    for (const row of rows) {
      const nombre = (row.nombre ?? "").trim();
      if (!nombre) continue;
      const res = await createCategoriaProducto({ tipo, nombre });
      if (res.ok) ok++;
      else errores.push(`"${nombre}": ${res.error}`);
    }
    if (ok === 0 && errores.length > 0) {
      return { error: `Ninguna categoría se importó. Primer error: ${errores[0]}` };
    }
    return { imported: ok };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   CATEGORÍAS DE PROVEEDOR
   ═════════════════════════════════════════════════════════════════ */

export async function analizarCategoriasProveedorIA(
  payload: PayloadExtraido,
): Promise<{ error?: string; resultado?: AnalisisCatalogoResultado }> {
  return analizarCatalogoSimple(payload, {
    schema: SCHEMA_CATEGORIAS_NOMBRE,
    contexto: `Estás extrayendo CATEGORÍAS DE PROVEEDOR (clasificaciones del tipo de proveedor). ` +
      `Ejemplos típicos: Cárnicos, Pescadería, Bebidas, Limpieza, Menaje, Productos secos. ` +
      `No incluyas nombres de proveedores específicos, solo la categoría/familia genérica.`,
    deduplicarPorKey: "nombre",
  });
}

export async function guardarCategoriasProveedorIA(
  rows: Array<Record<string, string | null>>,
): Promise<{ error?: string; imported?: number }> {
  try {
    let ok = 0;
    const errores: string[] = [];
    for (const row of rows) {
      const nombre = (row.nombre ?? "").trim();
      if (!nombre) continue;
      const res = await createCategoriaProveedor({ nombre });
      if (res.ok) ok++;
      else errores.push(`"${nombre}": ${res.error}`);
    }
    if (ok === 0 && errores.length > 0) {
      return { error: `Ninguna categoría se importó. Primer error: ${errores[0]}` };
    }
    return { imported: ok };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   PROVEEDORES (multi-campo)
   ═════════════════════════════════════════════════════════════════ */

const SCHEMA_PROVEEDORES: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    filas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          valores: {
            type: SchemaType.OBJECT,
            properties: {
              nombreComercial: { type: SchemaType.STRING, nullable: true },
              categoria: {
                type: SchemaType.STRING,
                nullable: true,
                description:
                  "Debe coincidir con una categoría de proveedor existente (te las paso en el prompt). Si no encaja, null.",
              },
              razonSocial: { type: SchemaType.STRING, nullable: true },
              cifNif: { type: SchemaType.STRING, nullable: true },
              personaContacto: { type: SchemaType.STRING, nullable: true },
              telefonoPrincipal: { type: SchemaType.STRING, nullable: true },
              emailPrincipal: { type: SchemaType.STRING, nullable: true },
              emailPedidos: { type: SchemaType.STRING, nullable: true },
              direccion: { type: SchemaType.STRING, nullable: true },
              ciudad: { type: SchemaType.STRING, nullable: true },
              codigoPostal: { type: SchemaType.STRING, nullable: true },
              web: { type: SchemaType.STRING, nullable: true },
              observaciones: { type: SchemaType.STRING, nullable: true },
            },
          },
          confianza: {
            type: SchemaType.OBJECT,
            properties: {
              nombreComercial: { type: SchemaType.NUMBER, nullable: true },
              categoria: { type: SchemaType.NUMBER, nullable: true },
              razonSocial: { type: SchemaType.NUMBER, nullable: true },
              cifNif: { type: SchemaType.NUMBER, nullable: true },
              personaContacto: { type: SchemaType.NUMBER, nullable: true },
              telefonoPrincipal: { type: SchemaType.NUMBER, nullable: true },
              emailPrincipal: { type: SchemaType.NUMBER, nullable: true },
              emailPedidos: { type: SchemaType.NUMBER, nullable: true },
              direccion: { type: SchemaType.NUMBER, nullable: true },
              ciudad: { type: SchemaType.NUMBER, nullable: true },
              codigoPostal: { type: SchemaType.NUMBER, nullable: true },
              web: { type: SchemaType.NUMBER, nullable: true },
              observaciones: { type: SchemaType.NUMBER, nullable: true },
            },
          },
        },
        required: ["valores"],
      },
    },
    resumen: { type: SchemaType.STRING, nullable: true },
  },
  required: ["filas"],
};

export async function analizarProveedoresIA(
  payload: PayloadExtraido,
): Promise<{ error?: string; resultado?: AnalisisCatalogoResultado }> {
  try {
    // Cargar catálogos vivos de la empresa (categorías y proveedores existentes
    // para deduplicar y dar contexto a la IA).
    const [categoriasRes, proveedoresRes] = await Promise.all([
      listCategoriasProveedor(),
      listProveedores(),
    ]);
    const categoriasValidas = categoriasRes.ok ? categoriasRes.data.map((c) => c.nombre) : [];
    const proveedoresExistentes = proveedoresRes.ok
      ? proveedoresRes.data
          .map((p) => p.nombre_comercial)
          .filter((n): n is string => typeof n === "string" && n.length > 0)
      : [];

    const bloqueCategorias =
      categoriasValidas.length > 0
        ? `Categorías de proveedor válidas (usa SOLO una; si no encaja, null):\n${JSON.stringify(categoriasValidas)}`
        : "No hay categorías de proveedor creadas. Devuelve siempre categoria=null — el usuario debe crearlas antes.";

    const bloqueDuplicados =
      proveedoresExistentes.length > 0
        ? `Proveedores ya dados de alta (NO los incluyas en la lista — solo nuevos):\n${JSON.stringify(proveedoresExistentes)}`
        : "Aún no hay proveedores dados de alta.";

    const promptInstruccion = [
      "Estás extrayendo PROVEEDORES de un restaurante.",
      "Por cada proveedor: nombre comercial (obligatorio, lo guardamos en MAYÚSCULAS), categoría (del catálogo abajo),",
      "y opcionalmente persona de contacto, teléfonos, emails (principal/pedidos), dirección, web, observaciones.",
      "Si un teléfono o email viene listado como genérico/centralita, ponlo en 'principal'.",
      "Si ves explícitamente 'pedidos@...' o similar, ponlo en 'emailPedidos'.",
    ].join(" ");

    let prompt: string;
    const attachments: Array<{ mimeType: string; base64: string }> = [];

    if (payload.kind === "tabla") {
      const muestra = payload.filas.slice(0, 200);
      prompt = [
        promptInstruccion,
        "",
        bloqueCategorias,
        "",
        bloqueDuplicados,
        "",
        `Documento: ${payload.nombreArchivo}`,
        `Cabeceras detectadas: ${JSON.stringify(payload.cabeceras)}`,
        "",
        "Filas (JSON):",
        JSON.stringify(muestra, null, 2),
      ].join("\n");
    } else {
      prompt = [
        promptInstruccion,
        "",
        bloqueCategorias,
        "",
        bloqueDuplicados,
        "",
        `Documento adjunto: ${payload.nombreArchivo} (${payload.mimeType})`,
        "Lee el documento (OCR si es imagen) y extrae todos los proveedores.",
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
      systemInstruction: INSTRUCCION_BASE_CATALOGOS,
      responseSchema: SCHEMA_PROVEEDORES,
      temperature: 0.2,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    const filasIA = Array.isArray(res.data.filas) ? res.data.filas : [];

    // Sanear: categoría contra catálogo + descarte si nombre vacío o ya existe.
    const upperCatSet = new Set(categoriasValidas.map((c) => c.toUpperCase()));
    const upperProvSet = new Set(proveedoresExistentes.map((p) => p.toUpperCase()));

    const filas: FilaCatalogoSugerida[] = filasIA
      .slice(0, MAX_FILAS_POR_ANALISIS)
      .map((f, idx) => {
        const v = f.valores ?? {};
        const categoria = (v.categoria ?? "").trim();
        const categoriaValida = categoria
          ? categoriasValidas.find((c) => c.toUpperCase() === categoria.toUpperCase()) ?? null
          : null;
        const valores: Record<string, string | null> = {
          ...(v as Record<string, string | null>),
          categoria: categoriaValida,
        };
        return {
          tempId: `ia-${Date.now()}-${idx}`,
          valores,
          confianza: limpiarConfianza(f.confianza),
        };
      })
      .filter((f) => {
        const nombre = (f.valores.nombreComercial ?? "").trim();
        if (!nombre) return false;
        // Descartar si ya está dado de alta en la empresa.
        return !upperProvSet.has(nombre.toUpperCase());
      });
    // Anota: dejamos saber a la IA que categoría se ha saneado.
    void upperCatSet;

    if (filas.length === 0) {
      return {
        error:
          "La IA no encontró proveedores nuevos. Comprueba que el documento contiene una lista de proveedores y que no están todos ya dados de alta.",
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
      return { error: "Falta configurar GEMINI_API_KEY en el servidor." };
    }
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export async function guardarProveedoresIA(
  rows: Array<Record<string, string | null>>,
): Promise<{ error?: string; imported?: number }> {
  try {
    const payload: ProveedorImport[] = rows
      .filter((r) => (r.nombreComercial ?? "").trim() && (r.categoria ?? "").trim())
      .map((r) => ({
        nombreComercial: r.nombreComercial!.trim(),
        categoria: r.categoria!.trim(),
        razonSocial: r.razonSocial ?? null,
        cifNif: r.cifNif ?? null,
        personaContacto: r.personaContacto ?? null,
        telefonoPrincipal: r.telefonoPrincipal ?? null,
        emailPrincipal: r.emailPrincipal ?? null,
        emailPedidos: r.emailPedidos ?? null,
        direccion: r.direccion ?? null,
        ciudad: r.ciudad ?? null,
        codigoPostal: r.codigoPostal ?? null,
        web: r.web ?? null,
        observaciones: r.observaciones ?? null,
      }));

    if (payload.length === 0) {
      return { error: "Ninguna fila tiene nombre comercial + categoría." };
    }

    const res = await bulkImportProveedores(payload);
    if (!res.ok) return { error: res.error };
    return { imported: res.imported };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   UNIDADES DE MEDIDA  (campos: codigo, label)
   ═════════════════════════════════════════════════════════════════ */

const SCHEMA_UNIDADES: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    filas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          valores: {
            type: SchemaType.OBJECT,
            properties: {
              codigo: { type: SchemaType.STRING, nullable: true },
              label: { type: SchemaType.STRING, nullable: true },
            },
          },
          confianza: {
            type: SchemaType.OBJECT,
            properties: {
              codigo: { type: SchemaType.NUMBER, nullable: true },
              label: { type: SchemaType.NUMBER, nullable: true },
            },
          },
        },
        required: ["valores"],
      },
    },
    resumen: { type: SchemaType.STRING, nullable: true },
  },
  required: ["filas"],
};

export async function analizarUnidadesIA(payload: PayloadExtraido) {
  return analizarCatalogoSimple(payload, {
    schema: SCHEMA_UNIDADES,
    contexto:
      "Estás extrayendo UNIDADES DE MEDIDA. " +
      "Para cada una: 'codigo' (forma corta: kg, L, ud, g, ml…) y 'label' (etiqueta visible: Kg, L, Ud…). " +
      "Si la unidad es ambigua o no encaja con una unidad de medida estándar, devuélvela igualmente pero baja la confianza.",
    deduplicarPorKey: "codigo",
  });
}

export async function guardarUnidadesIA(rows: Array<Record<string, string | null>>) {
  return bulkCreate(rows, (r) => {
    const codigo = (r.codigo ?? "").trim();
    if (!codigo) return null;
    return createUnidadMedida({ codigo, label: (r.label ?? codigo).trim() });
  });
}

/* ═══════════════════════════════════════════════════════════════════
   IVAS  (campos: codigo, porcentaje, label?)
   ═════════════════════════════════════════════════════════════════ */

const SCHEMA_IVAS: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    filas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          valores: {
            type: SchemaType.OBJECT,
            properties: {
              codigo: { type: SchemaType.STRING, nullable: true },
              porcentaje: { type: SchemaType.STRING, nullable: true },
              label: { type: SchemaType.STRING, nullable: true },
            },
          },
          confianza: {
            type: SchemaType.OBJECT,
            properties: {
              codigo: { type: SchemaType.NUMBER, nullable: true },
              porcentaje: { type: SchemaType.NUMBER, nullable: true },
              label: { type: SchemaType.NUMBER, nullable: true },
            },
          },
        },
        required: ["valores"],
      },
    },
    resumen: { type: SchemaType.STRING, nullable: true },
  },
  required: ["filas"],
};

export async function analizarIvasIA(payload: PayloadExtraido) {
  return analizarCatalogoSimple(payload, {
    schema: SCHEMA_IVAS,
    contexto:
      "Estás extrayendo TIPOS DE IVA. " +
      "Para cada uno: 'codigo' (ej: '0%','4%','10%','21%'), 'porcentaje' como número en texto (ej: '0','4','10','21'), " +
      "y 'label' (ej: 'Exento','Superreducido','Reducido','General'). " +
      "Si el documento solo da porcentaje, deriva el código y el label tú.",
    deduplicarPorKey: "codigo",
  });
}

export async function guardarIvasIA(rows: Array<Record<string, string | null>>) {
  return bulkCreate(rows, (r) => {
    const codigo = (r.codigo ?? "").trim();
    const porcentajeRaw = (r.porcentaje ?? "").trim().replace(",", ".");
    const porcentaje = parseFloat(porcentajeRaw);
    if (!codigo || !Number.isFinite(porcentaje)) return null;
    return createIva({ codigo, porcentaje, label: r.label?.trim() || undefined });
  });
}

/* ═══════════════════════════════════════════════════════════════════
   CONSERVACIONES  (campos: nombre, rangoTemp?)
   ═════════════════════════════════════════════════════════════════ */

const SCHEMA_CONSERVACIONES: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    filas: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          valores: {
            type: SchemaType.OBJECT,
            properties: {
              nombre: { type: SchemaType.STRING, nullable: true },
              rangoTemp: { type: SchemaType.STRING, nullable: true },
            },
          },
          confianza: {
            type: SchemaType.OBJECT,
            properties: {
              nombre: { type: SchemaType.NUMBER, nullable: true },
              rangoTemp: { type: SchemaType.NUMBER, nullable: true },
            },
          },
        },
        required: ["valores"],
      },
    },
    resumen: { type: SchemaType.STRING, nullable: true },
  },
  required: ["filas"],
};

export async function analizarConservacionesIA(payload: PayloadExtraido) {
  return analizarCatalogoSimple(payload, {
    schema: SCHEMA_CONSERVACIONES,
    contexto:
      "Estás extrayendo modos de CONSERVACIÓN/almacenaje de alimentos (zonas APPCC). " +
      "Para cada uno: 'nombre' (Congelación, Refrigeración, Ambiente, Caliente, etc.) " +
      "y opcionalmente 'rangoTemp' (ej: '< -18 °C', '0–8 °C', '15–25 °C', '> 65 °C').",
    deduplicarPorKey: "nombre",
  });
}

export async function guardarConservacionesIA(rows: Array<Record<string, string | null>>) {
  return bulkCreate(rows, (r) => {
    const nombre = (r.nombre ?? "").trim();
    if (!nombre) return null;
    return createConservacion({ nombre, rangoTemp: r.rangoTemp?.trim() || undefined });
  });
}

/* ═══════════════════════════════════════════════════════════════════
   HELPER bulkCreate genérico (usado por todos los guardarXxxIA simples)
   ═════════════════════════════════════════════════════════════════ */

async function bulkCreate(
  rows: Array<Record<string, string | null>>,
  factory: (row: Record<string, string | null>) => Promise<{ ok: boolean; error?: string }> | null,
): Promise<{ error?: string; imported?: number }> {
  try {
    let ok = 0;
    const errores: string[] = [];
    for (const row of rows) {
      const op = factory(row);
      if (!op) continue;
      const res = await op;
      if (res.ok) ok++;
      else errores.push(res.error ?? "Error desconocido");
    }
    if (ok === 0 && errores.length > 0) {
      return { error: `Ningún registro se importó. Primer error: ${errores[0]}` };
    }
    return { imported: ok };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   HELPER GENÉRICO para catálogos (un campo o varios, segun schema)
   ═════════════════════════════════════════════════════════════════ */

interface AnalisisCatalogoSimpleConfig {
  schema: Schema;
  contexto: string;
  deduplicarPorKey: string;
}

async function analizarCatalogoSimple(
  payload: PayloadExtraido,
  cfg: AnalisisCatalogoSimpleConfig,
): Promise<{ error?: string; resultado?: AnalisisCatalogoResultado }> {
  try {
    let prompt: string;
    const attachments: Array<{ mimeType: string; base64: string }> = [];

    if (payload.kind === "tabla") {
      const muestra = payload.filas.slice(0, 200);
      prompt = [
        cfg.contexto,
        "",
        `Documento: ${payload.nombreArchivo}`,
        `Cabeceras detectadas: ${JSON.stringify(payload.cabeceras)}`,
        "",
        "Filas (JSON):",
        JSON.stringify(muestra, null, 2),
      ].join("\n");
    } else {
      prompt = [
        cfg.contexto,
        "",
        `Documento adjunto: ${payload.nombreArchivo} (${payload.mimeType})`,
        "Lee el documento y extrae solo los valores únicos del catálogo solicitado.",
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
      systemInstruction: INSTRUCCION_BASE_CATALOGOS,
      responseSchema: cfg.schema,
      temperature: 0.2,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    const filasIA = Array.isArray(res.data.filas) ? res.data.filas : [];

    // Dedup case-insensitive por la key indicada.
    const vistos = new Set<string>();
    const filas: FilaCatalogoSugerida[] = [];
    filasIA.slice(0, MAX_FILAS_POR_ANALISIS).forEach((f, idx) => {
      const valor = (f.valores?.[cfg.deduplicarPorKey] ?? "").trim();
      if (!valor) return;
      const lower = valor.toLowerCase();
      if (vistos.has(lower)) return;
      vistos.add(lower);
      filas.push({
        tempId: `ia-${Date.now()}-${idx}`,
        valores: (f.valores ?? {}) as Record<string, string | null>,
        confianza: limpiarConfianza(f.confianza),
      });
    });

    if (filas.length === 0) {
      return { error: "La IA no encontró registros únicos en el documento." };
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
      return { error: "Falta configurar GEMINI_API_KEY en el servidor." };
    }
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

function limpiarConfianza(
  c?: Record<string, number | null>,
): Record<string, number> {
  if (!c) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === "number" && v >= 0 && v <= 1) out[k] = v;
  }
  return out;
}
