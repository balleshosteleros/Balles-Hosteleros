/**
 * Trae al Pipeline de Producto un embudo que vivía en Go High Level.
 *
 * En GHL cada interesado era una "oportunidad" dentro de una secuencia
 * ("EVERGREEN - MASTER") y su paso era la FASE ("Nuevo Lead 📥", "Seguimiento
 * Setter📞", "Reunión 📅", "Pendiente Decision ❓", "Seguimiento Closer📞").
 * Son las mismas cinco columnas que pinta el tablero de Producto → Pipeline,
 * porque ese tablero se hizo a imagen del de GHL.
 *
 * Cada oportunidad deja DOS cosas:
 *   · la tarjeta del tablero (`pipeline_oportunidades`)
 *   · la ficha de la persona en Producto → Clientes (`clientes_sala`), por la
 *     misma puerta que el resto de contactos de GHL — así el nombre del perfil
 *     se descifra y no se duplica a nadie que ya estuviera.
 *
 * Uso:
 *   npx tsx scripts/importar-pipeline-ghl.ts BALLES "~/Downloads/Oportunidades Evergren Master 2.csv"
 *   npx tsx scripts/importar-pipeline-ghl.ts BALLES "...csv" --aplicar
 *
 * Sin `--aplicar` no escribe nada: cuenta qué haría, columna por columna. Con
 * miles de personas reales delante, mirar antes no es un lujo.
 *
 * Repetible: la tarjeta se identifica por el `ID de oportunidad` de GHL,
 * guardado en `pipeline_oportunidades.external_id`, con índice único por
 * empresa. Volver a pasar el mismo CSV actualiza la tarjeta, no la duplica.
 */

import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { altaContactoWhatsapp } from "@/features/sala/services/contacto-whatsapp";

// ─── Cómo se lee una fase de GHL ─────────────────────────────
/**
 * El nombre de la fase trae el emoji pegado ("Seguimiento Setter📞"). Se parten
 * en dos: el emoji va a `icono` y el texto a `nombre`, en frase normal, que es
 * como se escribe todo en el software. "Pendiente Decision" se guarda con su
 * tilde: en GHL estaba mal escrito.
 */
const ORTOGRAFIA: Record<string, string> = {
  "pendiente decision": "Pendiente decisión",
  "reunion": "Reunión",
};

/** Orden de las columnas del embudo comercial, de izquierda a derecha. */
const ORDEN_FASES = [
  "nuevo lead",
  "seguimiento setter",
  "reunión",
  "pendiente decisión",
  "seguimiento closer",
];

const EMOJI = /[\p{Extended_Pictographic}️‍]+/gu;

function partirFase(bruto: string): { nombre: string; icono: string | null } {
  const iconos = bruto.match(EMOJI)?.join("") ?? "";
  const texto = bruto.replace(EMOJI, "").trim();
  const clave = texto.toLowerCase();
  const corregido = ORTOGRAFIA[clave] ?? texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
  return { nombre: corregido, icono: iconos || null };
}

const ESTADOS: Record<string, "ABIERTA" | "GANADA" | "PERDIDA" | "ABANDONADA"> = {
  open: "ABIERTA",
  won: "GANADA",
  lost: "PERDIDA",
  abandoned: "ABANDONADA",
};

/**
 * Origen de la ficha de cliente. El texto exacto de la campaña se guarda en la
 * oportunidad (`fuente`); aquí solo va el canal, con las claves que ya usa el
 * resto del software.
 */
function origenDeFuente(fuente: string): string {
  const f = fuente.toLowerCase();
  if (f.includes("instagram")) return "INSTAGRAM";
  if (f.includes("facebook")) return "FACEBOOK";
  return "MARKETING";
}

/**
 * "69 Días " → 69. GHL no exporta la fecha del último cambio de fase, solo
 * cuántos días hace: se resta de hoy para reconstruirla. Es lo que hace que la
 * tarjeta siga diciendo los días que lleva parada.
 */
function fechaHaceDias(texto: string, porDefecto: string): string {
  const dias = Number.parseInt(texto.trim(), 10);
  if (!Number.isFinite(dias)) return porDefecto;
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

// ─── CSV ─────────────────────────────────────────────────────
/** CSV con comillas dobles y saltos de línea dentro de los campos. */
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

function leerCsv(ruta: string): Record<string, string>[] {
  const filas = parseCsv(readFileSync(ruta, "utf8").replace(/^﻿/, ""));
  const cabecera = (filas.shift() ?? []).map((c) => c.trim());
  return filas
    .filter((f) => f.some((c) => c.trim()))
    .map((f) => Object.fromEntries(cabecera.map((c, i) => [c, f[i] ?? ""])));
}

/**
 * Reintenta lo que falla por la red. Una importación de miles de filas tarda
 * minutos y en ese rato Supabase corta alguna conexión; sin esto, el corte tira
 * el proceso entero a mitad. Solo se reintenta el fallo de transporte: un error
 * de datos debe seguir parando el script.
 */
async function conReintento<T>(fn: () => Promise<T>, intentos = 6): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(msg)) throw err;
      ultimo = err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw ultimo;
}

function leerEnv(): Record<string, string> {
  const txt = readFileSync(".env.local", "utf8");
  const out: Record<string, string> = {};
  for (const linea of txt.split("\n")) {
    if (!linea.includes("=") || linea.startsWith("#")) continue;
    const i = linea.indexOf("=");
    out[linea.slice(0, i).trim()] = linea
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

// ─── Embudo y columnas ───────────────────────────────────────
async function asegurarPipeline(
  supabase: SupabaseClient,
  empresaId: string,
  nombre: string,
): Promise<string> {
  const { data: existente } = await supabase
    .from("pipelines")
    .select("id")
    .eq("empresa_id", empresaId)
    .ilike("nombre", nombre)
    .maybeSingle();
  if (existente?.id) return existente.id as string;

  const { data, error } = await supabase
    .from("pipelines")
    .insert({ empresa_id: empresaId, nombre, orden: 0, activo: true })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function asegurarFases(
  supabase: SupabaseClient,
  pipelineId: string,
  brutas: string[],
): Promise<Map<string, string>> {
  const porBruta = new Map<string, string>();
  const vistas = new Map<string, { nombre: string; icono: string | null }>();
  for (const bruta of brutas) {
    if (!vistas.has(bruta)) vistas.set(bruta, partirFase(bruta));
  }

  // Se ordenan por el orden conocido del embudo comercial; lo que no esté en la
  // lista se pone detrás, en el orden en que apareció en el CSV.
  const ordenadas = [...vistas.entries()].sort(([, a], [, b]) => {
    const ia = ORDEN_FASES.indexOf(a.nombre.toLowerCase());
    const ib = ORDEN_FASES.indexOf(b.nombre.toLowerCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const { data: yaHay } = await supabase
    .from("pipeline_fases")
    .select("id, nombre")
    .eq("pipeline_id", pipelineId);
  const porNombre = new Map(
    (yaHay ?? []).map((f) => [(f.nombre as string).toLowerCase(), f.id as string]),
  );

  let orden = 0;
  for (const [bruta, fase] of ordenadas) {
    const existente = porNombre.get(fase.nombre.toLowerCase());
    if (existente) {
      porBruta.set(bruta, existente);
      orden++;
      continue;
    }
    const { data, error } = await supabase
      .from("pipeline_fases")
      .insert({
        pipeline_id: pipelineId,
        nombre: fase.nombre,
        icono: fase.icono,
        orden: orden++,
        activa: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    porBruta.set(bruta, data.id as string);
  }
  return porBruta;
}

// ─── Programa ────────────────────────────────────────────────
async function main() {
  const [empresaNombre, ruta] = process.argv.slice(2);
  const aplicar = process.argv.includes("--aplicar");
  const iPipeline = process.argv.indexOf("--pipeline");
  const nombrePipeline = iPipeline > -1 ? process.argv[iPipeline + 1] : null;

  if (!empresaNombre || !ruta) {
    console.error(
      'Uso: npx tsx scripts/importar-pipeline-ghl.ts <EMPRESA> "<oportunidades.csv>" [--pipeline "Nombre"] [--aplicar]',
    );
    process.exit(1);
  }

  const env = leerEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: empresa, error: errEmpresa } = await supabase
    .from("empresas")
    .select("id, nombre")
    .eq("nombre", empresaNombre)
    .single();
  if (errEmpresa || !empresa) {
    console.error(`No existe la empresa ${empresaNombre}.`);
    process.exit(1);
  }
  const empresaId = empresa.id as string;

  const filas = leerCsv(ruta).filter((f) => (f["ID de oportunidad"] ?? "").trim());
  if (filas.length === 0) {
    console.error("El CSV no trae ninguna oportunidad.");
    process.exit(1);
  }

  // El nombre del embudo sale del propio CSV (columna "secuencia"), en frase
  // normal: "EVERGREEN - MASTER" → "Evergreen - master".
  const secuencia = (filas[0]["secuencia"] ?? "").trim();
  const nombre =
    nombrePipeline ??
    (secuencia
      ? secuencia.charAt(0).toUpperCase() + secuencia.slice(1).toLowerCase()
      : "Pipeline");

  // ─── Lo que se va a hacer ───
  const porFase = new Map<string, { n: number; valor: number }>();
  for (const f of filas) {
    const clave = (f["fase"] ?? "").trim();
    const acc = porFase.get(clave) ?? { n: 0, valor: 0 };
    acc.n++;
    acc.valor += Number.parseFloat(f["Valor del cliente potencial"] || "0") || 0;
    porFase.set(clave, acc);
  }

  console.log(`\nEmpresa: ${empresa.nombre}`);
  console.log(`Pipeline: ${nombre}`);
  console.log(`Oportunidades en el CSV: ${filas.length}\n`);
  for (const [bruta, acc] of porFase) {
    const fase = partirFase(bruta);
    console.log(
      `  ${(fase.icono ?? " ").padEnd(2)} ${fase.nombre.padEnd(22)} ${String(acc.n).padStart(5)}  ${acc.valor.toFixed(2)} €`,
    );
  }
  const sinContacto = filas.filter(
    (f) => !(f["teléfono"] ?? "").trim() && !(f["correo electrónico"] ?? "").trim(),
  ).length;
  if (sinContacto) console.log(`\n  ${sinContacto} sin teléfono ni correo: no tendrán ficha de cliente.`);

  if (!aplicar) {
    console.log("\nEnsayo. Vuelve a lanzarlo con --aplicar para escribir.\n");
    return;
  }

  // ─── Embudo y columnas ───
  const pipelineId = await asegurarPipeline(supabase, empresaId, nombre);
  const faseIdPorBruta = await asegurarFases(
    supabase,
    pipelineId,
    filas.map((f) => (f["fase"] ?? "").trim()),
  );

  // Lo que ya está importado, para actualizar en vez de duplicar.
  const yaImportadas = new Map<string, string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("pipeline_oportunidades")
      .select("id, external_id")
      .eq("empresa_id", empresaId)
      .eq("pipeline_id", pipelineId)
      .range(desde, desde + 999);
    if (error) throw error;
    for (const o of data ?? []) {
      if (o.external_id) yaImportadas.set(o.external_id as string, o.id as string);
    }
    if ((data ?? []).length < 1000) break;
  }

  let creadas = 0;
  let actualizadas = 0;
  let fichasCreadas = 0;
  let fichasExistentes = 0;
  let sinFicha = 0;

  for (const [i, f] of filas.entries()) {
    const externalId = f["ID de oportunidad"].trim();
    const faseId = faseIdPorBruta.get((f["fase"] ?? "").trim());
    if (!faseId) {
      console.warn(`  · sin fase reconocida: ${externalId}`);
      continue;
    }

    const telefono = (f["teléfono"] ?? "").trim() || null;
    const email = (f["correo electrónico"] ?? "").trim() || null;
    const creadoAt = (f["Creado el"] ?? "").trim() || null;

    // 1) La ficha de la persona, por la puerta de siempre: descifra el nombre
    //    del perfil y no duplica a quien ya estuviera.
    let clienteId: string | null = null;
    const alta = await conReintento(() =>
      altaContactoWhatsapp(supabase, {
        empresaId,
        contacto: {
          nombrePerfil: (f["Nombre del contacto"] ?? f["Nombre de la oportunidad"] ?? "").trim(),
          telefono,
          email,
          creadoAt,
        },
      }),
    );
    if (alta.estado === "creado") {
      clienteId = alta.clienteId;
      fichasCreadas++;
      // El origen real de estas personas es la campaña, no un WhatsApp suelto:
      // la puerta común marca WHATSAPP y aquí se afina con lo que dice el CSV.
      await conReintento(async () => {
        const { error } = await supabase
          .from("clientes_sala")
          .update({ origen: origenDeFuente(f["fuente"] ?? "") })
          .eq("id", alta.clienteId);
        if (error) throw error;
      });
    } else if (alta.estado === "ya_existia") {
      clienteId = alta.clienteId;
      fichasExistentes++;
    } else {
      sinFicha++;
    }

    // 2) La tarjeta del tablero.
    const etiquetas = (f["etiquetas"] ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const fila = {
      empresa_id: empresaId,
      pipeline_id: pipelineId,
      fase_id: faseId,
      cliente_id: clienteId,
      nombre: (f["Nombre de la oportunidad"] ?? "").trim() || "Sin nombre",
      telefono,
      email,
      valor: Number.parseFloat(f["Valor del cliente potencial"] || "0") || 0,
      fuente: (f["fuente"] ?? "").trim() || null,
      asignado_a: (f["asignado"] ?? "").trim() || null,
      estado: ESTADOS[(f["estado"] ?? "").trim().toLowerCase()] ?? "ABIERTA",
      motivo_cierre: (f["nombre de la razón de abandono"] ?? "").trim() || null,
      notas: (f["Notas"] ?? "").trim() || null,
      etiquetas,
      fase_at: fechaHaceDias(
        f["Días desde el último cambio de etapa "] ?? "",
        creadoAt ?? new Date().toISOString(),
      ),
      estado_at: fechaHaceDias(
        f["Días desde el último cambio de estado "] ?? "",
        creadoAt ?? new Date().toISOString(),
      ),
      external_id: externalId,
      external_contacto_id: (f["ID de contacto"] ?? "").trim() || null,
      updated_at: (f["Actualizado el"] ?? "").trim() || new Date().toISOString(),
      ...(creadoAt ? { created_at: creadoAt } : {}),
    };

    const existente = yaImportadas.get(externalId);
    if (existente) {
      await conReintento(async () => {
        const { error } = await supabase
          .from("pipeline_oportunidades")
          .update(fila)
          .eq("id", existente);
        if (error) throw error;
      });
      actualizadas++;
    } else {
      await conReintento(async () => {
        const { error } = await supabase.from("pipeline_oportunidades").insert(fila);
        if (error) throw error;
      });
      creadas++;
    }

    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${filas.length}…`);
  }

  console.log(`\nTarjetas: ${creadas} creadas, ${actualizadas} actualizadas.`);
  console.log(
    `Fichas de cliente: ${fichasCreadas} nuevas, ${fichasExistentes} ya estaban, ${sinFicha} sin datos de contacto.\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
