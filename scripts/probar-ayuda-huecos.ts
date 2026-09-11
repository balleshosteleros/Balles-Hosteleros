/**
 * Prueba los tres desenlaces del asistente, con el mismo código que usa el chat.
 *
 *   resuelta  → hay material y contesta
 *   sin_datos → es del software pero no está escrito → se apunta como hueco
 *   ajena     → no es información de la empresa → NO se apunta
 *
 * Limpia lo que crea. Uso:
 *   npx tsx scripts/probar-ayuda-huecos.ts BACANAL
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

const MODULOS_CAMARERO = ["SALA", "GENERAL"];

const CASOS = [
  "¿cómo fichar la entrada?",
  "¿cuánta propina me toca del bote de esta semana?",
  "¿cuál es la capital de Francia?",
  "¿qué hago si un cliente se va sin pagar?",
  "cuéntame un chiste",
];

async function main() {
  const nombreEmpresa = process.argv[2] || "BACANAL";

  const { createAdminClient } = await import("/Users/ivanballesteros/Balles Hosteleros/src/lib/supabase/admin");
  const { recuperarConocimiento, distanciaAlConocimiento } = await import(
    "/Users/ivanballesteros/Balles Hosteleros/src/features/soporte/services/buscar-conocimiento"
  );
  const { apuntarHueco } = await import(
    "/Users/ivanballesteros/Balles Hosteleros/src/features/soporte/services/huecos"
  );
  const { UMBRAL_RELEVANTE, UMBRAL_AJENO } = await import(
    "/Users/ivanballesteros/Balles Hosteleros/src/lib/soporte/umbrales"
  );

  const admin = createAdminClient();
  const { data: empresa } = await admin
    .from("empresas")
    .select("id, nombre")
    .eq("nombre", nombreEmpresa)
    .single();
  if (!empresa) throw new Error(`No existe la empresa ${nombreEmpresa}`);
  console.log(`Empresa: ${empresa.nombre} — como CAMARERO (${MODULOS_CAMARERO.join(", ")})\n`);

  for (const pregunta of CASOS) {
    // Mismo camino que el route: buscar con candado, mirar el más cercano.
    const { embedding, chunks } = await recuperarConocimiento(pregunta, MODULOS_CAMARERO, 6);
    const masCercano = chunks[0]?.distancia ?? 1;

    if (chunks.length > 0 && masCercano <= UMBRAL_RELEVANTE) {
      console.log(`RESUELTA   ${masCercano.toFixed(3)}  ${pregunta}`);
      console.log(`             → ${chunks[0].modulo}/${chunks[0].titulo}`);
      continue;
    }

    const global = await distanciaAlConocimiento(embedding);
    const esAjena = global.distancia > UMBRAL_AJENO;
    if (esAjena) {
      console.log(`AJENA      ${global.distancia.toFixed(3)}  ${pregunta}`);
      console.log(`             → no se apunta como hueco`);
    } else {
      await apuntarHueco({
        empresaId: empresa.id,
        pregunta,
        embedding,
        moduloProbable: global.modulo,
        consultaId: null,
      });
      console.log(`SIN DATOS  ${global.distancia.toFixed(3)}  ${pregunta}`);
      console.log(`             → apuntado como hueco (parece de ${global.modulo})`);
    }
  }

  const { data: huecos } = await admin
    .from("soporte_huecos")
    .select("id, pregunta, veces_preguntada, modulo_probable")
    .eq("empresa_id", empresa.id);

  console.log(`\nHuecos abiertos: ${huecos?.length ?? 0}`);
  for (const h of (huecos ?? []) as { pregunta: string; veces_preguntada: number }[]) {
    console.log(`  ×${h.veces_preguntada}  ${h.pregunta}`);
  }

  const ids = ((huecos ?? []) as { id: string }[]).map((h) => h.id);
  if (ids.length) await admin.from("soporte_huecos").delete().in("id", ids);
  console.log(`\nLimpiado: ${ids.length} huecos.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
