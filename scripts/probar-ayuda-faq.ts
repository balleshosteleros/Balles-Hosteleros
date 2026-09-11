/**
 * Prueba de extremo a extremo del motor de preguntas frecuentes.
 *
 * Mete consultas de mentira (marcadas), lanza el motor, enseña lo que ha
 * publicado y lo BORRA todo al terminar. No deja rastro en la empresa.
 *
 * Uso:
 *   npx tsx scripts/probar-ayuda-faq.ts BACANAL
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

const MARCA = "[PRUEBA-FAQ]";

/** Tres formas de preguntar lo mismo, por cada tema. */
const TEMAS = [
  [
    "¿cómo veo mi nómina?",
    "dónde están mis nóminas",
    "quiero descargar la nómina del mes pasado",
  ],
  [
    "¿cómo pido vacaciones?",
    "quiero solicitar unos días libres",
    "dónde se piden las vacaciones",
  ],
  [
    "¿cómo fichar la entrada?",
    "no sé fichar cuando llego",
    "dónde se ficha al empezar el turno",
  ],
];

async function main() {
  const nombreEmpresa = process.argv[2] || "BACANAL";

  const { createAdminClient } = await import("/Users/ivanballesteros/Balles Hosteleros/src/lib/supabase/admin");
  const { generarEmbedding } = await import("/Users/ivanballesteros/Balles Hosteleros/src/lib/ia/embeddings");
  const { buscarConocimiento } = await import(
    "/Users/ivanballesteros/Balles Hosteleros/src/features/soporte/services/buscar-conocimiento"
  );
  const { generarFaqsDeEmpresa } = await import(
    "/Users/ivanballesteros/Balles Hosteleros/src/features/soporte/services/generar-faqs"
  );

  const admin = createAdminClient();

  const { data: empresa } = await admin
    .from("empresas")
    .select("id, nombre")
    .eq("nombre", nombreEmpresa)
    .single();
  if (!empresa) throw new Error(`No existe la empresa ${nombreEmpresa}`);
  console.log(`Empresa: ${empresa.nombre}\n`);

  // Módulos de un camarero: nada de RRHH. Así se comprueba de paso que una
  // pregunta de nóminas contestada con material GENERAL no acaba etiquetada
  // como RECURSOS HUMANOS.
  const MODULOS_CAMARERO = ["SALA", "GENERAL"];

  const insertadas: string[] = [];
  for (const tema of TEMAS) {
    for (const pregunta of tema) {
      const chunks = await buscarConocimiento(pregunta, MODULOS_CAMARERO, 4);
      const emb = await generarEmbedding(pregunta);
      const { data } = await admin
        .from("soporte_consultas")
        .insert({
          empresa_id: empresa.id,
          user_id: null,
          pregunta: `${MARCA} ${pregunta}`,
          respuesta: chunks[0]?.contenido ?? "",
          modulos_permitidos: MODULOS_CAMARERO,
          chunks_usados: chunks.map((c) => c.id),
          escalo: false,
          desenlace: "resuelta",
          embedding: emb ? JSON.stringify(emb) : null,
        })
        .select("id")
        .single();
      if (data) insertadas.push(data.id as string);
    }
  }
  console.log(`Consultas de prueba metidas: ${insertadas.length}\n`);

  const r = await generarFaqsDeEmpresa(empresa.id);
  console.log("Motor:", r, "\n");

  const { data: faqs } = await admin
    .from("soporte_faq")
    .select("id, modulo, pregunta, respuesta, veces_preguntada, origen")
    .eq("empresa_id", empresa.id)
    .order("veces_preguntada", { ascending: false });

  for (const f of (faqs ?? []) as {
    id: string;
    modulo: string;
    pregunta: string;
    respuesta: string;
    veces_preguntada: number;
  }[]) {
    console.log(`── [${f.modulo}] ×${f.veces_preguntada}  ${f.pregunta}`);
    console.log(`${f.respuesta}\n`);
  }

  // Limpieza: fuera todo lo de la prueba.
  const idsFaq = ((faqs ?? []) as { id: string }[]).map((f) => f.id);
  if (idsFaq.length) await admin.from("soporte_faq").delete().in("id", idsFaq);
  if (insertadas.length) await admin.from("soporte_consultas").delete().in("id", insertadas);
  console.log(`Limpiado: ${idsFaq.length} preguntas y ${insertadas.length} consultas.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
