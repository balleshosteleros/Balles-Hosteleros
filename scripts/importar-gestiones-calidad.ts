/**
 * Trae a las valoraciones el trabajo de calidad que vivía en un Excel.
 *
 * La persona de calidad lleva desde 2024 una hoja por empresa y año
 * ("BACANAL 2026 · AGENDAS") con lo que hizo con cada comensal: si cogió el
 * teléfono, en qué quedó la gestión y —lo que más vale— QUÉ LE CONTÓ el
 * cliente. Eso último no está en ningún otro sitio: en el software hay la nota
 * y el veredicto, pero no el motivo. "Había cucarachas", "los cuatro cócteles
 * sabían igual", "precio caro para la calidad" son las frases que dicen qué
 * hay que arreglar en la casa.
 *
 * Uso:
 *   npx tsx scripts/importar-gestiones-calidad.ts "tmp/ghl/BACANAL 2026.xlsx"
 *   npx tsx scripts/importar-gestiones-calidad.ts "tmp/ghl/*.xlsx" --aplicar
 *
 * Sin `--aplicar` no escribe: dice cuántas engancharían y cuántas no.
 *
 * La empresa y el año salen del NOMBRE del fichero ("HABANA 2025.xlsx"), que es
 * como los descarga Iván. Las columnas se buscan por su nombre y no por su
 * posición: hay tres formatos distintos —2024 con 17 columnas, 2025 y 2026 con
 * 18, y HABANA 2024 con solo 7— y todos llaman igual a lo que importa.
 *
 * El enganche es por TELÉFONO y, si no hay, por NOMBRE. No existe identificador
 * común entre la hoja y la base: el "ID lead" es de Go High Level y no se
 * guardó.
 *
 * Los dos criterios hacen falta porque cada plataforma trae una cosa:
 *   · Go High Level da el teléfono —era WhatsApp—, y engancha por ahí: 201.
 *   · CoverManager casi nunca lo trae (9 de 2.620 valoraciones) pero sí el
 *     nombre completo de quien reservó: 87 enganchan por nombre y solo 33 por
 *     teléfono.
 *   · Google no da ni teléfono ni correo, solo el nombre del autor.
 *
 * Un nombre que aparece en DOS valoraciones distintas no se engancha: no se
 * puede saber a cuál de las dos se refería la gestión, y colgarla de la que no
 * es sería peor que dejarla fuera. Se cuentan aparte para poder revisarlas.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

/** Cómo se llama cada dato en las hojas. Se compara en minúsculas y por prefijo. */
const COLUMNAS: Record<string, string[]> = {
  nombre: ["nombre", "cliente"],
  registro: ["fecha del registro", "fecha registro"],
  telefono: ["teléfono", "telefono"],
  sesion: ["fecha de la sesión", "fecha de la sesion"],
  coge: ["coge el telefono", "coge el teléfono"],
  estado: ["estado"],
  observaciones: ["observaciones del closer", "observaciones"],
};

/** Lo que pone la hoja → lo que admite `resenas.coge_telefono`. */
function cogeTelefono(valor: string): "si" | "no" | "sin_telefono" | null {
  const v = valor.trim().toUpperCase();
  if (v === "SÍ" || v === "SI") return "si";
  if (v === "NO") return "no";
  if (v.includes("SIN")) return "sin_telefono";
  return null;
}

/** Lo que pone la hoja → lo que admite `resenas.estado_gestion`. */
function estadoGestion(valor: string): string | null {
  const v = valor.trim().toUpperCase();
  if (v.includes("WHATSAPP")) return "mando_whatsapp";
  if (v.includes("REVISA")) return "se_revisa_resena";
  if (v.includes("VISITARNOS")) return "pendiente_visitarnos";
  if (v.includes("PENDIENTE")) return "pendiente_llamada";
  if (v.includes("NO QUIERE LLAMADA")) return "no_quiere_llamada";
  if (v.includes("NO QUIERE VOLVER")) return "no_quiere_volver";
  if (v.includes("VUELVE")) return "vuelve_cliente";
  return null;
}

/**
 * Nombre reducido a lo comparable: sin tildes, sin signos y en minúsculas.
 * "MARÍA JOSÉ PÉREZ" y "Maria Jose Perez" son la misma persona.
 */
function claveNombre(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * La fecha de la hoja a "AAAA-MM-DD". Excel las devuelve como Date o como
 * texto según la columna, y algunas filas traen basura ("16/0").
 */
function fechaIso(valor: string): string | null {
  // Excel guarda las fechas como número de días desde el 30-12-1899, y así
  // llegan: "45662" es el 04-01-2025. Sin esto no había fecha con la que
  // desempatar y las visitas repetidas se quedaban todas fuera.
  if (/^\d{5}$/.test(valor)) {
    const ms = (Number(valor) - 25569) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const es = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(valor);
  if (es) {
    return `${es[3]}-${es[2].padStart(2, "0")}-${es[1].padStart(2, "0")}`;
  }
  return null;
}

/** Días entre dos fechas "AAAA-MM-DD". */
function diasEntre(a: string, b: string): number {
  return Math.abs(
    (new Date(a + "T12:00:00").getTime() - new Date(b + "T12:00:00").getTime()) /
      86400000,
  );
}

/** Teléfono en solo dígitos y sin el 34, igual que `bh_normalize_telefono`. */
function normalizarTelefono(valor: string): string | null {
  const d = valor.replace(/\D/g, "");
  if (!d) return null;
  if (/^0034[6-9]\d{8}$/.test(d)) return d.slice(4);
  if (/^34[6-9]\d{8}$/.test(d)) return d.slice(2);
  return d;
}

function leerEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
    if (!linea.includes("=") || linea.startsWith("#")) continue;
    const i = linea.indexOf("=");
    out[linea.slice(0, i).trim()] = linea
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

interface Gestion {
  empresa: string;
  anio: string;
  telefono: string | null;
  nombre: string | null;
  /** Día de la visita según la hoja, "AAAA-MM-DD". Desempata los nombres repetidos. */
  fecha: string | null;
  coge: string | null;
  estado: string | null;
  observaciones: string | null;
}

function leerHoja(ruta: string): Gestion[] {
  const nombre = basename(ruta);
  const empresa = nombre.split(" ")[0].toUpperCase();
  const anio = /(\d{4})/.exec(nombre)?.[1] ?? "";

  const libro = XLSX.readFile(ruta);
  if (!libro.SheetNames.includes("AGENDAS")) return [];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    libro.Sheets["AGENDAS"],
    { defval: "" },
  );

  return filas
    .map((fila) => {
      const buscar = (clave: string): string => {
        const alias = COLUMNAS[clave];
        for (const [col, valor] of Object.entries(fila)) {
          const c = col.trim().toLowerCase();
          if (alias.some((a) => c.startsWith(a))) {
            // Excel guarda los teléfonos como número: 691197997 llega como
            // 691197997 y no como texto, así que se fuerza a cadena entera.
            return typeof valor === "number"
              ? String(Math.round(valor))
              : String(valor ?? "").trim();
          }
        }
        return "";
      };
      return {
        empresa,
        anio,
        telefono: normalizarTelefono(buscar("telefono")),
        nombre: buscar("nombre") || null,
        fecha: fechaIso(buscar("registro")) ?? fechaIso(buscar("sesion")),
        coge: cogeTelefono(buscar("coge")),
        estado: estadoGestion(buscar("estado")),
        observaciones: buscar("observaciones") || null,
      };
    })
    .filter((g) => g.telefono || g.nombre);
}

async function main() {
  const rutas = process.argv.slice(2).filter((a) => a.endsWith(".xlsx"));
  const aplicar = process.argv.includes("--aplicar");
  if (rutas.length === 0) {
    console.error(
      'Uso: npx tsx scripts/importar-gestiones-calidad.ts "<hoja.xlsx>" [...] [--aplicar]',
    );
    process.exit(1);
  }

  const env = leerEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  ) as unknown as SupabaseClient;

  const { data: empresas } = await supabase.from("empresas").select("id, nombre");
  const idDe = new Map(
    (empresas ?? []).map((e) => [(e.nombre as string).toUpperCase(), e.id as string]),
  );

  // Quien gestionó todo esto. Si no está de alta, las gestiones entran igual
  // pero sin responsable: el dato que importa es lo que contó el cliente.
  const { data: sofia } = await supabase
    .from("empleados")
    .select("user_id")
    .ilike("nombre", "sofia")
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();
  const responsable = (sofia?.user_id as string | null) ?? null;

  // Las valoraciones de cada empresa, indexadas por teléfono. Se leen de una
  // vez: hacer una consulta por gestión serían 573 idas y vueltas.
  type Fila = { id: string; fecha: string | null; gestionada: boolean };
  const porEmpresa = new Map<
    string,
    { porTelefono: Map<string, Fila[]>; porNombre: Map<string, Fila[]> }
  >();
  for (const [nombre, id] of idDe) {
    const porTelefono = new Map<string, Fila[]>();
    const porNombre = new Map<string, Fila[]>();
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await supabase
        .from("resenas")
        .select("id, telefono, nombre_comensal, fecha_registro, estado_gestion")
        .eq("empresa_id", id)
        .range(desde, desde + 999);
      if (error) throw error;
      for (const r of data ?? []) {
        const fila: Fila = {
          id: r.id as string,
          fecha: (r.fecha_registro as string | null) ?? null,
          gestionada: !!r.estado_gestion,
        };
        const tel = normalizarTelefono((r.telefono as string) ?? "");
        if (tel) {
          if (!porTelefono.has(tel)) porTelefono.set(tel, []);
          porTelefono.get(tel)!.push(fila);
        }
        // Nombres de menos de cinco letras fuera: "Ana" o "J M" casarían con
        // media base y engancharían la gestión a quien no toca.
        const clave = claveNombre((r.nombre_comensal as string) ?? "");
        if (clave.length > 4) {
          if (!porNombre.has(clave)) porNombre.set(clave, []);
          porNombre.get(clave)!.push(fila);
        }
      }
      if (!data || data.length < 1000) break;
    }
    porEmpresa.set(nombre, { porTelefono, porNombre });
  }

  const gestiones = rutas.flatMap(leerHoja);
  console.log(`${gestiones.length} gestiones en ${rutas.length} hojas`);
  if (!aplicar) console.log("SIMULACIÓN (sin --aplicar no se escribe nada)\n");

  const cuenta = {
    enganchadas: 0,
    porNombre: 0,
    desempatadasPorAnio: 0,
    desempatadasPorFecha: 0,
    ambiguas: 0,
    sinValoracion: 0,
    yaTenian: 0,
  };

  for (const g of gestiones) {
    const indice = porEmpresa.get(g.empresa);
    if (!indice) continue;

    // La valoración de esa persona en esa empresa. Si tiene varias se coge la
    // del año de la hoja: una gestión de 2025 es de la visita de 2025, no de
    // la de 2024.
    let lista = g.telefono ? (indice.porTelefono.get(g.telefono) ?? []) : [];
    let via: "telefono" | "nombre" = "telefono";
    if (lista.length === 0 && g.nombre) {
      const clave = claveNombre(g.nombre);
      const porNombre = clave.length > 4 ? (indice.porNombre.get(clave) ?? []) : [];
      // Varias valoraciones con el mismo nombre: no es que la persona no esté,
      // es que está dos veces —volvió otro año— y hay que decidir a cuál iba la
      // gestión. El AÑO de la hoja lo resuelve casi siempre: una gestión de la
      // hoja de 2025 es de la visita de 2025. Solo cuando ni el año desempata
      // se deja fuera, porque colgarla de la que no es sería peor que dejarla.
      if (porNombre.length > 1) {
        const delAnio = porNombre.filter((r) => r.fecha?.startsWith(g.anio));
        if (delAnio.length === 1) {
          lista = delAnio;
          cuenta.desempatadasPorAnio++;
        } else if (delAnio.length > 1 && g.fecha) {
          // Varias visitas el mismo año: manda la MÁS CERCANA al día que
          // apuntó calidad. Se exige que esté a menos de un mes; más lejos ya
          // no es "esa visita" sino otra distinta, y se prefiere no adivinar.
          const conDistancia = delAnio
            .filter((r) => r.fecha)
            .map((r) => ({ fila: r, dias: diasEntre(r.fecha as string, g.fecha as string) }))
            .sort((a, b) => a.dias - b.dias);
          if (conDistancia.length > 0 && conDistancia[0].dias <= 31) {
            lista = [conDistancia[0].fila];
            cuenta.desempatadasPorFecha++;
          } else {
            cuenta.ambiguas++;
            continue;
          }
        } else {
          cuenta.ambiguas++;
          continue;
        }
      } else {
        lista = porNombre;
      }
      via = "nombre";
    }
    if (lista.length === 0) {
      cuenta.sinValoracion++;
      continue;
    }
    const elegida = lista.find((r) => r.fecha?.startsWith(g.anio)) ?? lista[0];
    if (elegida.gestionada) {
      cuenta.yaTenian++;
      continue;
    }
    elegida.gestionada = true;
    cuenta.enganchadas++;
    if (via === "nombre") cuenta.porNombre++;
    if (!aplicar) continue;

    const { error } = await supabase
      .from("resenas")
      .update({
        coge_telefono: g.coge,
        estado_gestion: g.estado,
        observaciones_closer: g.observaciones,
        gestionada_por: responsable,
      })
      .eq("id", elegida.id);
    if (error) throw error;
  }

  console.log(
    `${aplicar ? "escritas" : "engancharían"}: ${cuenta.enganchadas} (${cuenta.porNombre} por nombre)`,
  );
  console.log(
    `nombre repetido resuelto por el año: ${cuenta.desempatadasPorAnio}`,
  );
  console.log(
    `nombre repetido resuelto por la fecha más cercana: ${cuenta.desempatadasPorFecha}`,
  );
  console.log(`nombre repetido sin poder decidir: ${cuenta.ambiguas}`);
  console.log(`sin valoración a la que colgarse: ${cuenta.sinValoracion}`);
  console.log(`ya tenían gestión: ${cuenta.yaTenian}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
