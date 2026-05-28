/**
 * Catálogo central de módulos y submódulos del sistema.
 *
 * IMPORTANTE: Esta lista debe coincidir 1:1 con el sidebar (app-sidebar.tsx).
 * Cada submódulo del menú lateral aparece aquí exactamente con el mismo
 * nombre. Nunca se fusionan dos submódulos en una entrada.
 *
 * Cada submódulo declara:
 *   - Lista de campos del formulario "Nuevo" (con label visible)
 *   - Qué campos exige cada modo preset (basico / estandar / avanzado)
 *
 * Los submódulos cuyo formulario aún no existe aparecen con `placeholder: true`
 * y `campos: []` — la UI los muestra como "PRÓXIMAMENTE".
 */

export type ModoReglas = "basico" | "estandar" | "avanzado" | "personalizado";

/** Centinela usado en la columna `submodulo` para marcar la regla a nivel módulo. */
export const REGLA_MODULO_SENTINEL = "*";

export type ReglaSubmoduloRow = {
  id: string;
  empresa_id: string;
  modulo: string;
  /** '*' significa que la regla aplica a todo el módulo (no a un submódulo concreto). */
  submodulo: string;
  modo: ModoReglas;
  campos_obligatorios: string[];
  created_at: string;
  updated_at: string;
};

export interface CampoSubmodulo {
  key: string;
  label: string;
}

export interface SubmoduloDef {
  /** Slug interno, ej: 'empleados', 'proveedores' */
  key: string;
  /** Nombre visible en la UI — DEBE coincidir con el sidebar */
  label: string;
  /** Campos del formulario "Nuevo" — vacío si todavía no hay formulario */
  campos: CampoSubmodulo[];
  /** Campos exigidos en cada modo preset (subconjunto de campos.keys) */
  presets: {
    basico: string[];
    estandar: string[];
    avanzado: string[];
  };
  /** Si true, este submódulo todavía no tiene "Nuevo" funcional — UI muestra placeholder */
  placeholder?: boolean;
}

export interface ModuloDef {
  /** Slug interno, ej: 'rrhh' */
  key: string;
  /** Nombre visible (mismo que el departamento) */
  label: string;
  submodulos: SubmoduloDef[];
}

// ============================================================
// Helpers
// ============================================================

function todos(campos: CampoSubmodulo[]): string[] {
  return campos.map((c) => c.key);
}

const PLACEHOLDER_PRESETS = { basico: [], estandar: [], avanzado: [] };

function placeholder(key: string, label: string): SubmoduloDef {
  return { key, label, campos: [], presets: PLACEHOLDER_PRESETS, placeholder: true };
}

// ============================================================
// Definición de campos por submódulo (solo para los que tienen "Nuevo")
// ============================================================

const CAMPOS_EMPLEADOS: CampoSubmodulo[] = [
  { key: "full_name", label: "Nombre completo" },
  { key: "email", label: "Email" },
  { key: "password", label: "Contraseña" },
  { key: "role", label: "Rol" },
];

const CAMPOS_RECLUTAMIENTO: CampoSubmodulo[] = [
  { key: "titulo", label: "Título" },
  { key: "departamento_id", label: "Departamento" },
  { key: "puesto_id", label: "Puesto" },
  { key: "ubicacion", label: "Ubicación" },
  { key: "tipo_jornada", label: "Tipo de jornada" },
  { key: "salario_rango", label: "Rango salarial" },
  { key: "descripcion", label: "Descripción" },
  { key: "estado_publicacion", label: "Estado de publicación" },
];

const CAMPOS_PROVEEDORES: CampoSubmodulo[] = [
  { key: "nombreComercial", label: "Nombre comercial" },
  { key: "razonSocial", label: "Razón social" },
  { key: "cifNif", label: "CIF / NIF" },
  { key: "categoria", label: "Categoría" },
  { key: "personaContacto", label: "Persona de contacto" },
  { key: "telefonoPrincipal", label: "Teléfono principal" },
  { key: "emailPrincipal", label: "Email principal" },
  { key: "emailPedidos", label: "Email de pedidos" },
  { key: "direccion", label: "Dirección" },
  { key: "ciudad", label: "Ciudad" },
  { key: "codigoPostal", label: "Código postal" },
  { key: "viaPago", label: "Vía de pago" },
  { key: "plazoPago", label: "Plazo de pago" },
];

const CAMPOS_PEDIDOS: CampoSubmodulo[] = [
  { key: "proveedor", label: "Proveedor" },
  { key: "lineas", label: "Líneas de pedido" },
  { key: "almacen", label: "Almacén destino" },
  { key: "fecha_entrega", label: "Fecha de entrega prevista" },
  { key: "observaciones", label: "Observaciones" },
];

const CAMPOS_INVENTARIOS: CampoSubmodulo[] = [
  { key: "nombre", label: "Nombre del inventario" },
  { key: "almacen", label: "Almacén" },
  { key: "fecha", label: "Fecha del recuento" },
  { key: "responsable", label: "Responsable" },
];

const CAMPOS_ESCANDALLOS: CampoSubmodulo[] = [
  { key: "nombre", label: "Nombre del plato" },
  { key: "categoria", label: "Categoría" },
  { key: "destino", label: "Destino (cocina/sala)" },
  { key: "descripcion", label: "Descripción" },
  { key: "tiempo", label: "Tiempo de preparación" },
  { key: "pvp", label: "PVP" },
  { key: "elaboracion", label: "Elaboración" },
  { key: "ingredientes", label: "Ingredientes (al menos 1)" },
];

const CAMPOS_PRODUCTOS: CampoSubmodulo[] = [
  { key: "nombre", label: "Nombre del producto" },
  { key: "tipo", label: "Tipo (compra/venta/elaboración)" },
  { key: "categoria", label: "Categoría" },
  { key: "unidad", label: "Unidad de medida" },
  { key: "proveedor", label: "Proveedor" },
  { key: "precioCompra", label: "Precio de compra" },
  { key: "precioVenta", label: "Precio de venta" },
  { key: "iva", label: "IVA" },
  { key: "formato", label: "Formato" },
  { key: "conservacion", label: "Conservación" },
];

const CAMPOS_CONTACTOS: CampoSubmodulo[] = [
  { key: "nombre", label: "Nombre o razón social" },
  { key: "tipo", label: "Tipo (cliente / acreedor)" },
  { key: "nif", label: "NIF / CIF" },
  { key: "email", label: "Email" },
  { key: "telefono", label: "Teléfono" },
  { key: "direccion", label: "Dirección fiscal" },
];

const CAMPOS_NUEVAS_RECETAS: CampoSubmodulo[] = [
  { key: "nombre", label: "Nombre de la receta" },
  { key: "descripcion", label: "Descripción" },
  { key: "destino", label: "Destino" },
  { key: "tiempo", label: "Tiempo" },
  { key: "pvp", label: "PVP" },
  { key: "elaboracion", label: "Elaboración" },
  { key: "ingredientes", label: "Ingredientes" },
];

const CAMPOS_COMUNICADOS: CampoSubmodulo[] = [
  { key: "titulo", label: "Título" },
  { key: "asunto", label: "Asunto" },
  { key: "cuerpo", label: "Mensaje" },
  { key: "prioridad", label: "Prioridad" },
  { key: "estado", label: "Estado" },
  { key: "envioFecha", label: "Fecha de envío" },
];

const CAMPOS_PRESENTACIONES_DIRECCION: CampoSubmodulo[] = [
  { key: "prompt", label: "Tema / descripción" },
  { key: "audiencia", label: "Audiencia" },
  { key: "numSlides", label: "Nº de diapositivas" },
  { key: "tono", label: "Tono" },
  { key: "idioma", label: "Idioma" },
];

const CAMPOS_PROCESOS_JURIDICOS: CampoSubmodulo[] = [
  { key: "titulo", label: "Título" },
  { key: "tipo", label: "Tipo" },
  { key: "juridico", label: "Responsable jurídico" },
  { key: "fecha", label: "Fecha" },
  { key: "estado", label: "Estado" },
  { key: "gravedad", label: "Gravedad" },
  { key: "descripcion", label: "Descripción" },
];

// ============================================================
// CATÁLOGO — refleja el sidebar 1:1
// ============================================================

export const CATALOGO: ModuloDef[] = [
  // ─── DIRECCIÓN ─────────────────────────────────────────────
  {
    key: "direccion",
    label: "DIRECCIÓN",
    submodulos: [
      placeholder("organigrama", "Organigrama"),
      placeholder("cronogramas", "Cronogramas"),
      placeholder("documentacion", "Documentación"),
      placeholder("aperturas", "Aperturas"),
      {
        key: "presentaciones",
        label: "Presentaciones",
        campos: CAMPOS_PRESENTACIONES_DIRECCION,
        presets: {
          basico: ["prompt"],
          estandar: ["prompt", "numSlides", "idioma"],
          avanzado: todos(CAMPOS_PRESENTACIONES_DIRECCION),
        },
      },
    ],
  },

  // ─── SALA ──────────────────────────────────────────────────
  {
    key: "sala",
    label: "SALA",
    submodulos: [
      placeholder("pos", "Punto de Venta"),
      placeholder("tarifas", "Tarifas"),
      placeholder("reservas", "Reservas"),
      placeholder("clientes", "Clientes"),
    ],
  },

  // ─── COCINA ────────────────────────────────────────────────
  {
    key: "cocina",
    label: "COCINA",
    submodulos: [
      placeholder("comandas", "Comandas"),
      {
        key: "nuevas_recetas",
        label: "Nuevas recetas",
        campos: CAMPOS_NUEVAS_RECETAS,
        presets: {
          basico: ["nombre"],
          estandar: ["nombre", "destino", "pvp"],
          avanzado: todos(CAMPOS_NUEVAS_RECETAS),
        },
      },
      {
        key: "escandallos",
        label: "Escandallos",
        campos: CAMPOS_ESCANDALLOS,
        presets: {
          basico: ["nombre", "categoria", "ingredientes"],
          estandar: ["nombre", "categoria", "ingredientes", "destino", "pvp"],
          avanzado: todos(CAMPOS_ESCANDALLOS),
        },
      },
      placeholder("elaboraciones", "Elaboraciones"),
      placeholder("partidas", "Partidas"),
      placeholder("temperaturas", "Temperaturas"),
    ],
  },

  // ─── LOGÍSTICA ─────────────────────────────────────────────
  {
    key: "logistica",
    label: "LOGÍSTICA",
    submodulos: [
      {
        key: "proveedores",
        label: "Proveedores",
        campos: CAMPOS_PROVEEDORES,
        presets: {
          basico: ["nombreComercial"],
          estandar: ["nombreComercial", "cifNif", "emailPedidos"],
          avanzado: todos(CAMPOS_PROVEEDORES),
        },
      },
      {
        key: "productos",
        label: "Productos",
        campos: CAMPOS_PRODUCTOS,
        presets: {
          basico: ["nombre", "tipo", "categoria"],
          estandar: ["nombre", "tipo", "categoria", "unidad", "iva"],
          avanzado: todos(CAMPOS_PRODUCTOS),
        },
      },
      {
        key: "pedidos",
        label: "Pedidos",
        campos: CAMPOS_PEDIDOS,
        presets: {
          basico: ["proveedor"],
          estandar: ["proveedor", "lineas", "fecha_entrega"],
          avanzado: todos(CAMPOS_PEDIDOS),
        },
      },
      placeholder("stock", "Stock"),
      {
        key: "inventarios",
        label: "Inventarios",
        campos: CAMPOS_INVENTARIOS,
        presets: {
          basico: ["nombre"],
          estandar: ["nombre", "almacen", "fecha"],
          avanzado: todos(CAMPOS_INVENTARIOS),
        },
      },
    ],
  },

  // ─── GERENCIA ──────────────────────────────────────────────
  {
    key: "gerencia",
    label: "GERENCIA",
    submodulos: [
      placeholder("mantenimiento", "Mantenimiento"),
      placeholder("revisiones", "Revisiones"),
      placeholder("cierres", "Cierres"),
      placeholder("descuentos", "Descuentos"),
      placeholder("ratios", "Ratios"),
      {
        key: "comunicados",
        label: "Comunicados",
        campos: CAMPOS_COMUNICADOS,
        presets: {
          basico: ["titulo"],
          estandar: ["titulo", "asunto", "cuerpo"],
          avanzado: todos(CAMPOS_COMUNICADOS),
        },
      },
      placeholder("encuestas", "Encuestas"),
    ],
  },

  // ─── RECURSOS HUMANOS ──────────────────────────────────────
  {
    key: "rrhh",
    label: "RECURSOS HUMANOS",
    submodulos: [
      {
        key: "empleados",
        label: "Empleados",
        campos: CAMPOS_EMPLEADOS,
        presets: {
          basico: ["full_name"],
          estandar: ["full_name", "email", "role"],
          avanzado: todos(CAMPOS_EMPLEADOS),
        },
      },
      placeholder("fichajes", "Fichajes"),
      placeholder("solicitudes", "Solicitudes"),
      placeholder("firmas", "Firmas"),
      placeholder("calendarios", "Calendarios"),
      placeholder("horarios", "Horarios"),
      {
        key: "reclutamiento",
        label: "Reclutamiento",
        campos: CAMPOS_RECLUTAMIENTO,
        presets: {
          basico: ["titulo"],
          estandar: ["titulo", "departamento_id", "puesto_id", "descripcion"],
          avanzado: todos(CAMPOS_RECLUTAMIENTO),
        },
      },
      placeholder("boarding", "Boarding"),
      placeholder("bonus", "Bonus"),
      placeholder("points", "Points"),
      placeholder("pagos", "Pagos"),
      placeholder("formacion", "Formación"),
      placeholder("encuestas", "Encuestas"),
    ],
  },

  // ─── MARKETING ─────────────────────────────────────────────
  {
    key: "marketing",
    label: "MARKETING",
    submodulos: [
      placeholder("calendario", "Calendario"),
      placeholder("contenido", "Contenido"),
      placeholder("campanas", "Campañas"),
      placeholder("carta_digital", "Carta digital"),
      placeholder("pagina_web", "Página web"),
      placeholder("fidelizacion", "Fidelización"),
      placeholder("captacion", "Captación"),
    ],
  },

  // ─── CONTABILIDAD ──────────────────────────────────────────
  {
    key: "contabilidad",
    label: "CONTABILIDAD",
    submodulos: [
      {
        key: "contactos",
        label: "Contactos",
        campos: CAMPOS_CONTACTOS,
        presets: {
          basico: ["nombre", "tipo"],
          estandar: ["nombre", "tipo", "nif", "email"],
          avanzado: todos(CAMPOS_CONTACTOS),
        },
      },
      placeholder("facturas", "Facturas"),
      placeholder("impuestos", "Impuestos"),
      placeholder("transacciones", "Transacciones"),
      placeholder("conciliacion", "Conciliación"),
      placeholder("calendario", "Calendario"),
      placeholder("escenarios", "Escenarios"),
      placeholder("bancos", "Bancos"),
      placeholder("etiquetas", "Etiquetas"),
      placeholder("reglas_automaticas", "Reglas automáticas"),
    ],
  },

  // ─── CALIDAD ───────────────────────────────────────────────
  {
    key: "calidad",
    label: "CALIDAD",
    submodulos: [
      placeholder("auditorias", "Auditorías"),
      placeholder("cuestionarios", "Cuestionarios"),
      placeholder("clientes", "Clientes"),
      placeholder("inspecciones", "Inspecciones"),
    ],
  },

  // ─── GESTORÍA ──────────────────────────────────────────────
  {
    key: "gestoria",
    label: "GESTORÍA",
    submodulos: [
      placeholder("modelos", "Modelos"),
      placeholder("presentaciones", "Presentaciones"),
    ],
  },

  // ─── JURÍDICO ──────────────────────────────────────────────
  {
    key: "juridico",
    label: "JURÍDICO",
    submodulos: [
      {
        key: "procesos",
        label: "Procesos",
        campos: CAMPOS_PROCESOS_JURIDICOS,
        presets: {
          basico: ["titulo"],
          estandar: ["titulo", "tipo", "fecha", "estado"],
          avanzado: todos(CAMPOS_PROCESOS_JURIDICOS),
        },
      },
    ],
  },
];

// ============================================================
// Lookups
// ============================================================

export function getModulo(moduloKey: string): ModuloDef | undefined {
  return CATALOGO.find((m) => m.key === moduloKey);
}

export function getSubmodulo(
  moduloKey: string,
  submoduloKey: string,
): SubmoduloDef | undefined {
  return getModulo(moduloKey)?.submodulos.find((s) => s.key === submoduloKey);
}

/** Devuelve el slug de módulo a partir del nombre del departamento (ej: "RECURSOS HUMANOS" → "rrhh"). */
export function moduloKeyDesdeNombreDept(nombre: string): string | null {
  const norm = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
  const match = CATALOGO.find((m) => {
    const labelNorm = m.label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase();
    return labelNorm === norm;
  });
  return match?.key ?? null;
}

/** Devuelve los campos exigidos para un submódulo según el modo elegido. */
export function camposExigidos(
  submodulo: SubmoduloDef,
  modo: ModoReglas,
  camposPersonalizados: string[],
): string[] {
  if (modo === "personalizado") return camposPersonalizados;
  return submodulo.presets[modo];
}

/**
 * Submódulos que admiten estado "Borrador" porque son objetivo de la
 * Migración con IA del onboarding. El resto del software NO permite
 * registros incompletos: o se crean con TODO o no se crean.
 */
export const SUBMODULOS_MIGRABLES: ReadonlyArray<{ modulo: string; submodulo: string }> = [
  { modulo: "logistica", submodulo: "productos" },
  { modulo: "logistica", submodulo: "proveedores" },
  { modulo: "rrhh", submodulo: "empleados" },
  { modulo: "contabilidad", submodulo: "contactos" },
  { modulo: "cocina", submodulo: "escandallos" },
];

export function esSubmoduloMigrable(moduloKey: string, submoduloKey: string): boolean {
  return SUBMODULOS_MIGRABLES.some(
    (s) => s.modulo === moduloKey && s.submodulo === submoduloKey,
  );
}
