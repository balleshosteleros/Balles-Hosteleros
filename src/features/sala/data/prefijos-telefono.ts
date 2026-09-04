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

/** El primero es el que sale por defecto. */
export const PREFIJOS_TELEFONO: readonly PrefijoTelefono[] = [
  { prefijo: "+34",  flag: "🇪🇸", label: "España" },
  { prefijo: "+351", flag: "🇵🇹", label: "Portugal" },
  { prefijo: "+33",  flag: "🇫🇷", label: "Francia" },
  { prefijo: "+39",  flag: "🇮🇹", label: "Italia" },
  { prefijo: "+49",  flag: "🇩🇪", label: "Alemania" },
  { prefijo: "+44",  flag: "🇬🇧", label: "Reino Unido" },
  { prefijo: "+31",  flag: "🇳🇱", label: "Países Bajos" },
  { prefijo: "+41",  flag: "🇨🇭", label: "Suiza" },
  { prefijo: "+212", flag: "🇲🇦", label: "Marruecos" },
  { prefijo: "+1",   flag: "🇺🇸", label: "Estados Unidos" },
  { prefijo: "+52",  flag: "🇲🇽", label: "México" },
  { prefijo: "+54",  flag: "🇦🇷", label: "Argentina" },
  { prefijo: "+57",  flag: "🇨🇴", label: "Colombia" },
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
