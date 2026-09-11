/**
 * Mete el manual del software en la base de conocimiento del asistente.
 *
 * Es lo que hace que el asistente pase de saber seis cosas a saber el software
 * entero. Se puede volver a pasar siempre que se quiera: es idempotente por
 * `origen_ref`, así que actualiza lo que haya cambiado y no duplica nada.
 *
 * No gasta IA: los embeddings los calcula el motor propio de Supabase.
 *
 * Uso:
 *   npx tsx scripts/indexar-manual-soporte.ts
 */
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { indexarManualSoftware } = await import(
    "../src/features/soporte/services/indexar-manual"
  );
  const r = await indexarManualSoftware();

  console.log("Manual indexado:");
  console.log(`  artículos:     ${r.total}`);
  console.log(`  nuevos:        ${r.insertados}`);
  console.log(`  actualizados:  ${r.actualizados}`);
  console.log(`  desactivados:  ${r.desactivados}`);
  if (r.sinEmbedding > 0) {
    console.error(`  ⚠️  SIN EMBEDDING: ${r.sinEmbedding} — esos no se van a encontrar nunca.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
