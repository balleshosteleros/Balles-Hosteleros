/**
 * Genera los textos legales de una empresa en HTML, para pegarlos en un editor
 * externo (GoHighLevel, WordPress…) mientras la web no esté servida desde el
 * propio software.
 *
 * Uso:  npx tsx scripts/generar-legales-html.ts BACANAL
 *       npx tsx scripts/generar-legales-html.ts HABANA
 *
 * Escribe los ficheros en tmp/legales-<empresa>/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { generarTextosLegales } from "../src/features/marketing/pagina-web/services/textos-legales";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const nombreEmpresa = (process.argv[2] ?? "").trim();
  if (!nombreEmpresa) {
    console.error("Indica la empresa. Ej: npx tsx scripts/generar-legales-html.ts BACANAL");
    process.exit(1);
  }
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("empresas")
    .select("nombre, datos_generales")
    .ilike("nombre", nombreEmpresa)
    .maybeSingle();

  if (error) {
    console.error("Error leyendo la empresa:", error.message);
    process.exit(1);
  }
  if (!data) {
    console.error(`No existe la empresa «${nombreEmpresa}».`);
    process.exit(1);
  }

  const { paginas, avisos } = generarTextosLegales(
    data.datos_generales as Record<string, unknown> | null,
  );

  const destino = join(process.cwd(), "tmp", `legales-${data.nombre.toLowerCase()}`);
  mkdirSync(destino, { recursive: true });

  for (const p of paginas) {
    const ruta = join(destino, `${p.slug}.html`);
    writeFileSync(ruta, p.html, "utf8");
    console.log(`✓ ${ruta}`);
  }

  if (avisos.length > 0) {
    console.log("\n⚠ Datos pendientes en Ajustes → Datos generales:");
    for (const a of avisos) console.log(`  - ${a}`);
  } else {
    console.log("\n✓ Todos los datos obligatorios están completos.");
  }
}

main().catch((err) => {
  console.error("Fallo inesperado:", err);
  process.exit(1);
});
