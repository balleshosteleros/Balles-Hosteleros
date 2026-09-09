/**
 * Importa a `clientes_sala` una exportación de contactos de Go High Level.
 *
 * GHL era el CRM de WhatsApp de los restaurantes: al cerrarlo, esos contactos
 * solo existen en el CSV que descarga Iván ("Contact Id, First Name, Last Name,
 * Phone, Email, Business Name, Created, Last Activity, Tags").
 *
 * Uso:
 *   npx tsx scripts/importar-contactos-ghl.ts BACANAL "tmp/ghl/Bacanal clientes.csv"
 *   npx tsx scripts/importar-contactos-ghl.ts BACANAL "tmp/ghl/x.csv" --aplicar
 *
 * Sin `--aplicar` no escribe nada: cuenta qué haría. Es la forma de mirar un
 * CSV nuevo antes de meterlo, que con miles de fichas de clientes reales no es
 * un lujo.
 *
 * Todo el criterio (descifrar el nombre del perfil, no duplicar, dejar
 * constancia de lo deducido) vive en `features/sala/services/contacto-whatsapp`,
 * que es lo que usará también la sesión de WhatsApp conectada. Aquí solo se lee
 * el CSV y se llama a esa puerta contacto por contacto.
 *
 * El CANAL sale de las etiquetas de GHL, no se da por supuesto: en la base de
 * Balles hay gente que llegó por Instagram y gente que llegó por una campaña, y
 * marcarlos a todos como WhatsApp por costumbre sería inventarse el dato. Quien
 * no trae ninguna etiqueta de canal y tampoco teléfono se queda SIN origen, que
 * es lo que de verdad se sabe de esa persona: nada.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  altaContactoWhatsapp,
  type ContactoWhatsapp,
} from "@/features/sala/services/contacto-whatsapp";

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

/**
 * Reintenta lo que falla por la red.
 *
 * Una importación de miles de contactos tarda minutos y en ese rato Supabase
 * corta alguna conexión (`ECONNRESET`). Sin esto, el corte tira el proceso
 * entero a mitad y hay que volver a lanzarlo. Solo se reintenta el fallo de
 * transporte: un error de datos debe seguir parando el script.
 */
async function conReintento<T>(fn: () => Promise<T>, intentos = 4): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(msg)) throw err;
      ultimo = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw ultimo;
}

/**
 * Canal por el que llegó la persona, deducido de las etiquetas de GHL.
 *
 * `null` = no se sabe, y se guarda así: `clientes_sala.origen` admite NULL a
 * propósito y no tiene cajón "Otros". Un contacto con teléfono que no dice de
 * dónde vino sí se marca como WHATSAPP, que es por donde GHL hablaba con él.
 */
function origenDeEtiquetas(etiquetas: string, tieneTelefono: boolean): string | null {
  const t = etiquetas.toLowerCase();
  if (t.includes("instagram")) return "INSTAGRAM";
  if (t.includes("facebook")) return "FACEBOOK";
  if (/evergreen|retargeting|setter|sorteo|campa/.test(t)) return "MARKETING";
  return tieneTelefono ? "WHATSAPP" : null;
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

async function main() {
  const [empresaNombre, ruta] = process.argv.slice(2);
  const aplicar = process.argv.includes("--aplicar");
  if (!empresaNombre || !ruta) {
    console.error(
      'Uso: npx tsx scripts/importar-contactos-ghl.ts <EMPRESA> "<ruta.csv>" [--aplicar]',
    );
    process.exit(1);
  }

  const env = leerEnv();
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );

  const { data: empresa, error: errEmpresa } = await supabase
    .from("empresas")
    .select("id, nombre")
    .eq("nombre", empresaNombre)
    .single();
  if (errEmpresa || !empresa) {
    console.error(`No existe la empresa "${empresaNombre}".`);
    process.exit(1);
  }

  const filas = parseCsv(readFileSync(ruta, "utf8"));
  const cabecera = filas[0];
  const col = (n: string) => cabecera.indexOf(n);
  const iNombre = col("First Name");
  const iApellidos = col("Last Name");
  const iTel = col("Phone");
  const iEmail = col("Email");
  const iCreado = col("Created");
  const iEtiquetas = col("Tags");
  if (iTel < 0 || iNombre < 0) {
    console.error("El CSV no tiene las columnas de GHL (First Name, Phone…).");
    process.exit(1);
  }

  const contactos: { contacto: ContactoWhatsapp; origen: string | null }[] = filas
    .slice(1)
    .filter((f) => f.length > 3)
    .map((f) => {
      const telefono = (f[iTel] ?? "").trim() || null;
      return {
        contacto: {
          // Nombre y apellidos van juntos: los adornos aparecen en los dos y el
          // apellido del perfil no es un apellido, es parte de como se llama ahi.
          nombrePerfil: [f[iNombre] ?? "", f[iApellidos] ?? ""]
            .map((s) => s.trim())
            .filter(Boolean)
            .join(" "),
          telefono,
          email: (f[iEmail] ?? "").trim() || null,
          creadoAt: (f[iCreado] ?? "").trim() || null,
        },
        origen: origenDeEtiquetas(
          iEtiquetas >= 0 ? (f[iEtiquetas] ?? "") : "",
          !!telefono,
        ),
      };
    });

  console.log(`${empresa.nombre} · ${contactos.length} contactos en el CSV`);
  if (!aplicar) console.log("SIMULACIÓN (sin --aplicar no se escribe nada)\n");

  const cuenta = {
    creados: 0,
    yaExistian: 0,
    descartados: 0,
    nombreDetectado: 0,
  };
  const motivos = new Map<string, number>();
  const anotar = (motivo: string) =>
    motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1);

  if (!aplicar) {
    // En simulación no se toca la base: solo se cuenta lo que se descartaría
    // por no tener contacto utilizable, que es el único filtro local.
    for (const { contacto } of contactos) {
      if (!contacto.telefono && !contacto.email) {
        cuenta.descartados++;
        anotar("Sin teléfono ni correo.");
      }
    }
  }

  /**
   * De 25 en 25. Uno a uno son dos consultas por contacto y una exportación de
   * 9.000 tardaba dos horas; en tandas baja a minutos. El choque por índice
   * único que puede provocar el paralelismo lo resuelve el propio servicio.
   */
  const TANDA = 25;
  if (aplicar) {
    for (let i = 0; i < contactos.length; i += TANDA) {
      const tanda = contactos.slice(i, i + TANDA);
      const resultados = await Promise.all(
        tanda.map(({ contacto, origen }) =>
          conReintento(() =>
            altaContactoWhatsapp(supabase, {
              empresaId: empresa.id as string,
              contacto,
              origen,
            }),
          ),
        ),
      );
      for (const res of resultados) {
        if (res.estado === "creado") {
          cuenta.creados++;
          if (res.nombreDetectado) cuenta.nombreDetectado++;
        } else if (res.estado === "ya_existia") cuenta.yaExistian++;
        else {
          cuenta.descartados++;
          anotar(res.motivo);
        }
      }
      process.stdout.write(
        `  ${cuenta.creados + cuenta.yaExistian + cuenta.descartados}\r`,
      );
    }
  }

  console.log("\ncreados:", cuenta.creados);
  console.log("ya estaban:", cuenta.yaExistian);
  console.log("descartados:", cuenta.descartados);
  for (const [motivo, n] of motivos) console.log(`   ${n} · ${motivo}`);
  console.log("nombres descifrados del perfil:", cuenta.nombreDetectado);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
