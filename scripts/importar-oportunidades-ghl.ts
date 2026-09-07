/**
 * Trae al pipeline de Calidad las valoraciones que vivían en Go High Level.
 *
 * En GHL, cada comensal era una "oportunidad" dentro de una secuencia (BACANAL,
 * HABANA) y su valoración era la FASE en la que estaba: "Nuevo comensal 🍴",
 * "No contesta ❌", "Excelente ⭐⭐⭐⭐⭐", "Regular ⭐⭐⭐", "Malo ⭐". Son las
 * mismas cinco columnas que ya tiene el kanban de Calidad → Clientes → Reseñas,
 * porque ese tablero se hizo a imagen del de GHL.
 *
 * No es una reseña escrita: es la clasificación que hizo el equipo de calidad
 * hablando con el cliente por WhatsApp. Por eso entra con `origen = 'whatsapp'`
 * y `plataforma = 'go_high_level'`, y con la fase traducida a la escala de 1 a 5
 * en la que puntúan Google y CoverManager, para que todo se pueda sumar en la
 * misma nota (ver `notaDeEstado`).
 *
 * Uso:
 *   npx tsx scripts/importar-oportunidades-ghl.ts BACANAL "tmp/ghl/Oportunidades Bacanal.csv"
 *   npx tsx scripts/importar-oportunidades-ghl.ts BACANAL "tmp/ghl/x.csv" --aplicar
 *
 * Repetible: la fila se identifica por el `ID de oportunidad` de GHL, guardado
 * en `resenas.external_id`, que tiene índice único por empresa. Volver a pasar
 * el mismo CSV actualiza la fase en vez de duplicar la tarjeta.
 */

import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { nombreDesdePerfil } from "@/shared/lib/nombre-desde-perfil";
import { normalizarTelefono } from "@/shared/lib/validar-contacto";
import type { EstadoResena } from "@/features/calidad/types/resenas";

/**
 * Fase de GHL → columna del kanban. Se compara por el texto sin emojis, que es
 * lo único estable: los iconos de las fases los cambia quien edita el pipeline.
 */
const FASES: { contiene: string; estado: EstadoResena }[] = [
  { contiene: "nuevo comensal", estado: "nuevo_comensal" },
  { contiene: "excelente", estado: "excelente" },
  { contiene: "regular", estado: "regular" },
  { contiene: "malo", estado: "malo" },
];

/**
 * "No contesta" NO se importa: quien no respondió al WhatsApp no ha valorado
 * nada, igual que un cliente que reservó por Cover y no contestó a la encuesta
 * no tiene ninguna fila que diga "no valoró". Traerlas creaba 11.458 filas
 * vacías (sin nota, sin comentario, sin gestión) que hinchaban el número de
 * valoraciones del restaurante con silencios. Se borraron en la migración
 * `20260908002000`; esto es para que volver a pasar el CSV no las resucite.
 */
const FASES_QUE_NO_SON_VALORACION = ["no contesta"];

function estadoDeFase(fase: string): EstadoResena | null {
  const limpio = fase.toLowerCase();
  if (FASES_QUE_NO_SON_VALORACION.some((f) => limpio.includes(f))) return null;
  return FASES.find((f) => limpio.includes(f.contiene))?.estado ?? null;
}

/**
 * NO se deduce "¿coge el teléfono?" de la fase. Se intentó y estaba mal:
 *
 *   · "No contesta" es que no respondió al WHATSAPP por el que se le preguntó,
 *     no que no cogiera una llamada. A esa gente no se la llamó.
 *   · Por teléfono solo se llama a los de Malo, para intentar recuperarlos.
 *   · Y de esos, GHL tampoco guardaba si descolgaron.
 *
 * El dato no existe en esta exportación, así que se deja vacío y lo rellena
 * calidad cuando llame. Es la diferencia entre "no lo cogió" y "no lo sabemos".
 */

/**
 * La fase de GHL, traducida a la escala de 1 a 5 en la que puntúan Google y
 * CoverManager. Sin esto, la mitad de las valoraciones del restaurante no
 * pesaban en ninguna media.
 *
 * Es una EQUIVALENCIA, no una nota del cliente: quien dijo "excelente" por
 * WhatsApp no eligió cinco estrellas. El `origen` de la fila deja dicho de
 * dónde viene, así que siempre se puede separar de las que sí se puntuaron.
 *
 * "No contesta" y "Nuevo comensal" se quedan sin nota a propósito: no es una
 * opinión mala, es que no la hay.
 */
function notaDeEstado(estado: EstadoResena): number | null {
  if (estado === "excelente") return 5;
  if (estado === "regular") return 3;
  if (estado === "malo") return 1;
  return null;
}

function parseCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
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

async function main() {
  const [empresaNombre, ruta] = process.argv.slice(2);
  const aplicar = process.argv.includes("--aplicar");
  if (!empresaNombre || !ruta) {
    console.error(
      'Uso: npx tsx scripts/importar-oportunidades-ghl.ts <EMPRESA> "<ruta.csv>" [--aplicar]',
    );
    process.exit(1);
  }

  const env = leerEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  ) as unknown as SupabaseClient;

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nombre")
    .eq("nombre", empresaNombre)
    .single();
  if (!empresa) {
    console.error(`No existe la empresa "${empresaNombre}".`);
    process.exit(1);
  }
  const empresaId = empresa.id as string;

  const filas = parseCsv(readFileSync(ruta, "utf8"));
  const cab = filas[0];
  const col = (n: string) => cab.indexOf(n);
  const iNombre = col("Nombre del contacto");
  const iTel = col("teléfono");
  const iEmail = col("correo electrónico");
  const iFase = col("fase");
  const iNotas = col("Notas");
  const iCreado = col("Creado el");
  const iActualizado = col("Actualizado el");
  const iOportunidad = col("ID de oportunidad");
  if (iFase < 0 || iOportunidad < 0) {
    console.error("El CSV no es una exportación de oportunidades de GHL.");
    process.exit(1);
  }

  // Los clientes de la empresa, para colgar cada valoración de su ficha. Es lo
  // que hace que la valoración se vea en el cliente y no solo en el tablero.
  const porTelefono = new Map<string, string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("clientes_sala")
      .select("id, telefono_normalizado")
      .eq("empresa_id", empresaId)
      .not("telefono_normalizado", "is", null)
      .range(desde, desde + 999);
    if (error) throw error;
    for (const c of data as { id: string; telefono_normalizado: string }[]) {
      porTelefono.set(c.telefono_normalizado, c.id);
    }
    if (!data || data.length < 1000) break;
  }

  const cuenta = {
    total: 0,
    noSonValoracion: 0,
    sinFase: 0,
    vinculadas: 0,
    sinCliente: 0,
  };
  const porEstado = new Map<string, number>();
  const registros: Record<string, unknown>[] = [];

  for (const f of filas.slice(1)) {
    if (f.length < 5) continue;
    const fase = (f[iFase] ?? "").trim();
    const limpio = fase.toLowerCase();
    // Las que no son una valoración se descartan y se cuentan aparte: mezclarlas
    // con las de fase desconocida haría creer que el CSV trae 11.458 fases raras.
    if (FASES_QUE_NO_SON_VALORACION.some((x) => limpio.includes(x))) {
      cuenta.noSonValoracion++;
      continue;
    }
    const estado = estadoDeFase(fase);
    if (!estado) {
      cuenta.sinFase++;
      continue;
    }
    cuenta.total++;
    porEstado.set(estado, (porEstado.get(estado) ?? 0) + 1);

    const crudo = (f[iNombre] ?? "").trim();
    const perfil = nombreDesdePerfil(crudo);
    const telefono = (f[iTel] ?? "").trim() || null;
    const telN = telefono ? normalizarTelefono(telefono) : null;
    const clienteId = telN ? (porTelefono.get(telN) ?? null) : null;
    if (clienteId) cuenta.vinculadas++;
    else cuenta.sinCliente++;

    const creado = (f[iCreado] ?? "").trim() || null;
    const actualizado = (f[iActualizado] ?? "").trim() || null;
    // "Creado el" es CUÁNDO VINO: la oportunidad nacía en GHL en el momento en
    // que el comensal escaneaba el QR de la mesa. Por eso va a `fecha_registro`,
    // que es la fecha de la visita, la misma que en las de CoverManager sale de
    // su reserva. Así las dos plataformas se pueden comparar por visita.
    //
    // "Actualizado el" es cuando calidad la clasificó. Si no se ha tocado, no
    // hay fecha de gestión: dejarla igual a la de la visita diría que se
    // gestionó el mismo día, y es falso.
    const gestionada = actualizado && actualizado !== creado ? actualizado : null;

    registros.push({
      empresa_id: empresaId,
      external_id: `ghl:${(f[iOportunidad] ?? "").trim()}`,
      // NOT NULL. Si del perfil no sale un nombre se guarda el texto tal cual
      // ("❤️"): en una tarjeta que alguien tiene que reconocer para llamar, ver
      // lo mismo que hay en el WhatsApp vale más que un hueco en blanco.
      nombre_comensal: perfil.nombre ?? crudo,
      telefono,
      email: (f[iEmail] ?? "").trim() || null,
      comentario: (f[iNotas] ?? "").trim() || null,
      estado,
      rating: notaDeEstado(estado),
      origen: "whatsapp",
      plataforma: "go_high_level",
      fecha_registro: creado ? creado.slice(0, 10) : null,
      fecha_sesion: gestionada ? gestionada.slice(0, 10) : null,
      // Cuándo se recogió la opinión: el día que calidad habló con el cliente
      // y, si no consta, el de su visita. Sin esto la ficha del cliente las
      // ordena y las pinta sin fecha.
      "fecha_reseña": gestionada ?? creado,
      cliente_id: clienteId,
      ...(creado ? { created_at: creado } : {}),
    });
  }

  console.log(`${empresa.nombre} · ${cuenta.total} valoraciones en el CSV`);
  for (const [estado, n] of [...porEstado].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(6)} · ${estado}`);
  }
  console.log(
    `vinculadas a una ficha de cliente: ${cuenta.vinculadas} · sin ficha: ${cuenta.sinCliente}`,
  );
  if (cuenta.noSonValoracion) {
    console.log(
      `descartadas por no ser una valoración ("No contesta"): ${cuenta.noSonValoracion}`,
    );
  }
  if (cuenta.sinFase) console.log(`filas con fase desconocida: ${cuenta.sinFase}`);
  if (!aplicar) {
    console.log("\nSIMULACIÓN (sin --aplicar no se escribe nada)");
    return;
  }

  // Qué tarjetas de esta importación ya están. No se usa `upsert`: el índice
  // único de `external_id` es PARCIAL (solo cuando no es nulo) y PostgREST no
  // sabe apuntar a un índice con condición, así que ON CONFLICT no vale aquí.
  const yaEstan = new Map<string, string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("resenas")
      .select("id, external_id")
      .eq("empresa_id", empresaId)
      .like("external_id", "ghl:%")
      .range(desde, desde + 999);
    if (error) throw error;
    for (const r of data as { id: string; external_id: string }[]) {
      yaEstan.set(r.external_id, r.id);
    }
    if (!data || data.length < 1000) break;
  }

  const nuevas = registros.filter(
    (r) => !yaEstan.has(r.external_id as string),
  );
  const existentes = registros.filter((r) => yaEstan.has(r.external_id as string));

  let hechas = 0;
  for (let i = 0; i < nuevas.length; i += 500) {
    const lote = nuevas.slice(i, i + 500);
    const { error } = await supabase.from("resenas").insert(lote);
    if (error) throw error;
    hechas += lote.length;
    process.stdout.write(`  ${hechas}\r`);
  }

  // De las que ya estaban solo se refresca lo que cambia al gestionarlas en
  // GHL. El resto (nombre, teléfono, fecha de la visita) se respeta: puede
  // haberse corregido a mano aquí y la exportación no debe pisarlo.
  let actualizadas = 0;
  for (const r of existentes) {
    const { error } = await supabase
      .from("resenas")
      .update({
        estado: r.estado,
        rating: r.rating,
        fecha_sesion: r.fecha_sesion,
      })
      .eq("id", yaEstan.get(r.external_id as string) as string);
    if (error) throw error;
    actualizadas++;
  }

  console.log(`\nnuevas: ${hechas} · actualizadas: ${actualizadas}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
