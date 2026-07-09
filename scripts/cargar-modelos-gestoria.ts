/**
 * Carga masiva inicial de los PDFs de modelos fiscales de gestoría (PRP-072).
 *
 * Recorre  gestoria/{BACANAL,HABANA}/<año>/{1T,2T,3T,4T,ANUAL}/*.pdf
 * y para cada PDF:
 *   1. Infiere { empresa_id, ejercicio, periodo, tipo } de la ruta + nombre.
 *   2. Sube el PDF al bucket privado 'modelos-aeat-pdf' con el path canónico
 *      <empresa_id>/<ejercicio>/<periodo>/<tipo>_<n>.pdf
 *   3. Hace UPSERT de la fila modelos_aeat con pdf_url = path.
 *
 * Idempotente: re-ejecutable. Si el modelo ya tiene un pdf_url apuntando a un
 * objeto existente, lo salta (salvo --force).
 *
 * USO:  npx tsx scripts/cargar-modelos-gestoria.ts [--dry] [--force]
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ── Cargar .env.local ────────────────────────────────────────
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const DRY = process.argv.includes("--dry");
const FORCE = process.argv.includes("--force");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const BUCKET = "modelos-aeat-pdf";

// ── IDs de empresa (fuente: PRP-056/059) ─────────────────────
const EMPRESAS: Record<string, string> = {
  BACANAL: "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47",
  HABANA: "00000000-0000-0000-0000-000000000001",
};

const PERIODO_MAP: Record<string, string> = {
  "1T": "Q1",
  "2T": "Q2",
  "3T": "Q3",
  "4T": "Q4",
  ANUAL: "ANUAL",
};

/** Infiere el tipo de modelo a partir del nombre del fichero. */
function inferirTipo(nombre: string): string | null {
  const n = nombre.toUpperCase();
  if (/\bLIBRO\s*MAYOR\b|LIBRO_MAYOR/.test(n)) return "LIBRO_MAYOR";
  if (/\bPYG\b|P\s*Y\s*G|PERDIDAS|PÉRDIDAS|GANANCIAS/.test(n)) return "PYG";
  if (/BALANCE/.test(n)) return "BALANCE";
  // Modelos numéricos: buscamos el número de modelo.
  if (/\b303\b/.test(n)) return "303";
  if (/\b390\b/.test(n)) return "390";
  if (/\b347\b/.test(n)) return "347";
  if (/\b200\b/.test(n)) return "200";
  if (/\b190\b/.test(n)) return "190";
  if (/\b130\b/.test(n)) return "130";
  if (/\b115\b/.test(n)) return "115";
  if (/\b111\b|RETENCIONES/.test(n)) return "111";
  return null;
}

interface Item {
  empresa: string;
  empresaId: string;
  ejercicio: number;
  periodoCarpeta: string;
  periodo: string;
  tipo: string;
  file: string;
  nombre: string;
}

function recolectar(): Item[] {
  const base = path.resolve(process.cwd(), "gestoria");
  const items: Item[] = [];
  for (const empresa of Object.keys(EMPRESAS)) {
    const dirEmpresa = path.join(base, empresa);
    if (!fs.existsSync(dirEmpresa)) continue;
    for (const año of fs.readdirSync(dirEmpresa)) {
      const dirAño = path.join(dirEmpresa, año);
      if (!fs.statSync(dirAño).isDirectory()) continue;
      const ejercicio = Number.parseInt(año, 10);
      if (Number.isNaN(ejercicio)) continue;
      for (const periodoCarpeta of fs.readdirSync(dirAño)) {
        const dirPeriodo = path.join(dirAño, periodoCarpeta);
        if (!fs.statSync(dirPeriodo).isDirectory()) continue;
        const periodo = PERIODO_MAP[periodoCarpeta.toUpperCase()];
        if (!periodo) {
          console.warn(`⚠️  Carpeta de periodo desconocida, saltada: ${empresa}/${año}/${periodoCarpeta}`);
          continue;
        }
        for (const fichero of fs.readdirSync(dirPeriodo)) {
          if (!fichero.toLowerCase().endsWith(".pdf")) continue;
          const tipo = inferirTipo(fichero);
          if (!tipo) {
            console.warn(`⚠️  No se pudo inferir el tipo, saltado: ${empresa}/${año}/${periodoCarpeta}/${fichero}`);
            continue;
          }
          items.push({
            empresa,
            empresaId: EMPRESAS[empresa],
            ejercicio,
            periodoCarpeta,
            periodo,
            tipo,
            file: path.join(dirPeriodo, fichero),
            nombre: fichero,
          });
        }
      }
    }
  }
  return items;
}

async function main() {
  const items = recolectar();
  console.log(`\n📂 ${items.length} PDFs encontrados en /gestoria (BACANAL + HABANA).`);
  if (DRY) console.log("   (modo --dry: no se escribe nada)\n");

  let subidos = 0;
  let saltados = 0;
  let errores = 0;

  for (const it of items) {
    const etiqueta = `${it.empresa} ${it.ejercicio} ${it.periodoCarpeta} · ${it.tipo}`;

    // ¿Ya existe la fila con pdf_url?
    const { data: existente } = await admin
      .from("modelos_aeat")
      .select("id, pdf_url")
      .eq("empresa_id", it.empresaId)
      .eq("tipo", it.tipo)
      .eq("periodo", it.periodo)
      .eq("ejercicio", it.ejercicio)
      .maybeSingle();

    if (existente?.pdf_url && !FORCE) {
      console.log(`↔️  ${etiqueta}: ya tiene PDF, saltado.`);
      saltados++;
      continue;
    }

    if (DRY) {
      console.log(`＋ ${etiqueta}: se subiría (${it.nombre}).`);
      subidos++;
      continue;
    }

    const buffer = fs.readFileSync(it.file);
    const objPath = `${it.empresaId}/${it.ejercicio}/${it.periodo}/${it.tipo}_${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(objPath, buffer, { contentType: "application/pdf", upsert: false });
    if (upErr) {
      console.error(`❌ ${etiqueta}: fallo al subir — ${upErr.message}`);
      errores++;
      continue;
    }

    // Upsert de la fila (por si aún no existe la fila del modelo).
    const { error: upsertErr } = await admin.from("modelos_aeat").upsert(
      {
        empresa_id: it.empresaId,
        tipo: it.tipo,
        periodo: it.periodo,
        ejercicio: it.ejercicio,
        estado: "PRESENTADO",
        pdf_url: objPath,
      },
      { onConflict: "empresa_id,tipo,periodo,ejercicio" },
    );
    if (upsertErr) {
      await admin.storage.from(BUCKET).remove([objPath]);
      console.error(`❌ ${etiqueta}: fallo al enlazar — ${upsertErr.message}`);
      errores++;
      continue;
    }

    console.log(`✅ ${etiqueta}: subido (${it.nombre}).`);
    subidos++;
  }

  console.log(`\n── Resumen ──`);
  console.log(`   Subidos:  ${subidos}`);
  console.log(`   Saltados: ${saltados}`);
  console.log(`   Errores:  ${errores}`);
  console.log(`   Total:    ${items.length}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
