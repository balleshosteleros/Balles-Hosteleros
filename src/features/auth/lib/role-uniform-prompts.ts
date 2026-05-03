/**
 * Mapeo de rol/puesto laboral → descripción de uniforme corporativo.
 * Se usa para componer el prompt enviado a Gemini Image.
 *
 * El emparejamiento es por palabras clave en el rol (case-insensitive),
 * porque rol_label es texto libre y puestos_trabajo.nombre es libre por empresa.
 */

interface UniformeRol {
  /** Etiqueta humana del rol (para debug/logs). */
  label: string;
  /** Palabras clave que disparan este rol (lowercased, sin tildes). */
  keywords: string[];
  /** Descripción visual del uniforme y entorno. */
  uniforme: string;
}

const UNIFORMES: UniformeRol[] = [
  {
    label: "Director / CEO",
    keywords: ["director", "ceo", "dueno", "dueño", "gerente general", "fundador"],
    uniforme:
      "traje sastre azul marino impecable, camisa blanca planchada, corbata sobria, postura confiada y profesional, fondo de despacho elegante con luz cálida",
  },
  {
    label: "Gerencia",
    keywords: ["gerencia", "gerente", "manager", "responsable general", "encargado general"],
    uniforme:
      "americana azul marino sobre camisa blanca, sin corbata, expresión accesible, fondo de oficina moderna",
  },
  {
    label: "Jefe de cocina / Chef",
    keywords: ["jefe de cocina", "chef", "cocinero ejecutivo", "head chef"],
    uniforme:
      "chaquetilla blanca de chef ejecutivo doble botonadura, gorro alto blanco, mandil blanco, fondo de cocina profesional con acero inoxidable y luz cálida",
  },
  {
    label: "Cocinero / Pinche",
    keywords: ["cocinero", "cocina", "pinche", "ayudante de cocina", "partida", "segundo de cocina"],
    uniforme:
      "chaquetilla blanca de cocinero, gorro de cocina blanco, paño al cinto, fondo de cocina industrial limpia",
  },
  {
    label: "Maître / Jefe de sala",
    keywords: ["maitre", "maître", "jefe de sala", "responsable de sala"],
    uniforme:
      "traje negro elegante con camisa blanca y pajarita o corbata fina, postura impecable, fondo de comedor de restaurante con iluminación cálida",
  },
  {
    label: "Camarero / Camarera",
    keywords: ["camarero", "camarera", "sala", "barra", "mesero", "mesera", "barman", "bartender"],
    uniforme:
      "camisa blanca planchada con delantal corto negro de camarero, pajarita o corbata fina negra, paño al brazo, fondo de comedor cálido",
  },
  {
    label: "Recepción / Hostess",
    keywords: ["recepcion", "recepción", "hostess", "anfitrion", "anfitriona", "atencion al cliente"],
    uniforme:
      "camisa blanca con chaleco oscuro entallado, sonrisa profesional, fondo de hall de entrada de restaurante elegante",
  },
  {
    label: "Limpieza / Mantenimiento",
    keywords: ["limpieza", "mantenimiento", "tecnico", "técnico"],
    uniforme:
      "polo gris oscuro corporativo limpio, postura amable, fondo neutro de zona de servicio",
  },
  {
    label: "RRHH / Administración",
    keywords: ["rrhh", "recursos humanos", "administracion", "administración", "contabilidad", "contable", "office", "oficina"],
    uniforme:
      "camisa blanca con americana gris claro, expresión amable y profesional, fondo de oficina con luz natural",
  },
];

const UNIFORME_DEFAULT =
  "polo blanco corporativo limpio y planchado, postura profesional, fondo neutro cálido";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Devuelve la descripción del uniforme apropiado para un rol dado.
 * Si no encuentra match, usa el uniforme por defecto.
 */
export function uniformeParaRol(rol: string | null | undefined): { label: string; uniforme: string } {
  if (!rol || !rol.trim()) return { label: "Empleado", uniforme: UNIFORME_DEFAULT };
  const normalized = normalize(rol);
  for (const entry of UNIFORMES) {
    if (entry.keywords.some((kw) => normalized.includes(kw))) {
      return { label: entry.label, uniforme: entry.uniforme };
    }
  }
  return { label: rol, uniforme: UNIFORME_DEFAULT };
}

/**
 * Construye el prompt completo para Gemini Image.
 * Asume que se pasarán dos imágenes: [0] foto real del empleado, [1] logo opcional.
 */
export function buildUniformePrompt(rol: string | null | undefined, conLogo: boolean): string {
  const { uniforme } = uniformeParaRol(rol);
  const partes = [
    "Genera un retrato profesional fotorrealista de la persona de la primera imagen.",
    "MUY IMPORTANTE: conserva exactamente sus rasgos faciales, color de piel, color y forma de ojos, peinado y proporciones. La cara debe ser reconocible como la misma persona.",
    `Vístele con: ${uniforme}.`,
    "Encuadre: plano medio (cabeza y hombros), enfoque nítido, iluminación profesional de estudio suave, fondo coherente con el entorno descrito.",
    "Estilo: fotografía corporativa moderna, no caricatura ni ilustración.",
  ];
  if (conLogo) {
    partes.push(
      "Incorpora el logotipo mostrado en la segunda imagen bordado o impreso de forma sutil y realista en el lado izquierdo del pecho del uniforme. Respeta colores, proporciones y legibilidad del logo. No lo distorsiones ni cambies el texto.",
    );
  }
  partes.push("Salida: una sola imagen cuadrada, sin texto añadido ni marcas de agua.");
  return partes.join(" ");
}
