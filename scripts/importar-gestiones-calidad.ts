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
 * El enganche es por TELÉFONO. No hay identificador común entre la hoja y la
 * base: el "ID lead" de la hoja es de Go High Level y no se guardó.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

/** Cómo se llama cada dato en las hojas. Se compara en minúsculas y por prefijo. */
const COLUMNAS: Record<string, string[]> = {
  nombre: ["nombre", "cliente"],
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
        coge: cogeTelefono(buscar("coge")),
        estado: estadoGestion(buscar("estado")),
        observaciones: buscar("observaciones") || null,
      };
    })
    .filter((g) => g.telefono || g.observaciones);
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
  const porEmpresa = new Map<string, Map<string, { id: string; fecha: string | null; gestionada: boolean }[]>>();
  for (const [nombre, id] of idDe) {
    const indice = new Map<string, { id: string; fecha: string | null; gestionada: boolean }[]>();
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await supabase
        .from("resenas")
        .select("id, telefono, fecha_registro, estado_gestion")
        .eq("empresa_id", id)
        .not("telefono", "is", null)
        .range(desde, desde + 999);
      if (error) throw error;
      for (const r of data ?? []) {
        const tel = normalizarTelefono((r.telefono as string) ?? "");
        if (!tel) continue;
        if (!indice.has(tel)) indice.set(tel, []);
        indice.get(tel)!.push({
          id: r.id as string,
          fecha: (r.fecha_registro as string | null) ?? null,
          gestionada: !!r.estado_gestion,
        });
      }
      if (!data || data.length < 1000) break;
    }
    porEmpresa.set(nombre, indice);
  }

  const gestiones = rutas.flatMap(leerHoja);
  console.log(`${gestiones.length} gestiones en ${rutas.length} hojas`);
  if (!aplicar) console.log("SIMULACIÓN (sin --aplicar no se escribe nada)\n");

  const cuenta = { enganchadas: 0, sinTelefono: 0, sinValoracion: 0, yaTenian: 0 };

  for (const g of gestiones) {
    if (!g.telefono) {
      cuenta.sinTelefono++;
      continue;
    }
    const empresaId = idDe.get(g.empresa);
    if (!empresaId) continue;

    // La valoración de esa persona en esa empresa. Si tiene varias se coge la
    // del año de la hoja: una gestión de 2025 es de la visita de 2025, no de
    // la de 2024.
    const lista = porEmpresa.get(g.empresa)?.get(g.telefono) ?? [];
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

  console.log(`${aplicar ? "escritas" : "engancharían"}: ${cuenta.enganchadas}`);
  console.log(`sin teléfono en la hoja: ${cuenta.sinTelefono}`);
  console.log(`sin valoración a la que colgarse: ${cuenta.sinValoracion}`);
  console.log(`ya tenían gestión: ${cuenta.yaTenian}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
