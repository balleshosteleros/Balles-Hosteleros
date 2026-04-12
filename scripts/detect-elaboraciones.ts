/**
 * Detecta ingredientes que en realidad son ELABORACIONES (salsas, fondos, masas,
 * adobos, cremas, etc.) y los re-clasifica en BD cambiando su tipo de 'compra'
 * a 'elaboracion'.
 *
 * Heurística: el nombre contiene alguno de los keywords de ELAB_KEYWORDS.
 * Después de reclasificar, lista los resultados.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const content = fs.readFileSync(envPath, "utf-8");
for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Keywords que sugieren que el ingrediente es en realidad una elaboración (salsa / materia).
const ELAB_KEYWORDS = [
  "SALSA", "MAYONESA", "ALIOLI", "VINAGRETA", "CHIMICHURRI", "MOJO",
  "ADOBO", "MARINADO", "MARINADA", "SOFRITO", "REDUCCION", "REDUCCIÓN",
  "CREMA DE ", "CREMA  DE", "PURE DE", "PURÉ DE", "COULIS", "PESTO",
  "FONDO", "CALDO", "DEMIGLACE", "DEMI-GLACE", "DEMI GLACE",
  "BECHAMEL", "HOLANDESA", "ROMESCO", "BBQ", "TERIYAKI", "TARTARA", "TÁRTARA",
  "BRASA", "AJO ASADO", "PROVENZAL",
  "MASA", "PAN RALLADO",
  "MIX ", "MIX_", "RELLENO",
  "GUACAMOLE", "HUMMUS", "HUMUS",
];

function isLikelyElaboracion(nombre: string): boolean {
  const n = nombre.toUpperCase();
  return ELAB_KEYWORDS.some((kw) => n.includes(kw));
}

async function main() {
  const { data: productos, error } = await supabase
    .from("productos")
    .select("id, nombre, tipo, categoria")
    .eq("tipo", "compra");

  if (error) { console.error(error); process.exit(1); }
  if (!productos) return;

  const candidates = productos.filter((p) => isLikelyElaboracion(p.nombre));
  console.log(`Total productos compra: ${productos.length}`);
  console.log(`Candidatos a elaboración: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log("No hay candidatos. Nada que migrar.");
    return;
  }

  for (const p of candidates) {
    console.log(`  • ${p.nombre}`);
  }

  const ids = candidates.map((p) => p.id);
  const { error: updErr } = await supabase
    .from("productos")
    .update({ tipo: "elaboracion", categoria: "Salsas" })
    .in("id", ids);

  if (updErr) { console.error("❌ Error al actualizar:", updErr.message); process.exit(1); }

  console.log(`\n✓ Reclasificados ${candidates.length} productos como 'elaboracion'.`);
  console.log("Abre la pestaña Elaboraciones en Logística → Productos.");
}

main();
