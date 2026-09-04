/**
 * Prefijos telefónicos internacionales — FUENTE ÚNICA.
 *
 * Un teléfono sin prefijo no sirve para llamar ni para mandar un SMS a quien no
 * es del país, y además rompe la deduplicación de clientes: el mismo número
 * guardado unas veces con prefijo y otras sin él genera dos fichas. Por eso
 * TODO formulario que pida un teléfono (portal público, alta desde sala, lista
 * de espera, ficha de cliente) usa este selector: el prefijo no es opcional.
 *
 * Vive aquí y no en cada vista porque antes había dos listas distintas —una en
 * el portal público y otra en sala— con países diferentes: el cliente podía
 * elegir Marruecos en la web y luego el staff no encontraba ese prefijo al
 * editarle la ficha.
 *
 * IMPORTANTE — el teléfono se guarda en UN SOLO campo, con el prefijo dentro
 * ("+34 612345678"). No hay columna de prefijo aparte: tenerlo partido obligaba
 * a recomponerlo en cada pantalla y bastaba con que un sitio se olvidara para
 * que unos clientes salieran con prefijo y otros no. El selector solo sirve
 * para ESCRIBIRLO cómodo; lo que viaja y se guarda es el número entero.
 */

export interface PrefijoTelefono {
  /** Prefijo con el "+" delante: es lo que se guarda y lo que se enseña. */
  prefijo: string;
  flag: string;
  /** Nombre del país, para el `title` del selector. */
  label: string;
}

/**
 * El primero es el que sale por defecto. El orden es el de uso real en los
 * restaurantes: primero España, después los países de donde vienen de verdad
 * los clientes según el histórico (Reino Unido, Francia, Portugal e Italia
 * copan los extranjeros), y al final el resto por continente.
 */
export const PREFIJOS_TELEFONO: readonly PrefijoTelefono[] = [
  { prefijo: "+34",   flag: "🇪🇸", label: "España" },
  // Los que más aparecen entre los clientes de fuera.
  { prefijo: "+44",   flag: "🇬🇧", label: "Reino Unido" },
  { prefijo: "+33",   flag: "🇫🇷", label: "Francia" },
  { prefijo: "+351",  flag: "🇵🇹", label: "Portugal" },
  { prefijo: "+39",   flag: "🇮🇹", label: "Italia" },
  { prefijo: "+49",   flag: "🇩🇪", label: "Alemania" },
  { prefijo: "+31",   flag: "🇳🇱", label: "Países Bajos" },
  // Resto de Europa.
  { prefijo: "+32",   flag: "🇧🇪", label: "Bélgica" },
  { prefijo: "+41",   flag: "🇨🇭", label: "Suiza" },
  { prefijo: "+353",  flag: "🇮🇪", label: "Irlanda" },
  { prefijo: "+45",   flag: "🇩🇰", label: "Dinamarca" },
  { prefijo: "+46",   flag: "🇸🇪", label: "Suecia" },
  { prefijo: "+47",   flag: "🇳🇴", label: "Noruega" },
  { prefijo: "+43",   flag: "🇦🇹", label: "Austria" },
  { prefijo: "+48",   flag: "🇵🇱", label: "Polonia" },
  { prefijo: "+40",   flag: "🇷🇴", label: "Rumanía" },
  { prefijo: "+359",  flag: "🇧🇬", label: "Bulgaria" },
  { prefijo: "+30",   flag: "🇬🇷", label: "Grecia" },
  { prefijo: "+352",  flag: "🇱🇺", label: "Luxemburgo" },
  { prefijo: "+356",  flag: "🇲🇹", label: "Malta" },
  { prefijo: "+380",  flag: "🇺🇦", label: "Ucrania" },
  // América.
  { prefijo: "+1",    flag: "🇺🇸", label: "Estados Unidos / Canadá" },
  { prefijo: "+52",   flag: "🇲🇽", label: "México" },
  { prefijo: "+54",   flag: "🇦🇷", label: "Argentina" },
  { prefijo: "+57",   flag: "🇨🇴", label: "Colombia" },
  { prefijo: "+55",   flag: "🇧🇷", label: "Brasil" },
  { prefijo: "+51",   flag: "🇵🇪", label: "Perú" },
  { prefijo: "+56",   flag: "🇨🇱", label: "Chile" },
  { prefijo: "+58",   flag: "🇻🇪", label: "Venezuela" },
  { prefijo: "+593",  flag: "🇪🇨", label: "Ecuador" },
  { prefijo: "+506",  flag: "🇨🇷", label: "Costa Rica" },
  { prefijo: "+502",  flag: "🇬🇹", label: "Guatemala" },
  { prefijo: "+1809", flag: "🇩🇴", label: "República Dominicana" },
  // África, Asia y Oriente Medio.
  { prefijo: "+212",  flag: "🇲🇦", label: "Marruecos" },
  { prefijo: "+225",  flag: "🇨🇮", label: "Costa de Marfil" },
  { prefijo: "+290",  flag: "🇸🇭", label: "Santa Elena" },
  { prefijo: "+972",  flag: "🇮🇱", label: "Israel" },
  { prefijo: "+971",  flag: "🇦🇪", label: "Emiratos Árabes Unidos" },
  { prefijo: "+86",   flag: "🇨🇳", label: "China" },
  { prefijo: "+81",   flag: "🇯🇵", label: "Japón" },
  { prefijo: "+61",   flag: "🇦🇺", label: "Australia" },
];

/** Prefijo que sale marcado si no hay otro. */
export const PREFIJO_POR_DEFECTO = PREFIJOS_TELEFONO[0].prefijo;

/**
 * Parte un teléfono ya guardado en (prefijo, resto) para poder editarlo.
 *
 * Los números antiguos se guardaron sin prefijo, o pegado sin espacio. Se
 * busca el prefijo más largo que encaje —"+34" y "+351" empiezan igual— y lo
 * que no lleva ninguno se atribuye al prefijo por defecto, que es de donde
 * viene prácticamente todo.
 */
export function separarPrefijo(telefono: string | null | undefined): {
  prefijo: string;
  numero: string;
} {
  const limpio = (telefono ?? "").trim();
  if (!limpio) return { prefijo: PREFIJO_POR_DEFECTO, numero: "" };

  const candidatos = [...PREFIJOS_TELEFONO]
    .map((p) => p.prefijo)
    .sort((a, b) => b.length - a.length);

  for (const prefijo of candidatos) {
    if (limpio.startsWith(prefijo)) {
      return { prefijo, numero: limpio.slice(prefijo.length).trim() };
    }
  }
  return { prefijo: PREFIJO_POR_DEFECTO, numero: limpio };
}

/**
 * Une prefijo y número en el formato único que se guarda: "+34 612345678".
 * Sin número no hay teléfono: devuelve "" en vez de un prefijo suelto, que no
 * sirve para nada y ensuciaría los listados.
 */
export function componerTelefono(
  prefijo: string | null | undefined,
  numero: string | null | undefined,
): string {
  const n = (numero ?? "").trim();
  if (!n) return "";
  const p = (prefijo ?? PREFIJO_POR_DEFECTO).trim() || PREFIJO_POR_DEFECTO;
  return `${p} ${n}`;
}

/**
 * Bandera y país de un teléfono ya guardado, para enseñarlo junto al número.
 *
 * De un vistazo se ve que un cliente es de fuera, que es justo lo que antes no
 * se sabía: todos parecían españoles. Si el prefijo no está en el catálogo
 * —una campaña o un país nuevo— se devuelve sin bandera en vez de inventar
 * una: mejor no decir nada que decir el país equivocado.
 */
export function paisDeTelefono(
  telefono: string | null | undefined,
): PrefijoTelefono | null {
  const limpio = (telefono ?? "").trim();
  if (!limpio.startsWith("+")) return null;

  // De más largo a más corto: "+1" es prefijo de "+1809" y se lo comería.
  const ordenados = [...PREFIJOS_TELEFONO].sort(
    (a, b) => b.prefijo.length - a.prefijo.length,
  );
  return ordenados.find((p) => limpio.startsWith(p.prefijo)) ?? null;
}

